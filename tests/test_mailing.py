"""
Розсилка: відписки, one-click, виключення відписаних, добові ліміти, журнал, пакетна відправка.
"""

from app.core import email as email_mod
from app.services import mailing


async def _biz_with_clients(client, h, emails):
    bid = (await client.post("/crm/businesses", json={"name": "Розсилка", "city": "Львів"}, headers=h)).json()["id"]
    for i, e in enumerate(emails):
        body = {"business_id": bid, "name": f"Клієнт {i}", "phone": f"+38067111{i:04d}"}
        if e:
            body["email"] = e
        r = await client.post("/crm/clients", json=body, headers=h)
        assert r.status_code in (200, 201), r.text
    return bid


def _payload(bid, audience="all"):
    return {"business_id": bid, "subject": "Новини", "message": "Текст розсилки для клієнтів", "audience": audience}


def test_token_roundtrip_and_tamper():
    t = mailing.make_unsubscribe_token(5, "A@Test.com")
    assert mailing.parse_unsubscribe_token(t) == (5, "a@test.com")
    payload, sig = t.split(".")
    assert mailing.parse_unsubscribe_token(f"{payload}.{sig[:-2]}xx") is None
    assert mailing.parse_unsubscribe_token("garbage") is None
    other = mailing.make_unsubscribe_token(6, "a@test.com")
    assert mailing.parse_unsubscribe_token(f"{other.split('.')[0]}.{sig}") is None


async def test_unsubscribe_flow_and_audience(client, auth_headers, legacy_duplicates):
    h = auth_headers("mail-unsub")
    # Нових дублів пошти вже не створити; старі (до унікальних індексів) у базі можуть бути - розсилка їх не множить
    bid = await _biz_with_clients(client, h, ["a@test.com", "b@test.com"])
    import asyncpg
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/bookera_test")
    try:
        await conn.execute("INSERT INTO clients (business_id, name, phone, email) VALUES ($1, 'Клієнт 2', '+380671110002', 'A@test.com')", bid)
    finally:
        await conn.close()
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 2, "дубль пошти (інший регістр) рахується один раз"

    token = mailing.make_unsubscribe_token(bid, "a@test.com")
    info = await client.get(f"/public/unsubscribe/{token}")
    assert info.status_code == 200 and info.json()["unsubscribed"] is False
    assert "a@test.com" not in info.text, "адреса в відповіді замаскована"

    # one-click POST із поштового клієнта
    r = await client.post(f"/public/unsubscribe/{token}")
    assert r.status_code == 200 and r.json()["unsubscribed"] is True
    assert (await client.post(f"/public/unsubscribe/{token}")).status_code == 200, "повтор безпечний"

    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 1 and aud["unsubscribed"] == 1
    sent = await client.post("/crm/campaigns", json=_payload(bid), headers=h)
    assert sent.status_code == 200 and sent.json()["queued"] == 1

    r = await client.post(f"/public/unsubscribe/{token}/resubscribe")
    assert r.json()["unsubscribed"] is False
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 2


async def test_invalid_token_is_404(client):
    assert (await client.get("/public/unsubscribe/not-a-token")).status_code == 404
    assert (await client.post("/public/unsubscribe/not-a-token")).status_code == 404


async def test_daily_limits(client, auth_headers, monkeypatch):
    h = auth_headers("mail-limit")
    bid = await _biz_with_clients(client, h, ["a@test.com", "b@test.com", "c@test.com"])

    monkeypatch.setattr(mailing, "DAILY_RECIPIENT_LIMIT", 4)
    assert (await client.post("/crm/campaigns", json=_payload(bid), headers=h)).status_code == 200
    r = await client.post("/crm/campaigns", json=_payload(bid), headers=h)
    assert r.status_code == 429 and "Ліміт листів" in r.json()["detail"]

    monkeypatch.setattr(mailing, "DAILY_RECIPIENT_LIMIT", 1000)
    monkeypatch.setattr(mailing, "DAILY_CAMPAIGN_LIMIT", 1)
    r = await client.post("/crm/campaigns", json=_payload(bid), headers=h)
    assert r.status_code == 429 and "Ліміт розсилок" in r.json()["detail"]


async def test_campaign_is_journaled(client, auth_headers):
    h = auth_headers("mail-journal")
    bid = await _biz_with_clients(client, h, ["a@test.com", "b@test.com"])
    r = await client.post("/crm/campaigns", json=_payload(bid), headers=h)
    assert r.status_code == 200 and r.json()["quota"]["used_campaigns"] == 1
    rows = (await client.get("/crm/campaigns", params={"business_id": bid}, headers=h)).json()
    assert len(rows) == 1 and rows[0]["recipients"] == 2 and rows[0]["status"] == "done"
    assert rows[0]["sent"] + rows[0]["failed"] == 2


