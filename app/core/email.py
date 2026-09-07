import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
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
):
    manage_block = f"""
      <div style="text-align: center; margin-top: 16px;">
        <a href="{manage_url}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;">
          Керувати візитом / скасувати
        </a>
      </div>
    """ if manage_url else ""

    html_template = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #f1f5f9; border-radius: 18px; color: #111827;">
      <h2 style="margin: 0 0 8px 0; font-size: 20px;">Візит підтверджено! </h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">Вітаємо, {client_name}! Ваш запис успішно зареєстровано в системі.</p>

      <div style="background-color: #f8fafc; border-radius: 14px; padding: 18px; margin-bottom: 20px;">
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">{business_name}</div>
        <div style="font-size: 13px; color: #64748b; margin-bottom: 14px;">📍 {address}</div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-bottom: 12px;">
          <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Послуга</div>
          <div style="font-size: 14px; font-weight: 700;">{service_name}</div>
        </div>

        <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <div>
            <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Дата і час</div>
            <div style="font-size: 14px; font-weight: 700;">{booking_date} о {booking_time}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Вартість</div>
            <div style="font-size: 14px; font-weight: 800; color: #16a34a;">{price:.0f} ₴</div>
          </div>
        </div>
      </div>
      {manage_block}
    </div>
    """

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None,
        send_email_sync,
        to_email,
        f"Підтвердження візиту — {business_name}",
        html_template
    )

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
):
    """
    Лист про перенесення візиту.

    Раніше після зміни часу в CRM клієнт не дізнавався про це ніяк -
    приходив у старий час або не приходив узагалі. Для сервісу записів
    це головне джерело неявок, і виправляти його треба не нагадуваннями,
    а тим, щоб людина взагалі знала про зміну.

    Старий час показуємо ЗАКРЕСЛЕНИМ поруч із новим: людина має впізнати
    свій запис, а не гадати, про який візит ідеться.
    """
    manage_block = f"""
      <div style="text-align: center; margin-top: 20px;">
        <a href="{manage_url}" style="display:inline-block;padding:12px 22px;background:#222222;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">
          Переглянути запис
        </a>
      </div>
    """ if manage_url else ""

    address_block = f'<p style="margin:6px 0 0;color:#6B756A;font-size:14px;">{address}</p>' if address else ""

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222222;">
      <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;letter-spacing:-0.02em;">Ваш візит перенесено</h1>
      <p style="margin:0 0 24px;color:#5C6B5E;font-size:15px;line-height:1.5;">
        {client_name}, у закладі «{business_name}» змінили час вашого запису.
      </p>

      <div style="background:#F4FAF5;border:1px solid rgba(94,122,97,0.18);border-radius:14px;padding:20px;">
        <p style="margin:0 0 4px;color:#6B756A;font-size:13px;">Послуга</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;">{service_name}</p>

        <p style="margin:0 0 4px;color:#6B756A;font-size:13px;">Було</p>
        <p style="margin:0 0 16px;font-size:15px;color:#A5AEA3;text-decoration:line-through;">{old_date}, {old_time}</p>

        <p style="margin:0 0 4px;color:#6B756A;font-size:13px;">Стало</p>
        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;">{new_date}, {new_time}</p>
        {address_block}
      </div>

      {manage_block}

      <p style="margin:24px 0 0;color:#A5AEA3;font-size:13px;line-height:1.5;">
        Якщо новий час вам не підходить — зв'яжіться із закладом.
      </p>
    </div>
    """

    await asyncio.to_thread(
        send_email_sync,
        to_email,
        f"Візит перенесено — {business_name}",
        html,
    )


async def send_campaign_email(
        to_email: str,
        client_name: str,
        business_name: str,
        subject: str,
        message: str,
        unsubscribe_url: str = "",
):
    """
    Лист розсилки закладу своїм клієнтам.

    Текст пишe власник, тому екрануємо його перед вставкою в HTML:
    інакше символи на кшталт < зламали б верстку листа, а в гіршому
    разі дозволили б вставити чужу розмітку.

    Переноси рядків зберігаємо - людина писала текст абзацами, і
    злити його в суцільну стіну означає зіпсувати повідомлення.
    """
    import html as _html

    safe_message = _html.escape(message).replace("\n", "<br>")
    safe_name = _html.escape(client_name or "")
    safe_business = _html.escape(business_name)

    # Посилання на відписку - не формальність: без нього листи швидко
    # потрапляють у спам, і страждає вся розсилка закладу.
    unsubscribe_block = f"""
      <p style="margin:28px 0 0;color:#A5AEA3;font-size:12px;line-height:1.5;">
        Не хочете отримувати такі листи?
        <a href="{unsubscribe_url}" style="color:#6B756A;">Відписатись</a>
      </p>
    """ if unsubscribe_url else ""

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#222222;">
      <p style="margin:0 0 20px;color:#5C6B5E;font-size:15px;">{safe_name}, вітаємо!</p>
      <div style="font-size:15px;line-height:1.6;">{safe_message}</div>
      <p style="margin:28px 0 0;color:#6B756A;font-size:14px;">— {safe_business}</p>
      {unsubscribe_block}
    </div>
    """

    await asyncio.to_thread(send_email_sync, to_email, subject, html)
