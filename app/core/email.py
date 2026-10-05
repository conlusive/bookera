import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from app.core.email_layout import FONT, INK, button, card, esc, info_row, layout
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def send_email_sync(to_email: str, subject: str, html_content: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Email Mock] До: {to_email} | Тема: {subject}")
        return

    # Переноси рядків у заголовках - класична ін'єкція (дописати Bcc чи підмінити тему). Тему й адресу
    # часто складають з назв, які вводили люди, тому прибираємо їх завжди.
    subject = " ".join(str(subject).splitlines())
    to_email = "".join(str(to_email).split())

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"BookEra <{SMTP_USER}>"
    msg["To"] = to_email

    part = MIMEText(html_content, "html", "utf-8")
    msg.attach(part)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())


async def send_booking_confirmation_email(
        to_email: str,
        client_name: str,
        business_name: str,
        service_name: str,
        booking_date: str,
        booking_time: str,
        price: float,
        address: str,
        manage_url: str = "",
        cancellation_policy: str = "",
        deposit_due: float | None = None,
        master_name: str = "",
        duration_minutes: int | None = None,
        business_phone: str = "",
):
    """
    Підтвердження запису.

    Порядок полів - за тим, що людина шукає першим: коли, до кого,
    що саме, скільки коштує. Адреса й телефон нижче: вони потрібні
    в день візиту, а не в момент отримання листа.
    """
    when = f"{booking_date}, {booking_time}"
    if duration_minutes:
        hours, minutes = divmod(int(duration_minutes), 60)
        parts = []
        if hours:
            parts.append(f"{hours} год")
        if minutes:
            parts.append(f"{minutes} хв")
        if parts:
            when += " · " + " ".join(parts)

    rows = info_row("Коли", when, big=True)
    if master_name:
        rows += info_row("Майстер", master_name)
    rows += info_row("Послуга", service_name)
    if price:
        rows += info_row("Вартість", f"{price:,.0f} ₴".replace(",", " "))
    if deposit_due:
        # Передоплату називаємо окремо: людина має дізнатись про неї
        # з листа, а не при вході в салон.
        rows += info_row("Передоплата", f"{deposit_due:,.0f} ₴".replace(",", " "))
    if address.strip(" ,"):
        rows += info_row("Адреса", address.strip(" ,"))
    if business_phone:
        rows += info_row("Телефон закладу", business_phone)

    body = card(rows) + button("Переглянути або скасувати", manage_url)

    footer = esc(cancellation_policy) if cancellation_policy else (
        "Якщо плани зміняться — скасуйте візит завчасно, щоб хтось інший міг зайняти цей час."
    )

    html = layout(
        business_name=business_name,
        title="Вас записано",
        intro=f"{esc(client_name)}, дякуємо за запис. Чекаємо на вас у зазначений час.",
        body_html=body,
        footer_note=footer,
    )
    await asyncio.to_thread(send_email_sync, to_email, f"Запис підтверджено — {business_name}", html)


async def send_booking_rescheduled_email(
        to_email: str,
        client_name: str,
        business_name: str,
        service_name: str,
        old_date: str,
        old_time: str,
        new_date: str,
        new_time: str,
        address: str = "",
        manage_url: str = "",
        master_name: str = "",
):
    """
    Перенесення візиту.

    Старий час показуємо закресленим поруч із новим: людина має
    впізнати свій запис, а не гадати, про який візит ідеться.
    """
    rows = (
        info_row("Було", f"{old_date}, {old_time}", strike=True)
        + info_row("Стало", f"{new_date}, {new_time}", big=True)
        + info_row("Послуга", service_name)
    )
    if master_name:
        rows += info_row("Майстер", master_name)
    if address.strip(" ,"):
        rows += info_row("Адреса", address.strip(" ,"))

    html = layout(
        business_name=business_name,
        title="Ваш візит перенесено",
        intro=f"{esc(client_name)}, час вашого запису змінено. Нові деталі нижче.",
        body_html=card(rows) + button("Переглянути запис", manage_url),
        footer_note="Якщо новий час вам не підходить — зв'яжіться із закладом.",
    )
    await asyncio.to_thread(send_email_sync, to_email, f"Візит перенесено — {business_name}", html)


async def send_campaign_email(
        to_email: str,
        client_name: str,
        business_name: str,
        subject: str,
        message: str,
        unsubscribe_url: str = "",
):
    """
    Лист розсилки.

    Текст пише власник, тому екрануємо перед вставкою в HTML: символ <
    не має ламати верстку, а чужа розмітка - потрапляти в лист.
    Переноси рядків зберігаємо - людина писала абзацами, і злити це
    в суцільну стіну означає зіпсувати повідомлення.
    """
    safe_message = esc(message).replace("\n", "<br>")

    body = f"""
    <div style="font-family:{FONT};font-size:15px;line-height:1.65;color:{INK};">
      {safe_message}
    </div>
    """

    html = layout(
        business_name=business_name,
        title=subject,
        intro=f"{esc(client_name)}, вітаємо!" if client_name else "",
        body_html=body,
        unsubscribe_url=unsubscribe_url,
    )
    await asyncio.to_thread(send_email_sync, to_email, subject, html)


