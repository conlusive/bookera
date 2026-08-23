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
        address: str
):
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

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Керувати візитом або скасувати його можна у вашому особистому профілі BookEra.
      </p>
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