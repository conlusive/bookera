"""Групи клієнтів як у Booksy: межі за днями від останнього візиту, без накладань і без «давно не були» для записаних наперед."""
from datetime import date, datetime, timedelta

import pytest

from app.services import client_groups as g

TODAY = date(2026, 10, 7)


def ago(days):
    return datetime.combine(TODAY, datetime.min.time()) - timedelta(days=days)


def grp(group, visits=1, last=None, nxt=None, created=400):
    return g.in_group(group, visits=visits, last_visit_at=ago(last) if last is not None else None,
                      next_visit_at=nxt, created_at=ago(created), today=TODAY)


def test_lapsed_ranges_do_not_overlap():
    for days in (10, 29, 30, 60, 89, 90, 200, 364, 365, 900):
        hits = [name for name in ("lapsed1m", "lapsed3m", "lapsed1y") if grp(name, last=days)]
        assert len(hits) == (0 if days < 30 else 1), (days, hits)
    assert grp("lapsed1m", last=30) and not grp("lapsed1m", last=29)
    assert grp("lapsed3m", last=90) and grp("lapsed1y", last=365)


def test_upcoming_visit_removes_from_lapsed_and_lost():
    soon = datetime.combine(TODAY, datetime.min.time()) + timedelta(days=3)
    for name in ("lapsed1m", "lapsed3m", "lapsed1y", "lost", "away_60"):
        assert not grp(name, last=120, nxt=soon), name


def test_lost_is_one_visit_who_never_came_back():
    assert grp("lost", visits=1, last=70)
    assert not grp("lost", visits=1, last=30), "ще не втрачений"
    assert not grp("lost", visits=2, last=200), "двічі був - це «не були», а не «втрачений»"
    assert not grp("lost", visits=0, last=None), "без візитів - не втрачений"


def test_regular_needs_three_visits_and_recent_one():
    assert grp("regular", visits=3, last=20)
    assert not grp("regular", visits=2, last=20)
    assert not grp("regular", visits=5, last=200), "давно не ходить - уже не регулярний"
    soon = datetime.combine(TODAY, datetime.min.time()) + timedelta(days=1)
    assert grp("regular", visits=5, last=200, nxt=soon), "записаний наперед - ходить"


def test_new_is_recently_added_with_at_most_one_visit():
    assert grp("new", visits=0, last=None, created=5)
    assert grp("new", visits=1, last=3, created=29)
    assert not grp("new", visits=1, last=3, created=45)
    assert not grp("new", visits=2, last=3, created=5)


def test_custom_threshold_and_validation():
    assert grp("away_45", last=45) and not grp("away_45", last=44)
    assert g.away_days("away_45") == 45 and g.away_days("away_5") is None and g.away_days("away_99999") is None
    assert g.is_known("all") and g.is_known("lost") and g.is_known("away_90") and not g.is_known("drop table")


@pytest.mark.asyncio
async def test_campaign_rejects_unknown_audience(client, auth_headers):
    h = auth_headers("grp-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Grp", "city": "Львів"}, headers=h)).json()["id"]
    r = await client.post("/crm/campaigns", json={"business_id": bid, "subject": "Привіт", "message": "Давно не бачились, чекаємо!", "audience": "wat"}, headers=h)
    assert r.status_code == 422
    counts = (await client.get("/crm/campaigns/audience", params={"business_id": bid}, headers=h)).json()
    for key in ("all", "regular", "lapsed", "new", "lapsed1m", "lapsed3m", "lapsed1y", "lost"):
        assert key in counts
