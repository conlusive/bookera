"""
Інструменти майстра.

  Запити до салону (графік, відпустка/лікарняний):
    POST   /work/me/requests                         - надіслати
    GET    /work/me/requests?business_id             - мої запити
    DELETE /work/me/requests/{id}                    - відкликати, поки не розглянуто
    GET    /crm/businesses/{bid}/staff-requests      - вхідні для власника
    POST   /crm/businesses/{bid}/staff-requests/{id}/decide - погодити чи відхилити

  Мої клієнти:
    GET    /work/me/clients?business_id

  Портфоліо:
    GET/POST /work/me/portfolio, DELETE /work/me/portfolio/{id}
    GET    /public/businesses/{bid}/portfolio        - для сторінки салону
"""
import re
from datetime import date, datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, assert_business_admin, get_current_user
from app.core.database import get_db
from app.core.email import send_staff_notice
from app.core.time_utils import local_now, utc_now
from app.models import Appointment, Business, Service, StaffMembership, User
from app.models.client import Client
from app.models.master_tools import PortfolioItem, StaffRequest

router = APIRouter(tags=["Master tools"])

DAYS = ["Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота", "Неділя"]
MONTHS_GEN = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]


def _human_date(d: date) -> str:
    return f"{d.day} {MONTHS_GEN[d.month - 1]}"


async def _membership(db: AsyncSession, user_id: str, business_id: int) -> StaffMembership:
    m = (await db.execute(select(StaffMembership).where(
        StaffMembership.user_id == user_id, StaffMembership.business_id == business_id,
        StaffMembership.is_active.is_(True),
    ))).scalars().first()
    if not m:
        raise HTTPException(status_code=403, detail="Ви не працюєте в цьому закладі")
    return m


async def _owner_email(db: AsyncSession, business: Business) -> Optional[str]:
    if business.email:
        return business.email
    if business.owner_id:
        owner = (await db.execute(select(User).where(User.id == str(business.owner_id)))).scalars().first()
        return owner.email if owner else None
    return None


def _clean_shifts(shifts: list) -> list:
    if not isinstance(shifts, list) or len(shifts) != 7:
        raise HTTPException(status_code=400, detail="Графік - сім днів від понеділка")
    out = []
    for i, d in enumerate(shifts):
        start, end = str(d.get("start", "09:00"))[:5], str(d.get("end", "20:00"))[:5]
        if not re.match(r"^\d{2}:\d{2}$", start) or not re.match(r"^\d{2}:\d{2}$", end):
            raise HTTPException(status_code=400, detail="Час у форматі ГГ:ХХ")
        active = bool(d.get("active"))
        if active and end <= start:
            raise HTTPException(status_code=400, detail=f"{DAYS[i]}: кінець зміни має бути пізніше за початок")
        out.append({"day": DAYS[i], "active": active, "start": start, "end": end})
    return out


def _request_out(r: StaffRequest, name: Optional[str] = None, conflicts: Optional[list] = None) -> dict:
    return {
        "id": r.id, "kind": r.kind, "status": r.status, "payload": r.payload,
        "comment": r.comment, "response_note": r.response_note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "decided_at": r.decided_at.isoformat() if r.decided_at else None,
        "user_id": r.user_id, "staff_name": name,
        "stage": r.stage, "escalation_note": r.escalation_note,
        **({"conflicts": conflicts} if conflicts is not None else {}),
    }


async def _conflicts(db: AsyncSession, r: StaffRequest) -> list:
    """Записи клієнтів, що потрапляють у відпустку: їх доведеться перенести."""
    if r.kind != "time_off":
        return []
    d_from = date.fromisoformat(r.payload["date_from"])
    d_to = date.fromisoformat(r.payload["date_to"])
    rows = (await db.execute(select(Appointment).where(
        Appointment.business_id == r.business_id, Appointment.master_id == r.user_id,
        Appointment.status.in_(["confirmed", "pending_approval"]),
        Appointment.start_time >= datetime.combine(d_from, datetime.min.time()),
        Appointment.start_time < datetime.combine(d_to + timedelta(days=1), datetime.min.time()),
    ).order_by(Appointment.start_time))).scalars().all()
    return [{"id": a.id, "start_time": a.start_time.isoformat(), "client_name": a.client_name, "client_phone": a.client_phone} for a in rows]


