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


async def test_unsubscribe_flow_and_audience(client, auth_headers):
    h = auth_headers("mail-unsub")
    bid = await _biz_with_clients(client, h, ["a@test.com", "b@test.com", "A@test.com"])
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
