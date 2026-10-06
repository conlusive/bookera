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


def logo() -> str:
    """Знак BookEra як на сайті: «Book» темним, «Era» кольором бренду. Текстом, а не картинкою:
    поштові клієнти за замовчуванням ховають зображення, а текст видно завжди."""
    return (f'<span style="font-family:{FONT};font-size:28px;font-weight:900;letter-spacing:-0.04em;color:{INK};">'
            f'Book<span style="color:#8fae92;">Era</span></span>')


def esc(text: Optional[str]) -> str:
    """Екранування тексту, який писала людина."""
    return _html.escape(str(text or ""))


def button(label: str, url: str) -> str:
    """
    Широка кнопка через таблицю.

    <a> зі стилями кнопки в Outlook перетворюється на звичайне
    посилання - тому обгортка таблицею, це єдиний надійний спосіб.
    """
    if not url:
        return ""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
      <tr>
        <td align="center" bgcolor="{INK}" style="border-radius:14px;">
          <a href="{url}" target="_blank"
             style="display:block;padding:18px 24px;font-family:{FONT};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;letter-spacing:-0.01em;">
            {esc(label)}
          </a>
        </td>
      </tr>
    </table>
    """


def info_row(label: str, value: str, strike: bool = False, big: bool = False) -> str:
    """Рядок «підпис — значення» всередині картки."""
    value_style = f"font-size:{'22px' if big else '17px'};font-weight:{'700' if big else '600'};color:{INK};letter-spacing:-0.01em;"
    if strike:
        value_style = "font-size:15px;color:#A5AEA3;text-decoration:line-through;"
    return f"""
    <tr>
      <td style="padding:0 0 6px;font-family:{FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:{MUTED};">{esc(label)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 22px;font-family:{FONT};{value_style}">{esc(value)}</td>
    </tr>
    """


def card(inner_rows: str) -> str:
    """Блок з даними візиту: без коробки й заливки, лише тонкі лінії зверху й знизу."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-top:1px solid {LINE};border-bottom:1px solid {LINE};">
      <tr>
        <td style="padding:26px 0 8px;">
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
    preheader: str = "",
) -> str:
    """
    Обгортка листа на чистому білому тлі, без «коробки»: знак BookEra, назва закладу, заголовок, тіло.

    Ширина колонки 560px, відступи великі: лист має дихати. Єдиний стиль для всіх листів платформи.
    """
    quoted = business_name if "«" in business_name or "»" in business_name else "«" + business_name + "»"
    intro_block = f"""
        <tr><td style="padding:0 0 28px;font-family:{FONT};font-size:17px;line-height:1.7;color:#3A403A;">{intro}</td></tr>
    """ if intro else ""
    footer_block = f"""
        <tr><td style="padding:28px 0 0;font-family:{FONT};font-size:15px;line-height:1.65;color:{MUTED};">{footer_note}</td></tr>
    """ if footer_note else ""
    unsub = (
        f'<p style="margin:0 0 16px;">Ви отримуєте цей лист, бо є клієнтом закладу {esc(quoted)}. '
        f'<a href="{esc(unsubscribe_url)}" style="color:{MUTED};text-decoration:underline;">Відписатися від розсилок</a></p>'
    ) if unsubscribe_url else ""
    preheader_block = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">'
        f"{esc(preheader)}{'&nbsp;&zwnj;' * 40}</div>"
    ) if preheader else ""

    return f"""<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  {preheader_block}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:0 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">

        <tr><td style="padding:52px 0 0;">{logo()}</td></tr>
        <tr>
          <td style="padding:36px 0 24px;font-family:{FONT};font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{MUTED};">
            {esc(business_name)}
          </td>
        </tr>

        <tr><td style="padding:0 0 28px;font-family:{FONT};font-size:34px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:{INK};">{esc(title)}</td></tr>
        {intro_block}
        <tr><td>{body_html}</td></tr>
        {footer_block}

        <tr>
          <td style="padding:56px 0 56px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding:0 0 28px;border-top:1px solid {LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="font-family:{FONT};font-size:13px;line-height:1.65;color:{MUTED};">
                {unsub}
                <p style="margin:0;color:#A5AEA3;">Надіслано через BookEra</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def campaign_layout(
    business_name: str,
    title: str,
    greeting: str,
    text_html: str,
    cta_url: str = "",
    cta_label: str = "Записатися онлайн",
    contacts: Optional[list] = None,
    can_reply: bool = False,
    unsubscribe_url: str = "",
    preheader: str = "",
) -> str:
    """
    Лист розсилки на чистому білому тлі, без «коробки»: багато повітря, великий заголовок, широка
    кнопка, контакти без рамок і тихий футер. Без фотографій: лист легкий і швидко вантажиться.

    contacts - список (підпис, значення, посилання або ""): показуємо лише те, що заклад справді
    вказав, нічого не вигадуємо.
    """
    rows = ""
    for label, value, href in (contacts or []):
        v = esc(value)
        if href:
            v = f'<a href="{esc(href)}" style="color:{INK};text-decoration:none;">{v}</a>'
        rows += f"""
        <tr>
          <td style="padding:0 0 6px;font-family:{FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:{MUTED};">{esc(label)}</td>
        </tr>
        <tr>
          <td style="padding:0 0 22px;font-family:{FONT};font-size:17px;font-weight:600;line-height:1.45;color:{INK};">{v}</td>
        </tr>"""
    contacts_block = f"""
      <tr><td style="padding:40px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:0 0 28px;border-top:1px solid {LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr><td style="padding:0 0 20px;font-family:{FONT};font-size:20px;font-weight:800;letter-spacing:-0.01em;color:{INK};">Як нас знайти</td></tr>
          {rows}
        </table>
      </td></tr>""" if rows else ""

    cta_block = f"""
      <tr><td style="padding:12px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="{INK}" style="border-radius:14px;">
              <a href="{esc(cta_url)}" target="_blank"
                 style="display:block;padding:18px 24px;font-family:{FONT};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;letter-spacing:-0.01em;">
                {esc(cta_label)}
              </a>
            </td>
          </tr>
        </table>
      </td></tr>""" if cta_url else ""

    quoted = business_name if "«" in business_name or "»" in business_name else "«" + business_name + "»"
    reply_line = (
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{INK};">Є питання? Дайте відповідь на цей лист — він надійде безпосередньо закладу.</p>'
        if can_reply else ""
    )
    unsub_line = (
        f'Ви отримуєте цей лист, бо є клієнтом закладу {esc(quoted)}. '
        f'<a href="{esc(unsubscribe_url)}" style="color:{MUTED};text-decoration:underline;">Відписатися від розсилок</a>'
        if unsubscribe_url else ""
    )
    preheader_block = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">'
        f"{esc(preheader)}{'&nbsp;&zwnj;' * 40}</div>"
    ) if preheader else ""

    return f"""<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  {preheader_block}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:0 20px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;">

        <!-- Шапка: знак BookEra, під ним назва закладу -->
        <tr><td style="padding:52px 0 0;">{logo()}</td></tr>
        <tr>
          <td style="padding:36px 0 40px;font-family:{FONT};font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{MUTED};">
            {esc(business_name)}
          </td>
        </tr>

        <tr><td style="padding:0 0 32px;font-family:{FONT};font-size:36px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:{INK};">{esc(title)}</td></tr>
        <tr><td style="padding:0 0 18px;font-family:{FONT};font-size:18px;font-weight:600;color:{INK};">{esc(greeting)}</td></tr>
        <tr><td style="padding:0 0 28px;font-family:{FONT};font-size:17px;line-height:1.75;color:#3A403A;">{text_html}</td></tr>
        {cta_block}
        {contacts_block}

        <tr><td style="padding:48px 0 0;font-family:{FONT};font-size:16px;font-weight:600;color:{INK};">З повагою,<br><span style="color:{MUTED};">{esc(business_name)}</span></td></tr>

        <!-- Футер: тільки тонка лінія й тихий текст -->
        <tr>
          <td style="padding:56px 0 56px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding:0 0 28px;border-top:1px solid {LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td style="font-family:{FONT};font-size:13px;line-height:1.65;color:{MUTED};">
                {reply_line}
                <p style="margin:0 0 16px;">{unsub_line}</p>
                <p style="margin:0;color:#A5AEA3;">Надіслано через BookEra</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>"""