# ---------------------------------------------------------------- Запити

def _kind_label(r: StaffRequest) -> str:
    if r.kind == "schedule":
        return "зміна графіка"
    if r.kind == "access":
        from app.core.auth import SECTION_LABELS
        parts = [SECTION_LABELS.get(s, s) for s in (r.payload or {}).get("sections", [])]
        if (r.payload or {}).get("role") == "admin":
            parts.insert(0, "підвищення до адміністратора")
        return "доступ: " + ", ".join(parts) if parts else "доступ"
    return REASON_LABEL.get((r.payload or {}).get("reason"), "відпустка").lower()


async def _handlers_emails(db: AsyncSession, business: Business, stage: str) -> list:
    """Кому лист про новий чи переданий запит: адміністраторам або власнику."""
    if stage == "admin":
        rows = (await db.execute(
            select(User.email).join(StaffMembership, StaffMembership.user_id == User.id).where(
                StaffMembership.business_id == business.id, StaffMembership.role == "admin",
                StaffMembership.is_active.is_(True), User.email.isnot(None),
            ))).scalars().all()
        if rows:
            return list(dict.fromkeys(e.lower() for e in rows))
    owner = await _owner_email(db, business)
    return [owner] if owner else []


async def _is_business_owner(db: AsyncSession, business_id: int, user_id: str) -> bool:
    biz = await db.get(Business, business_id)
    return bool(biz and str(biz.owner_id) == str(user_id))



class RequestIn(BaseModel):
    business_id: int
    kind: Literal["schedule", "time_off", "access"]
    shifts: Optional[list] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    reason: Optional[Literal["vacation", "sick", "other"]] = "vacation"
    comment: Optional[str] = Field(default=None, max_length=500)
    # access: які розділи відкрити й чи підвищити до адміністратора
    sections: Optional[list] = None
    role: Optional[Literal["admin"]] = None


REASON_LABEL = {"vacation": "Відпустка", "sick": "Лікарняний", "other": "Особисті справи"}


