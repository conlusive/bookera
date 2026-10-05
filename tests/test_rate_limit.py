import pytest

from app.core import rate_limit as rl


@pytest.mark.asyncio
async def test_public_endpoint_is_limited_even_without_redis(client, monkeypatch):
    """Раніше без Redis ліміти мовчки вимикались. Тепер діє лічильник у пам'яті."""
    monkeypatch.setenv("RATE_LIMIT_IN_TESTS", "1")
    monkeypatch.setattr(rl, "REDIS_URL", "")
    rl._mem.clear()

    payload = {"lat": 49.84, "lng": 24.03, "business_ids": [1]}
    codes = [(await client.post("/businesses/distances", json=payload)).status_code for _ in range(62)]
    assert codes[:60] == [200] * 60, codes[:60]
    assert 429 in codes[60:], codes[60:]
    rl._mem.clear()


def test_tokens_equal_is_strict():
    assert rl.tokens_equal("abc", "abc") is True
    assert rl.tokens_equal("abc", "abd") is False
    assert rl.tokens_equal("", "") is False
    assert rl.tokens_equal(None, "x") is False


class _Req:
    def __init__(self, xff=None, host="10.0.0.9"):
        self.headers = {"x-forwarded-for": xff} if xff else {}
        self.client = type("C", (), {"host": host})()


def test_client_ip_trusts_proxy_headers_only_when_configured(monkeypatch):
    monkeypatch.setattr(rl, "TRUSTED_PROXY_HOPS", 0)
    assert rl.client_ip(_Req("1.2.3.4, 5.6.7.8")) == "10.0.0.9"        # не довіряємо підробленому заголовку
    monkeypatch.setattr(rl, "TRUSTED_PROXY_HOPS", 1)
    # клієнт міг дописати свою підробку першою - беремо адресу, додану довіреним проксі (останню)
    assert rl.client_ip(_Req("6.6.6.6, 203.0.113.7")) == "203.0.113.7"
    assert rl.client_ip(_Req(None)) == "10.0.0.9"
