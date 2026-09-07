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
