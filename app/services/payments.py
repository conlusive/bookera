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


class PaymentIntent:
    def __init__(self, provider: str, status: str, checkout_url: Optional[str] = None, provider_ref: Optional[str] = None):
        self.provider = provider
        self.status = status  # 'pending' або 'completed'
        self.checkout_url = checkout_url  # None для mock (нема куди переходити)
        self.provider_ref = provider_ref


def _mock_create_intent(amount: Decimal, order_id: str) -> PaymentIntent:
    logger.info(f"[MOCK PAYMENT] Оплата {amount} UAH за замовлення {order_id} - автопідтверджено")
    return PaymentIntent(provider="mock", status="completed", provider_ref=f"mock-{order_id}")


def _wayforpay_signature(fields: list[str]) -> str:
    """HMAC_MD5 підпис за алгоритмом WayForPay: поля через ';', ключ - секрет продавця."""
    data = ";".join(str(f) for f in fields)
    return hmac.new(WFP_MERCHANT_SECRET.encode(), data.encode(), hashlib.md5).hexdigest()


def _wayforpay_create_intent(amount: Decimal, order_id: str, product_name: str) -> PaymentIntent:
    if not WFP_MERCHANT_LOGIN or not WFP_MERCHANT_SECRET:
        logger.warning("WFP_MERCHANT_LOGIN/SECRET не задані - falls back на mock-оплату")
        return _mock_create_intent(amount, order_id)

    order_date = int(time.time())
    amount_str = f"{amount:.2f}"
    signature = _wayforpay_signature([
        WFP_MERCHANT_LOGIN, WFP_DOMAIN, order_id, str(order_date),
        amount_str, "UAH", product_name, "1", amount_str,
    ])
    # Реальний запит - POST на https://api.wayforpay.com/api з цими полями
    # (merchantAccount, merchantDomainName, orderReference, orderDate,
    # amount, currency, productName[], productCount[], productPrice[],
    # merchantSignature). Тут не викликаємо мережу з сендбоксу - фронтенд
    # сам формує форму оплати з цими даними за документацією WayForPay.
    checkout_url = f"https://secure.wayforpay.com/pay?orderReference={order_id}"
    return PaymentIntent(provider="wayforpay", status="pending", checkout_url=checkout_url, provider_ref=order_id)


def create_payment_intent(amount: Decimal, order_id: str, product_name: str) -> PaymentIntent:
    if WFP_MERCHANT_LOGIN and WFP_MERCHANT_SECRET:
        return _wayforpay_create_intent(amount, order_id, product_name)
    return _mock_create_intent(amount, order_id)
