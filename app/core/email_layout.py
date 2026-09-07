"""
Спільний шаблон листів.

Чому таблиці, а не сучасний CSS: поштові клієнти живуть у своєму
десятилітті. Outlook рендерить через Word і не знає ні flexbox, ні
grid; Gmail вирізає <style> у деяких режимах. Усе, що має вигляд
гарантовано, робиться таблицями й інлайновими стилями.

Чому один шаблон на всі листи: відчуття серйозної компанії створює
не окремий гарний лист, а те, що ВСІ листи виглядають однаково.
Коли підтвердження запису й розсилка намальовані по-різному, це
читається як самороб, навіть якщо кожен окремо непоганий.

Палітра та сама, що в застосунку: Matcha Mist #C2D8C4, Dusty Coal
#222222 - лист має впізнаватись як продовження продукту.
"""
import html as _html
from typing import Optional

INK = "#222222"
MATCHA = "#C2D8C4"
MUTED = "#6B756A"
SOFT = "#F4FAF5"
LINE = "#E4EBE3"
PAGE_BG = "#F2F4F2"

FONT = ("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "'Helvetica Neue', Arial, sans-serif")


def esc(text: Optional[str]) -> str:
    """Екранування тексту, який писала людина."""
    return _html.escape(str(text or ""))


def button(label: str, url: str) -> str:
    """
    Кнопка через таблицю.

    <a> зі стилями кнопки в Outlook перетворюється на звичайне
    посилання - тому обгортка таблицею, це єдиний надійний спосіб.
    """
    if not url:
        return ""
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;">
      <tr>
        <td align="center" bgcolor="{INK}" style="border-radius:10px;">
          <a href="{url}" target="_blank"
             style="display:inline-block;padding:13px 28px;font-family:{FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
            {esc(label)}
          </a>
        </td>
      </tr>
    </table>
    """


def info_row(label: str, value: str, strike: bool = False, big: bool = False) -> str:
    """Рядок «підпис — значення» всередині картки."""
    value_style = f"font-size:{'20px' if big else '15px'};font-weight:{'700' if big else '500'};color:{INK};letter-spacing:-0.01em;"
    if strike:
        value_style = f"font-size:15px;color:#A5AEA3;text-decoration:line-through;"
    return f"""
    <tr>
      <td style="padding:0 0 4px;font-family:{FONT};font-size:13px;color:{MUTED};">{esc(label)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;font-family:{FONT};{value_style}">{esc(value)}</td>
    </tr>
    """


def card(inner_rows: str) -> str:
    """М'яка картка з даними візиту."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:{SOFT};border:1px solid {LINE};border-radius:14px;">
      <tr>
        <td style="padding:22px 24px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            {inner_rows}
          </table>
        </td>
      </tr>
    </table>
    """


def layout(
    business_name: str,
    title: str,
    intro: str = "",
    body_html: str = "",
    footer_note: str = "",
    unsubscribe_url: str = "",
) -> str:
    """
    Обгортка листа: шапка з назвою закладу, тіло, підпис.

    Ширина 600px - усталений максимум для пошти: ширше обрізають
    поштові клієнти на вужчих екранах.
    """
    intro_block = f"""
      <tr>
        <td style="padding:0 0 24px;font-family:{FONT};font-size:15px;line-height:1.55;color:{MUTED};">
          {intro}
        </td>
      </tr>
    """ if intro else ""

    footer_block = f"""
      <tr>
        <td style="padding:24px 0 0;font-family:{FONT};font-size:13px;line-height:1.55;color:#A5AEA3;">
          {footer_note}
        </td>
      </tr>
    """ if footer_note else ""

    # Посилання на відписку - не формальність: без нього листи швидко
    # позначають як спам, і страждає вся розсилка закладу.
    unsub_block = f"""
      <tr>
        <td style="padding:20px 0 0;border-top:1px solid {LINE};font-family:{FONT};font-size:12px;line-height:1.5;color:#A5AEA3;">
          Ви отримали цей лист, бо є клієнтом «{esc(business_name)}».
          <a href="{unsubscribe_url}" style="color:{MUTED};text-decoration:underline;">Відписатись</a>
        </td>
      </tr>
    """ if unsubscribe_url else ""

    return f"""<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">

          <!-- Шапка: смужка кольору бренду й назва закладу -->
          <tr><td style="height:4px;background:{MATCHA};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:26px 32px 0;font-family:{FONT};font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:{MUTED};">
              {esc(business_name)}
            </td>
          </tr>

          <tr>
            <td style="padding:14px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 0 10px;font-family:{FONT};font-size:23px;font-weight:700;line-height:1.25;letter-spacing:-0.02em;color:{INK};">
                    {esc(title)}
                  </td>
                </tr>
                {intro_block}
                <tr><td>{body_html}</td></tr>
                {footer_block}
                {unsub_block}
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
          <tr>
            <td align="center" style="padding:18px 8px 0;font-family:{FONT};font-size:12px;color:#A5AEA3;">
              Надіслано через BookEra
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>"""
