#!/usr/bin/env python3
"""
Перевірка поштових налаштувань.

Надсилає тестовий лист і показує, що саме не так, якщо не вийшло.
Потрібен, щоб не з'ясовувати працездатність пошти через створення
справжнього запису: там помилка ховається у фоновій задачі й до
логів доходить у вигляді, з якого мало що зрозуміло.

Запуск:
    source venv/bin/activate
    export $(grep -v '^#' .env | xargs)
    python scripts/check_email.py ваша.пошта@gmail.com
"""
import os
import smtplib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def main() -> int:
    if len(sys.argv) < 2:
        print("Вкажіть адресу отримувача:\n    python scripts/check_email.py you@example.com")
        return 1

    to_email = sys.argv[1]

    print("Налаштування:")
    print(f"  SMTP_HOST     {SMTP_HOST}")
    print(f"  SMTP_PORT     {SMTP_PORT}")
    print(f"  SMTP_USER     {SMTP_USER or '(порожньо)'}")
    print(f"  SMTP_PASSWORD {'задано, ' + str(len(SMTP_PASSWORD)) + ' символів' if SMTP_PASSWORD else '(порожньо)'}")
    print()

    if not SMTP_USER or not SMTP_PASSWORD:
        print("Пошта не налаштована — листи не надсилаються взагалі.")
        print("Заповніть SMTP_USER і SMTP_PASSWORD у .env (див. .env.example).")
        return 1

    # Пароль застосунку Google — рівно 16 символів. Найчастіша помилка:
    # скопіювали разом із пробілами або вставили звичайний пароль пошти.
    cleaned = SMTP_PASSWORD.replace(" ", "")
    if len(cleaned) != len(SMTP_PASSWORD):
        print("⚠ У SMTP_PASSWORD є пробіли. Google показує пароль групами по 4,")
        print("  але вставляти треба без пробілів.")
        print()
    if "gmail" in SMTP_HOST and len(cleaned) != 16:
        print(f"⚠ Для Gmail пароль застосунку має 16 символів, у вас {len(cleaned)}.")
        print("  Схоже, вставлено звичайний пароль від пошти — він для SMTP не підходить.")
        print("  Створити: https://myaccount.google.com/apppasswords")
        print()

    from app.core.email_layout import card, info_row, layout

    html = layout(
        business_name="BookEra",
        title="Пошта працює",
        intro="Якщо ви бачите цей лист — SMTP налаштований правильно.",
        body_html=card(
            info_row("Сервер", f"{SMTP_HOST}:{SMTP_PORT}")
            + info_row("Відправник", SMTP_USER)
        ),
        footer_note="Тестовий лист, надісланий скриптом scripts/check_email.py",
    )

    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "BookEra — перевірка пошти"
    msg["From"] = f"BookEra <{SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(SMTP_USER, cleaned)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        print("✗ Сервер відхилив логін і пароль.")
        print()
        print("Найімовірніші причини:")
        print("  1. Вставлено звичайний пароль пошти замість пароля застосунку.")
        print("  2. Не увімкнена двоетапна перевірка — без неї Google не дає")
        print("     створити пароль застосунку взагалі.")
        print("  3. Пароль скопійовано з пробілами.")
        return 1
    except smtplib.SMTPConnectError:
        print(f"✗ Не вдалося зʼєднатись із {SMTP_HOST}:{SMTP_PORT}.")
        print("  Перевірте хост і порт. Для більшості сервісів це 587.")
        return 1
    except Exception as exc:
        print(f"✗ Помилка: {type(exc).__name__}: {exc}")
        return 1

    print(f"✓ Лист надіслано на {to_email}")
    print("  Якщо його немає у вхідних — подивіться в спамі: перші листи")
    print("  з нового відправника часто потрапляють саме туди.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
