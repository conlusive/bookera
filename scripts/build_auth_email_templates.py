"""
Збирає листи Supabase Auth (підтвердження пошти, відновлення пароля, зміна пошти) у стилі листів BookEra.

    venv/bin/python scripts/build_auth_email_templates.py

Результат - supabase/email-templates/*.html. Вставте їх у Supabase Dashboard -> Authentication -> Emails
(Email Templates). {{ .ConfirmationURL }} та {{ .Email }} - змінні Supabase, їх не чіпати.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.email_layout import button, layout  # noqa: E402

TEMPLATES = {
    "confirm-signup": (
        "Підтвердіть пошту",
        "Дякуємо за реєстрацію в BookEra. Натисніть кнопку нижче, щоб підтвердити адресу <b>{{ .Email }}</b> і почати користуватись акаунтом.",
        "Підтвердити пошту",
        "Якщо ви не реєструвались у BookEra, просто проігноруйте цей лист.",
        "Підтвердьте пошту, щоб завершити реєстрацію в BookEra",
    ),
    "reset-password": (
        "Відновлення пароля",
        "Ми отримали запит на зміну пароля для <b>{{ .Email }}</b>. Натисніть кнопку, щоб задати новий пароль.",
        "Задати новий пароль",
        "Якщо ви не просили змінити пароль, проігноруйте цей лист: ваш пароль лишається без змін.",
        "Посилання для зміни пароля BookEra",
    ),
    "change-email": (
        "Підтвердіть нову пошту",
        "Ви змінюєте адресу акаунта BookEra на <b>{{ .Email }}</b>. Натисніть кнопку, щоб підтвердити зміну.",
        "Підтвердити зміну",
        "Якщо це були не ви, негайно змініть пароль і напишіть нам.",
        "Підтвердіть зміну пошти в BookEra",
    ),
}


def main() -> None:
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supabase", "email-templates")
    os.makedirs(out_dir, exist_ok=True)
    for name, (title, intro, label, note, preheader) in TEMPLATES.items():
        html = layout(
            business_name="",
            title=title,
            intro=intro,
            body_html=button(label, "{{ .ConfirmationURL }}"),
            footer_note=note + '<br><br>Якщо кнопка не працює, скопіюйте це посилання в браузер:<br>'
                        '<span style="word-break:break-all;color:#6B756A;">{{ .ConfirmationURL }}</span>',
            preheader=preheader,
        )
        with open(os.path.join(out_dir, f"{name}.html"), "w", encoding="utf-8") as f:
            f.write(html)
        print("✓", name)


if __name__ == "__main__":
    main()