@router.post("/work/me/requests")
async def create_request(
    payload: RequestIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    await _membership(db, me, payload.business_id)

    if payload.kind == "schedule":
        data = {"shifts": _clean_shifts(payload.shifts or [])}
    elif payload.kind == "access":
        from app.core.auth import SECTIONS
        sections = [s for s in (payload.sections or []) if s in SECTIONS]
        if not sections and not payload.role:
            raise HTTPException(status_code=400, detail="Оберіть розділ чи підвищення")
        data = {"sections": sections, "role": payload.role}
    else:
        today = local_now().date()
        if not payload.date_from or not payload.date_to:
            raise HTTPException(status_code=400, detail="Вкажіть дати")
        if payload.date_from < today:
            raise HTTPException(status_code=400, detail="Дата початку - не раніше сьогодні")
        if payload.date_to < payload.date_from:
            raise HTTPException(status_code=400, detail="Дата кінця має бути не раніше за початок")
        if (payload.date_to - payload.date_from).days > 60:
            raise HTTPException(status_code=400, detail="Не більше 60 днів за один запит")
        data = {"date_from": payload.date_from.isoformat(), "date_to": payload.date_to.isoformat(), "reason": payload.reason or "vacation"}

    pending = (await db.execute(select(StaffRequest).where(
        StaffRequest.business_id == payload.business_id, StaffRequest.user_id == me,
        StaffRequest.kind == payload.kind, StaffRequest.status == "pending",
    ))).scalars().first()
    if pending and payload.kind == "schedule":
        raise HTTPException(status_code=409, detail="Попередній запит на зміну графіка ще не розглянуто")

    # Хто розглядає - ієрархія:
    #   майстер, графік чи відпустка -> адміністратор (якщо він є в салоні);
    #     той вирішує сам або передає власнику
    #   запит адміністратора, запит на доступ -> одразу власнику: доступи
    #     роздає лише він, а адміністратор не розглядає запити про себе
    my_role = (await _membership(db, me, payload.business_id)).role
    stage = "owner"
    if payload.kind in ("schedule", "time_off") and my_role not in ("admin", "business_owner", "owner"):
        has_admin = (await db.execute(select(StaffMembership).where(
            StaffMembership.business_id == payload.business_id, StaffMembership.role == "admin",
            StaffMembership.is_active.is_(True), StaffMembership.user_id != me,
        ))).scalars().first()
        if has_admin:
            stage = "admin"

    req = StaffRequest(business_id=payload.business_id, user_id=me, kind=payload.kind, status="pending", stage=stage,
                       payload=data, comment=(payload.comment or "").strip() or None)
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # Власнику - лист: запит без реакції гірший за відсутність запиту.
    business = await db.get(Business, payload.business_id)
    user = (await db.execute(select(User).where(User.id == me))).scalars().first()
    who_name = (user.full_name if user and user.full_name else None) or (user.email if user else "Майстер")
    from app.services.audit import record
    await record(db, payload.business_id, me, "requests", "request_created",
                 f"{who_name}: запит - {_kind_label(req)}", {"request_id": req.id})
    await db.commit()
    recipients = await _handlers_emails(db, business, stage) if business else []
    for to in recipients:
        who = (user.full_name if user and user.full_name else None) or (user.email if user else "Майстер")
        if req.kind == "schedule":
            rows = [("Від", who, False), ("Що", "Зміна графіка", True)]
        elif req.kind == "access":
            rows = [("Від", who, False), ("Що", _kind_label(req), True)]
        else:
            d1, d2 = date.fromisoformat(data["date_from"]), date.fromisoformat(data["date_to"])
            rows = [("Від", who, False), ("Що", REASON_LABEL.get(data["reason"], "Відпустка"), False),
                    ("Коли", f"{_human_date(d1)} – {_human_date(d2)}", True)]
        if req.comment:
            rows.append(("Коментар", req.comment, False))
        background_tasks.add_task(send_staff_notice, to, business.name, "Новий запит від команди", rows,
                                  "Погодити чи відхилити - у кабінеті, розділ «Команда».")
    return _request_out(req)


@router.get("/work/me/requests")
async def my_requests(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    await _membership(db, me, business_id)
    rows = (await db.execute(select(StaffRequest).where(
        StaffRequest.business_id == business_id, StaffRequest.user_id == me,
    ).order_by(StaffRequest.created_at.desc()).limit(50))).scalars().all()
    return [_request_out(r) for r in rows]


@router.delete("/work/me/requests/{request_id}", status_code=204)
async def cancel_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    r = await db.get(StaffRequest, request_id)
    if not r or r.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Запит не знайдено")
    if r.status != "pending":
        raise HTTPException(status_code=409, detail="Запит уже розглянуто")
    r.status = "cancelled"
    await db.commit()


@router.get("/crm/businesses/{business_id}/staff-requests")
async def business_requests(
    business_id: int,
    status: Optional[str] = Query("pending"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_admin(db, current_user, business_id)
    q = select(StaffRequest, User).join(User, User.id == StaffRequest.user_id).where(StaffRequest.business_id == business_id)
    # Адміністратор бачить запити свого рівня й не свої; власник - усі,
    # і ті, що адміністратор передав йому, позначені.
    if not await _is_business_owner(db, business_id, str(current_user.id)):
        q = q.where(StaffRequest.stage == "admin", StaffRequest.user_id != str(current_user.id))
    if status and status != "all":
        q = q.where(StaffRequest.status == status)
    rows = (await db.execute(q.order_by(StaffRequest.created_at.desc()).limit(100))).all()
    out = []
    for r, u in rows:
        out.append(_request_out(r, u.full_name or u.email, await _conflicts(db, r) if r.status == "pending" else None))
    return out


class DecideIn(BaseModel):
    approve: bool
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/crm/businesses/{business_id}/staff-requests/{request_id}/decide")
async def decide_request(
    business_id: int,
    request_id: int,
    payload: DecideIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Погодити чи відхилити. Погоджене застосовується одразу:
      графік   - стає графіком майстра в цьому закладі
      відпустка - кожен день діапазону закривається для запису
    Записи клієнтів, що потрапили у відпустку, повертаються у відповіді -
    їх треба перенести; сервер їх сам не скасовує.
    """
    await assert_business_admin(db, current_user, business_id)
    r = await db.get(StaffRequest, request_id)
    if not r or r.business_id != business_id:
        raise HTTPException(status_code=404, detail="Запит не знайдено")
    if r.status != "pending":
        raise HTTPException(status_code=409, detail="Запит уже розглянуто")
    is_owner = await _is_business_owner(db, business_id, str(current_user.id))
    if not is_owner:
        # Адміністратор вирішує лише запити свого рівня, не про доступи
        # і не власні - інакше він міг би погодити сам собі.
        if r.stage != "admin" or r.kind == "access" or r.user_id == str(current_user.id):
            raise HTTPException(status_code=403, detail="Цей запит розглядає власник")

    conflicts = await _conflicts(db, r)
    if payload.approve:
        if r.kind == "schedule":
            m = await _membership(db, r.user_id, business_id)
            m.shifts = r.payload["shifts"]
        elif r.kind == "access":
            from app.api.crm.access import apply_access
            await apply_access(db, business_id, r.user_id, str(current_user.id),
                               (r.payload or {}).get("role"), {s: True for s in (r.payload or {}).get("sections", [])})
        else:
            d = date.fromisoformat(r.payload["date_from"])
            end = date.fromisoformat(r.payload["date_to"])
            title = REASON_LABEL.get(r.payload.get("reason"), "Відпустка")
            while d <= end:
                # Постійні блоки (blocked без терміну дії) - так само, як
                # «Перерва» з календаря: клієнти на цей день не запишуться.
                #
                # Блоки ОБХОДЯТЬ наявні записи: база не дає записам і блокам
                # одного майстра накладатись (no_overlapping_bookings), і це
                # правильно. Запис клієнта лишається - власник бачить його в
                # conflicts і переносить; решта дня закрита.
                day_start = datetime.combine(d, datetime.min.time())
                day_end = day_start + timedelta(hours=23, minutes=59)
                busy = (await db.execute(select(Appointment).where(
                    Appointment.master_id == r.user_id, Appointment.business_id == business_id,
                    Appointment.status.in_(["confirmed", "blocked"]),
                    Appointment.start_time < day_end, Appointment.end_time > day_start,
                ).order_by(Appointment.start_time))).scalars().all()
                cursor = day_start
                for b in busy:
                    if b.start_time > cursor:
                        db.add(Appointment(business_id=business_id, master_id=r.user_id, status="blocked", source="crm",
                                           start_time=cursor, end_time=b.start_time, client_name=title, notes=title))
                    cursor = max(cursor, b.end_time)
                if cursor < day_end:
                    db.add(Appointment(business_id=business_id, master_id=r.user_id, status="blocked", source="crm",
                                       start_time=cursor, end_time=day_end, client_name=title, notes=title))
                d += timedelta(days=1)
    r.status = "approved" if payload.approve else "declined"
    r.response_note = (payload.note or "").strip() or None
    r.decided_by = str(current_user.id)
    r.decided_at = utc_now()
    from app.services.audit import record
    staff_u = (await db.execute(select(User).where(User.id == r.user_id))).scalars().first()
    staff_name = (staff_u.full_name if staff_u and staff_u.full_name else None) or (staff_u.email if staff_u else "працівник")
    await record(db, business_id, str(current_user.id), "requests", "request_decided",
                 f"{'Погоджено' if payload.approve else 'Відхилено'}: {staff_name} - {_kind_label(r)}", {"request_id": r.id})
    await db.commit()

    master = (await db.execute(select(User).where(User.id == r.user_id))).scalars().first()
    business = await db.get(Business, business_id)
    if master and master.email and business:
        what = {"schedule": "зміну графіка", "access": "доступ"}.get(r.kind) or REASON_LABEL.get(r.payload.get("reason"), "відпустку").lower()
        title = f"Запит на {what} {'погоджено' if payload.approve else 'відхилено'}"
        rows = [("Рішення", "Погоджено" if payload.approve else "Відхилено", True)]
        if r.kind == "time_off":
            rows.append(("Дати", f"{_human_date(date.fromisoformat(r.payload['date_from']))} – {_human_date(date.fromisoformat(r.payload['date_to']))}", False))
        if r.response_note:
            rows.append(("Коментар", r.response_note, False))
        background_tasks.add_task(send_staff_notice, master.email, business.name, title, rows, "")

    return _request_out(r, conflicts=conflicts)


class EscalateIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/crm/businesses/{business_id}/staff-requests/{request_id}/escalate")
async def escalate_request(
    business_id: int,
    request_id: int,
    payload: EscalateIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Адміністратор передає запит власнику - «це мені не вирішити»."""
    await assert_business_admin(db, current_user, business_id)
    r = await db.get(StaffRequest, request_id)
    if not r or r.business_id != business_id:
        raise HTTPException(status_code=404, detail="Запит не знайдено")
    if r.status != "pending" or r.stage != "admin":
        raise HTTPException(status_code=409, detail="Цей запит уже не на розгляді адміністратора")
    r.stage = "owner"
    # Порожній рядок, а не None: так видно, що запит ПЕРЕДАНО, навіть без коментаря.
    r.escalation_note = (payload.note or "").strip()
    from app.services.audit import record
    await record(db, business_id, str(current_user.id), "requests", "request_escalated",
                 f"Передано власнику: {_kind_label(r)}" + (f" - «{r.escalation_note}»" if r.escalation_note else ""),
                 {"request_id": r.id})
    await db.commit()
    business = await db.get(Business, business_id)
    to = await _owner_email(db, business) if business else None
    if to:
        rows = [("Що", _kind_label(r).capitalize(), True)]
        if r.escalation_note:
            rows.append(("Від адміністратора", r.escalation_note, False))
        background_tasks.add_task(send_staff_notice, to, business.name, "Адміністратор передав вам запит", rows,
                                  "Розгляньте у кабінеті, розділ «Команда».")
    return _request_out(r)


# ---------------------------------------------------------------- Мої клієнти

def _tail(phone: Optional[str]) -> Optional[str]:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return digits[-9:] if len(digits) >= 9 else None


@router.get("/work/me/clients")
async def my_clients(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Клієнти, що ходять саме до мене: візити, коли востаннє, коли наступний,
    скільки витратили, нотатки й формули з картки клієнта. Плюс підказки:
    скоро день народження, давно не приходив.
    """
    me = str(current_user.id)
    await _membership(db, me, business_id)
    now = local_now().replace(tzinfo=None)
    apps = (await db.execute(select(Appointment).where(
        Appointment.business_id == business_id, Appointment.master_id == me,
        Appointment.status.in_(["completed", "confirmed", "pending_approval"]),
    ).order_by(Appointment.start_time))).scalars().all()

    groups: dict = {}
    for a in apps:
        key = _tail(a.client_phone) or (a.client_email or "").strip().lower() or (a.client_name or "").strip().lower()
        if not key:
            continue
        g = groups.setdefault(key, {"name": a.client_name, "phone": a.client_phone, "email": a.client_email,
                                    "visits": 0, "spent": 0.0, "last_visit": None, "next_visit": None, "last_service_id": None})
        g["name"] = a.client_name or g["name"]
        g["phone"] = a.client_phone or g["phone"]
        g["email"] = a.client_email or g["email"]
        if a.status == "completed":
            g["visits"] += 1
            g["spent"] += float(a.price or 0)
            g["last_visit"] = a.start_time
            g["last_service_id"] = a.service_id
        elif a.start_time > now and g["next_visit"] is None:
            g["next_visit"] = a.start_time

    # Картки клієнтів закладу - день народження, формули, нотатки
    cards = (await db.execute(select(Client).where(Client.business_id == business_id))).scalars().all()
    by_tail = {_tail(c.phone): c for c in cards if _tail(c.phone)}
    by_email = {(c.email or "").lower(): c for c in cards if c.email}
    srv_ids = {g["last_service_id"] for g in groups.values() if g["last_service_id"]}
    srv = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()} if srv_ids else {}

    today = now.date()
    out = []
    for g in groups.values():
        c = by_tail.get(_tail(g["phone"])) or by_email.get((g["email"] or "").lower())
        birthday_in = None
        if c and c.birthday:
            try:
                nxt = c.birthday.replace(year=today.year)
            except ValueError:
                nxt = date(today.year, 3, 1)
            if nxt < today:
                try:
                    nxt = c.birthday.replace(year=today.year + 1)
                except ValueError:
                    nxt = date(today.year + 1, 3, 1)
            birthday_in = (nxt - today).days
        days_since = (today - g["last_visit"].date()).days if g["last_visit"] else None
        out.append({
            "name": g["name"] or "Клієнт", "phone": g["phone"], "email": g["email"],
            "visits": g["visits"], "spent": round(g["spent"], 2),
            "last_visit": g["last_visit"].isoformat() if g["last_visit"] else None,
            "next_visit": g["next_visit"].isoformat() if g["next_visit"] else None,
            "last_service": srv.get(g["last_service_id"]),
            "days_since": days_since,
            "birthday_in": birthday_in,
            "birthday": c.birthday.isoformat() if c and c.birthday else None,
            "notes": c.notes if c else None,
            "formulas": c.formulas if c else None,
            "instagram": c.instagram if c else None,
            # Давно не був: понад 45 днів і наступного запису немає
            "lapsed": bool(days_since is not None and days_since >= 45 and not g["next_visit"]),
        })
    out.sort(key=lambda x: (x["next_visit"] is None, x["next_visit"] or "", -(x["visits"])))
    return out


# ---------------------------------------------------------------- Портфоліо

class PortfolioIn(BaseModel):
    business_id: int
    image_url: str = Field(max_length=1000)
    caption: Optional[str] = Field(default=None, max_length=140)


@router.get("/work/me/portfolio")
async def my_portfolio(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    await _membership(db, me, business_id)
    rows = (await db.execute(select(PortfolioItem).where(
        PortfolioItem.business_id == business_id, PortfolioItem.user_id == me,
    ).order_by(PortfolioItem.created_at.desc()))).scalars().all()
    return [{"id": p.id, "image_url": p.image_url, "caption": p.caption} for p in rows]


@router.post("/work/me/portfolio")
async def add_portfolio(
    payload: PortfolioIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    me = str(current_user.id)
    await _membership(db, me, payload.business_id)
    if not payload.image_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Невірна адреса фото")
    count = (await db.execute(select(func.count(PortfolioItem.id)).where(
        PortfolioItem.business_id == payload.business_id, PortfolioItem.user_id == me))).scalar() or 0
    if count >= 30:
        raise HTTPException(status_code=409, detail="Не більше 30 робіт - приберіть старіші")
    item = PortfolioItem(business_id=payload.business_id, user_id=me, image_url=payload.image_url,
                         caption=(payload.caption or "").strip() or None)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "image_url": item.image_url, "caption": item.caption}


@router.delete("/work/me/portfolio/{item_id}", status_code=204)
async def delete_portfolio(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    item = await db.get(PortfolioItem, item_id)
    if not item or item.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Не знайдено")
    await db.delete(item)
    await db.commit()


@router.get("/public/businesses/{business_id}/portfolio")
async def public_portfolio(business_id: int, db: AsyncSession = Depends(get_db)):
    """Роботи майстрів закладу - для сторінки салону, по майстрах."""
    rows = (await db.execute(
        select(PortfolioItem, User).join(User, User.id == PortfolioItem.user_id)
        .join(StaffMembership, (StaffMembership.user_id == PortfolioItem.user_id) & (StaffMembership.business_id == business_id))
        .where(PortfolioItem.business_id == business_id, StaffMembership.is_active.is_(True))
        .order_by(PortfolioItem.created_at.desc())
    )).all()
    masters: dict = {}
    for p, u in rows:
        m = masters.setdefault(u.id, {"user_id": u.id, "name": u.full_name or "Майстер", "avatar_url": u.avatar_url, "items": []})
        m["items"].append({"id": p.id, "image_url": p.image_url, "caption": p.caption})
    return list(masters.values())