def test_message_headers_and_batch(monkeypatch):
    msg = email_mod.build_campaign_message(
        "x@test.com", "Іра", "Салон", "Тема\r\nBcc: evil@x.com", "Привіт",
        "https://app/unsubscribe?token=T", "https://api/public/unsubscribe/T", "salon@test.com",
    )
    assert "Bcc" not in msg and "\n" not in msg["Subject"]
    assert "https://api/public/unsubscribe/T" in msg["List-Unsubscribe"]
    assert msg["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert msg["Reply-To"] == "salon@test.com"

    # без SMTP-налаштувань пакет у режимі mock: усі «надіслані»
    assert email_mod.send_campaign_batch([msg, msg]) == (2, 0)


def test_tests_never_send_real_email():
    """Запобіжник: у тестах SMTP вимкнений, інакше листи пішли б на вигадані адреси."""
    assert not (email_mod.SMTP_USER and email_mod.SMTP_PASSWORD)


async def test_clients_who_declined_are_not_mailed(client, auth_headers):
    h = auth_headers("mail-consent")
    bid = (await client.post("/crm/businesses", json={"name": "Згода", "city": "Львів"}, headers=h)).json()["id"]
    cases = [("old@test.com", None), ("yes@test.com", True), ("no@test.com", False)]
    for i, (e, consent) in enumerate(cases):
        body = {"business_id": bid, "name": f"К{i}", "phone": f"+38067222{i:04d}", "email": e}
        if consent is not None:
            body["marketing_consent"] = consent
        r = await client.post("/crm/clients", json=body, headers=h)
        assert r.status_code in (200, 201), r.text
        assert r.json()["marketing_consent"] is consent

    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 2, "старий клієнт (не питали) і згодний - так; відмовник - ні"
    assert aud["no_consent"] == 1
    sent = (await client.post("/crm/campaigns", json=_payload(bid), headers=h)).json()
    assert sent["queued"] == 2 and sent["no_consent"] == 1

    # згоду можна дати пізніше з картки клієнта
    clients = (await client.get("/crm/clients", params={"business_id": bid}, headers=h)).json()
    declined = next(c for c in clients if c["email"] == "no@test.com")
    r = await client.patch(f"/crm/clients/{declined['id']}", json={"marketing_consent": True}, headers=h)
    assert r.status_code == 200 and r.json()["marketing_consent"] is True
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 3 and aud["no_consent"] == 0


async def test_online_booking_consent_checkbox(client, auth_headers):
    """Онлайн-запис: без галочки клієнт не в розсилках, з галочкою - так, а повторний запис без неї згоду не забирає."""
    from datetime import timedelta
    from app.core.time_utils import local_now

    h = auth_headers("mail-booking-consent")
    bid = (await client.post("/crm/businesses", json={"name": "Онлайн", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=h)).json()["id"]
    start = local_now().replace(tzinfo=None) + timedelta(days=2)

    def book(phone, email, offset, consent=None):
        body = {"business_id": bid, "service_id": sid, "start_time": (start + timedelta(hours=offset)).isoformat(),
                "client_name": "Гість", "client_phone": phone, "client_email": email}
        if consent is not None:
            body["marketing_consent"] = consent
        return client.post("/appointments", json=body)

    assert (await book("+380671110001", "a@test.com", 0)).status_code == 200
    assert (await book("+380671110002", "b@test.com", 2, True)).status_code == 200
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 1 and aud["no_consent"] == 1

    # той, хто не ставив галочку, ставить її при наступному записі
    assert (await book("+380671110001", "a@test.com", 4, True)).status_code == 200
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 2 and aud["no_consent"] == 0

    # наступний запис без галочки згоду не скасовує
    assert (await book("+380671110002", "b@test.com", 6)).status_code == 200
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 2


async def test_marketing_question_comes_after_booking_and_only_once(client, auth_headers):
    """Питання про розсилку - після підтвердженого запису, один раз; відповідає лише той, хто записався."""
    from datetime import timedelta
    from app.core.time_utils import local_now

    h = auth_headers("mail-ask-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Питання", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=h)).json()["id"]
    start = local_now().replace(tzinfo=None) + timedelta(days=2)

    async def book(offset, session="guest-ask"):
        return await client.post("/appointments", json={
            "business_id": bid, "service_id": sid, "start_time": (start + timedelta(hours=offset)).isoformat(),
            "client_name": "Гість", "client_phone": "+380671119999", "client_email": "ask@test.com", "session_token": session})

    first = (await book(0)).json()
    assert first["ask_marketing_consent"] is True, "після першого запису в салон - питаємо"
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 0, "до відповіді людина в розсилку не потрапляє"

    stranger = auth_headers("somebody-else")
    assert (await client.post(f"/appointments/{first['id']}/marketing-consent", json={"consent": True}, headers=stranger)).status_code == 404

    me = auth_headers("guest-ask")
    ok = await client.post(f"/appointments/{first['id']}/marketing-consent", json={"consent": True}, headers=me)
    assert ok.status_code == 200 and ok.json()["consent"] is True
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 1

    second = (await book(3)).json()
    assert second["ask_marketing_consent"] is False, "вже відповів - більше не питаємо"


async def test_marketing_question_is_not_repeated_after_a_refusal(client, auth_headers):
    from datetime import timedelta
    from app.core.time_utils import local_now

    h = auth_headers("mail-ask-owner-2")
    bid = (await client.post("/crm/businesses", json={"name": "Питання 2", "city": "Львів"}, headers=h)).json()["id"]
    sid = (await client.post("/services", json={"business_id": bid, "name": "Стрижка", "duration_minutes": 60, "price": 500}, headers=h)).json()["id"]
    start = local_now().replace(tzinfo=None) + timedelta(days=2)
    body = {"business_id": bid, "service_id": sid, "client_name": "Гість", "client_phone": "+380671118888",
            "client_email": "no@test.com", "session_token": "guest-no"}
    first = (await client.post("/appointments", json={**body, "start_time": start.isoformat()})).json()
    assert first["ask_marketing_consent"] is True
    await client.post(f"/appointments/{first['id']}/marketing-consent", json={"consent": False}, headers=auth_headers("guest-no"))
    again = (await client.post("/appointments", json={**body, "start_time": (start + timedelta(hours=3)).isoformat()})).json()
    assert again["ask_marketing_consent"] is False, "відмову поважаємо: не питаємо щоразу"
    aud = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    assert aud["all"] == 0
