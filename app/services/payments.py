"""
Абстракція над платіжним провайдером. Два режими:

- 'mock' - працює прямо зараз, без жодних реквізитів. Одразу підтверджує
  оплату. Використовується, поки немає реального договору з платіжною
  системою - весь інший код (radar, сертифікати) вже повністю функціональний.
- 'wayforpay' - справжні гроші. Код написаний за офіційним API WayForPay
  (підпис HMAC_MD5 за їхнім алгоритмом), але НЕ може бути протестований
  без реальних WFP_MERCHANT_LOGIN / WFP_MERCHANT_SECRET - їх видає WayForPay
  після підключення договору з бізнесом. Поки їх нема в оточенні - система
  сама переключається назад на mock (див. get_payment_provider нижче).
"""
import hashlib
import hmac
import os
import time
from decimal import Decimal
from typing import Optional

from app.core.logging_config import logger

WFP_MERCHANT_LOGIN = os.getenv("WFP_MERCHANT_LOGIN", "")
WFP_MERCHANT_SECRET = os.getenv("WFP_MERCHANT_SECRET", "")
WFP_DOMAIN = os.getenv("WFP_DOMAIN", "bookera.ua")
# development (типово) або production - див. create_payment_intent
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()


class PaymentIntent:
    def __init__(self, provider: str, status: str, checkout_url: Optional[str] = None, provider_ref: Optional[str] = None):
        self.provider = provider
        self.status = status  # 'pending' або 'completed'
        self.checkout_url = checkout_url  # None для mock (нема куди переходити)
        self.provider_ref = provider_ref
        # WayForPay: сторінку оплати відкриває POST підписаної форми, а не
        # перехід за посиланням. {"action": url, "fields": {...}} - фронтенд
        # будує форму й надсилає її.
        self.checkout: Optional[dict] = None


def _mock_create_intent(amount: Decimal, order_id: str) -> PaymentIntent:
    logger.info(f"[MOCK PAYMENT] Оплата {amount} UAH за замовлення {order_id} - автопідтверджено")
    return PaymentIntent(provider="mock", status="completed", provider_ref=f"mock-{order_id}")


def _wayforpay_signature(fields: list[str]) -> str:
    """HMAC_MD5 підпис за алгоритмом WayForPay: поля через ';', ключ - секрет продавця."""
    data = ";".join(str(f) for f in fields)
    return hmac.new(WFP_MERCHANT_SECRET.encode(), data.encode(), hashlib.md5).hexdigest()


BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
WFP_PAY_URL = "https://secure.wayforpay.com/pay"


def is_live() -> bool:
    """Чи справжні гроші. Без реквізитів WayForPay - тестова оплата."""
    return bool(WFP_MERCHANT_LOGIN and WFP_MERCHANT_SECRET)


def _wayforpay_create_intent(amount: Decimal, order_id: str, product_name: str,
                             return_url: Optional[str] = None, client_email: Optional[str] = None) -> PaymentIntent:
    """
    Оплата WayForPay (Purchase, «SimpleSignature»).

    Раніше тут поверталось посилання secure.wayforpay.com/pay?orderReference=...
    - так WayForPay НЕ працює: сторінку оплати відкриває лише POST форми з
    усіма полями платежу й підписом. Справжні гроші не списувались би
    ніколи. Тепер - повна підписана форма за документацією.

      returnUrl  - куди повернути клієнта. WayForPay повертає його POST-запитом,
                   який сторінка сайту прийняти не може, тож ведемо через
                   бекенд (/payments/return), а він перенаправляє на сайт.
      serviceUrl - куди WayForPay надсилає підтвердження (сервер-сервер).
    """
    order_date = int(time.time())
    amount_str = f"{amount:.2f}"
    signature = _wayforpay_signature([
        WFP_MERCHANT_LOGIN, WFP_DOMAIN, order_id, str(order_date),
        amount_str, "UAH", product_name, "1", amount_str,
    ])
    from urllib.parse import quote
    fields = {
        "merchantAccount": WFP_MERCHANT_LOGIN,
        "merchantAuthType": "SimpleSignature",
        "merchantDomainName": WFP_DOMAIN,
        "merchantTransactionSecureType": "AUTO",
        "merchantSignature": signature,
        "orderReference": order_id,
        "orderDate": str(order_date),
        "amount": amount_str,
        "currency": "UAH",
        "productName[]": product_name,
        "productPrice[]": amount_str,
        "productCount[]": "1",
        "language": "UA",
    }
    if BACKEND_PUBLIC_URL:
        fields["serviceUrl"] = f"{BACKEND_PUBLIC_URL}/payments/wayforpay/callback"
        if return_url:
            fields["returnUrl"] = f"{BACKEND_PUBLIC_URL}/payments/return?to={quote(return_url, safe='')}"
    else:
        logger.warning("BACKEND_PUBLIC_URL не задано - WayForPay не знатиме, куди надіслати підтвердження оплати")
    if client_email:
        fields["clientEmail"] = client_email
    intent = PaymentIntent(provider="wayforpay", status="pending", checkout_url=None, provider_ref=order_id)
    intent.checkout = {"action": WFP_PAY_URL, "fields": fields}
    return intent