def _clean_header(value: str) -> str:
    """Один рядок без переносів: назви закладів і теми вводять люди, а ' \\n ' у заголовку - ін'єкція."""
    return " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())


def build_campaign_message(
        to_email: str,
        client_name: str,
        business_name: str,
        subject: str,
        message: str,
        unsubscribe_url: str,
        one_click_url: str = "",
        reply_to: str = "",
) -> MIMEMultipart:
    """
    Лист розсилки як готове повідомлення.

    - відправник: «Назва закладу через BookEra» (адреса одна, але людина бачить, від кого лист),
      відповідь іде самому закладу (Reply-To);
    - List-Unsubscribe (+ List-Unsubscribe-Post): без цього Gmail і Yahoo вважають масову пошту
      підозрілою, а кнопка «Відписатись» у самому клієнті працює в один клік;
    - окрема текстова частина: лист лише з HTML частіше потрапляє до спаму.
    """
    from email.utils import formataddr
    subject = _clean_header(subject)
    business_name = _clean_header(business_name)
    safe_message = esc(message).replace("\n", "<br>")
    body = f"""
    <div style="font-family:{FONT};font-size:15px;line-height:1.65;color:{INK};">
      {safe_message}
    </div>
    """
    html = layout(
        business_name=business_name,
        title=subject,
        intro=f"{esc(client_name)}, вітаємо!" if client_name else "",
        body_html=body,
        unsubscribe_url=unsubscribe_url,
    )
    plain = (
        (f"{client_name}, вітаємо!\n\n" if client_name else "")
        + str(message).strip()
        + f"\n\n--\nВи отримали цей лист, бо є клієнтом «{business_name}».\nВідписатись: {unsubscribe_url}\n"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((f"{business_name} через BookEra", SMTP_USER or "noreply@bookera.local"))
    msg["To"] = "".join(str(to_email).split())
    if reply_to and "@" in reply_to:
        msg["Reply-To"] = _clean_header(reply_to)
    links = [f"<{one_click_url}>"] if one_click_url else []
    links.append(f"<{unsubscribe_url}>")
    msg["List-Unsubscribe"] = ", ".join(links)
    if one_click_url:
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg["Precedence"] = "bulk"
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


# Пауза між листами: SMTP-сервери (Gmail, хостинги) обмежують швидкість, і пачка без пауз
# закінчується тимчасовою відмовою на половині списку.
CAMPAIGN_SEND_DELAY = float(os.getenv("CAMPAIGN_SEND_DELAY", "0.2") or 0.2)


def send_campaign_batch(messages: list) -> tuple[int, int]:
    """
    Відправляє пакет листів ОДНИМ SMTP-з'єднанням (раніше кожен лист відкривав нове з автентифікацією).
    Повертає (надіслано, не вдалось). Збій одного листа не зупиняє решту; обрив з'єднання - одна
    спроба відновити.
    """
    import time
    sent = failed = 0
    if not SMTP_USER or not SMTP_PASSWORD:
        for m in messages:
            print(f"[Email Mock] Розсилка: До: {m['To']} | Тема: {m['Subject']}")
            sent += 1
        return sent, failed

    server = None

    def connect():
        s = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
        s.starttls()
        s.login(SMTP_USER, SMTP_PASSWORD)
        return s

    try:
        server = connect()
        for m in messages:
            try:
                try:
                    server.sendmail(SMTP_USER, m["To"], m.as_string())
                except smtplib.SMTPServerDisconnected:
                    server = connect()
                    server.sendmail(SMTP_USER, m["To"], m.as_string())
                sent += 1
            except Exception as exc:  # одна відмова (адреса, ліміт) - не причина кидати решту
                failed += 1
                print(f"[Email] Розсилка: не надіслано {m['To']}: {exc}")
            time.sleep(CAMPAIGN_SEND_DELAY)
    except Exception as exc:
        # Не вдалось підключитись узагалі - усе, що лишилось, рахуємо невдалим
        failed += len(messages) - sent - failed
        print(f"[Email] Розсилка: SMTP недоступний: {exc}")
    finally:
        try:
            if server is not None:
                server.quit()
        except Exception:
            pass
    return sent, failed


async def send_new_booking_to_staff(
        to_email: str,
        business_name: str,
        client_name: str,
        client_phone: str,
        service_name: str,
        booking_date: str,
        booking_time: str,
        master_name: str = "",
        needs_approval: bool = False,
):
    """
    Сповіщення ЗАКЛАДУ про новий запис.

    Раніше лист ішов лише клієнту, а заклад дізнавався про запис,
    коли відкривав календар. Для майстра, який працює без адміністратора,
    це означало сюрприз - або прогаяного клієнта.

    Телефон клієнта в листі не випадково: найчастіша дія після
    «прийшов новий запис» - подзвонити й уточнити.
    """
    rows = (
        info_row("Клієнт", client_name or "Без імені")
        + info_row("Телефон", client_phone or "не вказано")
        + info_row("Коли", f"{booking_date}, {booking_time}", big=True)
        + info_row("Послуга", service_name)
    )
    if master_name:
        rows += info_row("Майстер", master_name)

    title = "Новий запис чекає підтвердження" if needs_approval else "Новий запис"
    note = ("Автопідтвердження вимкнене — візит зʼявиться в календарі "
            "після вашого підтвердження.") if needs_approval else ""

    html = layout(
        business_name=business_name,
        title=title,
        body_html=card(rows),
        footer_note=note,
    )
    await asyncio.to_thread(send_email_sync, to_email, f"{title} — {business_name}", html)


async def send_booking_reminder_email(
        to_email: str,
        client_name: str,
        business_name: str,
        service_name: str,
        booking_date: str,
        booking_time: str,
        master_name: str = "",
        address: str = "",
        business_phone: str = "",
        manage_url: str = "",
):
    """
    Нагадування за добу до візиту.

    Тон навмисно спокійний: це не рекламний лист, а послуга. Людина
    записалась тиждень тому й могла забути - нагадати треба так, щоб
    не здатися настирливим.

    Посилання на скасування - головне в цьому листі. Якщо людина
    все одно не прийде, краще дізнатись про це зараз: слот ще можна
    віддати комусь іншому.
    """
    rows = info_row("Коли", f"{booking_date}, {booking_time}", big=True)
    if master_name:
        rows += info_row("Майстер", master_name)
    rows += info_row("Послуга", service_name)
    if address.strip(" ,"):
        rows += info_row("Адреса", address.strip(" ,"))
    if business_phone:
        rows += info_row("Телефон закладу", business_phone)

    html = layout(
        business_name=business_name,
        title="Нагадуємо про візит завтра",
        intro=f"{esc(client_name)}, чекаємо на вас." if client_name else "Чекаємо на вас.",
        body_html=card(rows) + button("Переглянути або скасувати", manage_url),
        footer_note=("Якщо плани змінились — скасуйте візит завчасно, "
                     "щоб хтось інший міг зайняти цей час."),
    )
    await asyncio.to_thread(send_email_sync, to_email, f"Нагадування про візит — {business_name}", html)


async def send_staff_notice(
        to_email: str,
        business_name: str,
        title: str,
        rows: list,
        footer_note: str = "",
):
    """
    Коротке сповіщення персоналу: майстрові про запис, перенесення чи
    скасування; власнику - про запит майстра; майстрові - про рішення.

    rows - [(підпис, значення, великий?)]. Оформлення - те саме, що в
    листі про новий запис, щоб усі листи BookEra виглядали однаково.
    """
    body = "".join(info_row(label, value, big=bool(big)) for label, value, big in rows)
    html = layout(business_name=business_name, title=title, body_html=card(body), footer_note=footer_note)
    await asyncio.to_thread(send_email_sync, to_email, f"{title} — {business_name}", html)



async def send_review_request(to_email: str, business_name: str, master_name: str, service_name: str,
                              when_str: str, link_base: str):
    """
    «Як вам візит?» - через 2 години після візиту. П'ять зірок прямо в
    листі: натиск відкриває сторінку з уже обраною оцінкою - один дотик
    замість «перейдіть, знайдіть, оцініть».
    """
    who = f"до {master_name}" if master_name else ""
    stars = "".join(
        f'<a href="{esc(link_base)}&rate={n}#feedback" style="display:inline-block;width:44px;height:44px;line-height:44px;'
        f'margin:0 3px;border-radius:12px;background:#FFF7E6;color:#F5A623;font-size:26px;text-decoration:none;text-align:center">&#9733;</a>'
        for n in range(1, 6)
    )
    body = (
        f'<p style="margin:0 0 6px;font-family:{FONT};font-size:15px;color:{INK}">{esc(service_name)} {esc(who)} · {esc(when_str)}</p>'
        f'<p style="margin:0 0 18px;font-family:{FONT};font-size:14px;color:#6E6E73">Оцініть візит - це займе секунду й допоможе майстрові.</p>'
        f'<div style="text-align:center;margin:0 0 6px">{stars}</div>'
        f'<div style="display:flex;justify-content:space-between;font-family:{FONT};font-size:11px;color:#AEAEB2;margin:0 6px">'
        f'<span>погано</span><span>чудово</span></div>'
    )
    html = layout(business_name=business_name, title="Як вам візит?", body_html=card(body), footer_note="")
    await asyncio.to_thread(send_email_sync, to_email, f"Як вам візит у {business_name}?", html)
