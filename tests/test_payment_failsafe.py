from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.services import payments as pay


def test_unsigned_callbacks_are_rejected_without_secret(monkeypatch):
    monkeypatch.setattr(pay, "WFP_MERCHANT_SECRET", "")
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("ALLOW_UNSIGNED_CALLBACKS", raising=False)
    assert pay.verify_callback_signature({"orderReference": "x", "transactionStatus": "Approved"}) is False
    monkeypatch.setenv("ALLOW_UNSIGNED_CALLBACKS", "1")           # лише явно (локальна розробка)
    assert pay.verify_callback_signature({"orderReference": "x"}) is True


def test_mock_payments_are_blocked_in_production(monkeypatch):
    monkeypatch.setattr(pay, "WFP_MERCHANT_LOGIN", "")
    monkeypatch.setattr(pay, "WFP_MERCHANT_SECRET", "")
    monkeypatch.setattr(pay, "APP_ENV", "production")
    monkeypatch.delenv("ALLOW_MOCK_PAYMENTS", raising=False)
    with pytest.raises(HTTPException) as e:
        pay.create_payment_intent(Decimal("100"), "o-1", "Підписка")
    assert e.value.status_code == 503

    monkeypatch.setenv("ALLOW_MOCK_PAYMENTS", "1")                # свідомий вибір (демо)
    assert pay.create_payment_intent(Decimal("100"), "o-2", "Підписка").status == "completed"
    monkeypatch.setattr(pay, "APP_ENV", "development")            # розробка - як раніше
    monkeypatch.delenv("ALLOW_MOCK_PAYMENTS")
    assert pay.create_payment_intent(Decimal("100"), "o-3", "Підписка").status == "completed"