def wayforpay_accept(order_id: str) -> dict:
    """
    Відповідь на підтвердження оплати. WayForPay чекає саме її (з підписом
    orderReference;status;time) - інакше вважає підтвердження недоставленим
    і надсилає його знову й знову.
    """
    now = int(time.time())
    return {"orderReference": order_id, "status": "accept", "time": now,
            "signature": _wayforpay_signature([order_id, "accept", str(now)])}


def create_payment_intent(amount: Decimal, order_id: str, product_name: str,
                          return_url: Optional[str] = None, client_email: Optional[str] = None) -> PaymentIntent:
    if is_live():
        return _wayforpay_create_intent(amount, order_id, product_name, return_url, client_email)
    # Mock-оплата підтверджує все одразу, без грошей. На продакшні (APP_ENV=production) без ключів
    # платіжки це дало б усім безкоштовну підписку, Радар і сертифікати - тому там вона заборонена,
    # якщо її прямо не ввімкнено (ALLOW_MOCK_PAYMENTS=1, наприклад для демонстрації).
    if APP_ENV == "production" and os.getenv("ALLOW_MOCK_PAYMENTS") != "1":
        from fastapi import HTTPException
        logger.error("Спроба оплати на продакшні без WFP_MERCHANT_LOGIN/WFP_MERCHANT_SECRET - відхилено")
        raise HTTPException(status_code=503, detail="Онлайн-оплата тимчасово недоступна")
    return _mock_create_intent(amount, order_id)


def verify_callback_signature(payload: dict) -> bool:
    """
    Перевірка підпису відповіді від платіжної системи.

    Без цієї перевірки будь-хто, знаючи адресу callback, міг би
    надіслати «оплату пройшла» і отримати підписку безкоштовно.
    Це не теоретична загроза: адреси callback легко вгадуються.

    У режимі без ключів (розробка, mock-оплата) пропускаємо - інакше
    неможливо перевірити сценарій локально. У продакшні ключі є
    завжди, тому реальний обхід так не зробиш.
    """
    if not WFP_MERCHANT_SECRET:
        # Без секрету підпис перевірити неможливо. Раніше такі запити ПРИЙМАЛИСЬ: якщо на продакшні
        # ключ забули, будь-хто міг надіслати «оплату пройшла» й отримати підписку безкоштовно. Тепер
        # відхиляємо; пропускаємо лише в тестах або за явним прапорцем ALLOW_UNSIGNED_CALLBACKS=1.
        # Mock-оплата колбеків не використовує (підтверджується одразу), тож їй це не заважає.
        if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("ALLOW_UNSIGNED_CALLBACKS") == "1":
            return True
        logger.warning("Колбек платіжки відхилено: WFP_MERCHANT_SECRET не заданий, підпис не перевірити")
        return False

    received = str(payload.get("merchantSignature") or "")
    if not received:
        return False

    # Порядок полів визначає WayForPay: змінювати не можна, інакше
    # підпис не зійдеться.
    fields = [
        payload.get("merchantAccount", ""),
        payload.get("orderReference", ""),
        payload.get("amount", ""),
        payload.get("currency", ""),
        payload.get("authCode", ""),
        payload.get("cardPan", ""),
        payload.get("transactionStatus", ""),
        payload.get("reasonCode", ""),
    ]
    expected = _wayforpay_signature(fields)

    # Порівняння сталого часу: звичайне == дозволяє з'ясувати підпис
    # посимвольно, вимірюючи час відповіді.
    return hmac.compare_digest(expected, received)
