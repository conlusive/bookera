from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import has_section, is_limited_to_own_schedule, CurrentUser, assert_business_access, get_current_user
from app.models import Client, ClientLink, Business, PointsLedgerEntry, Appointment
from app.models.appointment import Appointment
from app.services.monetization import award_points_for_new_client
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.services.client_stats import apply_stats, client_stats, phone_tail

router = APIRouter(prefix="/crm/clients", tags=["CRM - Clients"])


async def _load_with_links(db: AsyncSession, client_id: int) -> Optional[Client]:
    result = await db.execute(
        select(Client).where(Client.id == client_id).options(selectinload(Client.links))
    )
    return result.scalars().first()



async def _with_stats(db: AsyncSession, business_id: int, clients) -> List[ClientResponse]:
    """Відповідь зі статистикою, порахованою із записів."""
    clients = list(clients)
    stats = await client_stats(db, business_id, clients)
    return [apply_stats(ClientResponse.model_validate(cl, from_attributes=True), stats.get(cl.id)) for cl in clients]


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    business_id: int = Query(...),
    search: Optional[str] = Query(None, description="Пошук за іменем або телефоном"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, business_id)

    stmt = select(Client).where(Client.business_id == business_id).options(selectinload(Client.links))

    # Майстер бачить лише СВОЇХ клієнтів - тих, кого справді обслуговував.
    #
    # База клієнтів - головний актив закладу. Майстер, який іде,
    # не має вивантажити контакти всіх відвідувачів, зокрема тих,
    # кого ніколи не бачив.
    # Доступ «Всі клієнти салону» (власник вмикає окремо) знімає обмеження.
    if not await has_section(db, current_user, business_id, "clients"):
        own_clients = select(Appointment.client_id).where(
            Appointment.business_id == business_id,
            Appointment.master_id == str(current_user.id),
            Appointment.client_id.isnot(None),
        )
        stmt = stmt.where(Client.id.in_(own_clients))
    if search:
        like = f"%{search.lower()}%"
        from sqlalchemy import or_, func
        stmt = stmt.where(or_(func.lower(Client.name).like(like), Client.phone.like(like)))
    stmt = stmt.order_by(Client.last_visit_at.desc().nullslast()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return await _with_stats(db, business_id, result.scalars().unique().all())



@router.get("/lookup")
async def lookup_client(
    business_id: int = Query(...),
    email: str = Query(..., min_length=3, max_length=200),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Автозаповнення нового клієнта за поштою.

    Приватність: особисті дані (телефон, дата народження) віддаємо ЛИШЕ
    якщо людина вже записувалась у ЦЕЙ заклад. Інакше будь-який салон міг
    би дізнатись телефон і день народження незнайомої людини, вгадавши її
    пошту. Без такого звʼязку - лише «є акаунт BookEra».
    """
    from sqlalchemy import func, or_
    from app.models import User
    await assert_business_access(db, current_user, business_id)
    e = email.strip().lower()
    existing = (await db.execute(select(Client).where(
        Client.business_id == business_id, func.lower(Client.email) == e,
    ))).scalars().first()
    if existing:
        return {"existing_client": {"id": existing.id, "name": existing.name}}
    user = (await db.execute(select(User).where(func.lower(User.email) == e))).scalars().first()
    if not user:
        return {"found": False}
    conds = [func.lower(Appointment.client_email) == e]
    tail = phone_tail(user.phone)
    if tail:
        conds.append(Appointment.client_phone.like(f"%{tail}"))
    related = (await db.execute(select(Appointment.id).where(
        Appointment.business_id == business_id, or_(*conds),
    ).limit(1))).first()
    if not related:
        return {"found": True, "shared": False}
    return {
        "found": True, "shared": True,
        "name": user.full_name, "phone": user.phone,
        "birthday": user.birthday.isoformat() if user.birthday else None,
    }


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, client_in.business_id)
    # Той самий номер - той самий клієнт. Інакше візити розпадались на дві
    # картки, і жодна не показувала правди.
    tail = phone_tail(client_in.phone)
    if tail:
        same = (await db.execute(select(Client).where(
            Client.business_id == client_in.business_id, Client.phone.like(f"%{tail}"),
        ))).scalars().first()
        if same:
            raise HTTPException(status_code=409, detail=f"Клієнт із цим номером уже є: {same.name}")
    client = Client(**client_in.model_dump())
    db.add(client)
    await db.flush()

    if client_in.phone:
        biz_res = await db.execute(select(Business).where(Business.id == client_in.business_id))
        business = biz_res.scalars().first()
        if business:
            await award_points_for_new_client(db, business, client_in.phone, client.id)

    await db.commit()
    _cl = await _load_with_links(db, client.id)
    return (await _with_stats(db, _cl.business_id, [_cl]))[0]


async def _get_owned_client(db: AsyncSession, current_user: CurrentUser, client_id: int) -> Client:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клієнта не знайдено")
    await assert_business_access(db, current_user, client.business_id)
    return client


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    client = await _get_owned_client(db, current_user, client_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await db.commit()
    _cl = await _load_with_links(db, client_id)
    return (await _with_stats(db, _cl.business_id, [_cl]))[0]



@router.get("/{client_id}/history")
async def client_history(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Справжня історія клієнта: візити з датою, послугою, майстром, статусом,
    ціною, чайовими й оцінкою. Раніше вкладка «Історія» показувала заготовку
    «Візит успішно завершено. Послуга виконана. Оплачено» без жодних даних.
    """
    from app.models import Service, User
    from app.models.extras import Review
    from sqlalchemy import and_, or_
    client = await _get_owned_client(db, current_user, client_id)
    tail = phone_tail(client.phone)
    cond = Appointment.client_id == client.id
    if tail:
        cond = or_(cond, and_(Appointment.client_id.is_(None), Appointment.client_phone.like(f"%{tail}")))
    rows = (await db.execute(
        select(Appointment).where(Appointment.business_id == client.business_id, cond,
                                  Appointment.status.notin_(["blocked"]))
        .order_by(Appointment.start_time.desc()).limit(200)
    )).scalars().all()
    srv_ids = {a.service_id for a in rows if a.service_id}
    m_ids = {str(a.master_id) for a in rows if a.master_id}
    srv = {s.id: s.name for s in (await db.execute(select(Service).where(Service.id.in_(srv_ids)))).scalars().all()} if srv_ids else {}
    masters = {u.id: (u.full_name or u.email) for u in (await db.execute(select(User).where(User.id.in_(m_ids)))).scalars().all()} if m_ids else {}
    reviews = {r.appointment_id: r for r in (await db.execute(select(Review).where(Review.appointment_id.in_([a.id for a in rows])))).scalars().all()} if rows else {}
    return [{
        "id": a.id, "start_time": a.start_time.isoformat() if a.start_time else None,
        "status": a.status, "service": srv.get(a.service_id), "master": masters.get(str(a.master_id)),
        "price": float(a.price) if a.price is not None else None,
        "tip": float(a.tip_amount) if a.tip_amount else None,
        "rating": (reviews[a.id].master_rating or reviews[a.id].rating) if a.id in reviews else None,
        "comment": reviews[a.id].comment if a.id in reviews else None,
        "notes": a.notes,
    } for a in rows]


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    client = await _get_owned_client(db, current_user, client_id)

    # Без цієї перевірки SQLAlchemy мовчки обнулить client_id на всіх минулих
    # бронюваннях цього клієнта перед видаленням (стандартна поведінка ORM
    # для nullable зв'язку) - історія відвідувань тихо втрачає власника.
    # Явно забороняємо це, а не покладаємось на побічний ефект ORM.
    appts = await db.execute(select(Appointment.id).where(Appointment.client_id == client_id).limit(1))
    if appts.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У цього клієнта є історія бронювань - видалення заборонене, щоб не втратити її. "
                   "Використайте is_blacklisted замість видалення, якщо потрібно приховати клієнта.",
        )

    points_ref = await db.execute(
        select(PointsLedgerEntry.id).where(PointsLedgerEntry.reference_client_id == client_id).limit(1)
    )
    if points_ref.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="За цього клієнта нараховані бали (він - історія в бухгалтерії балів) - "
                   "видалення заборонене. Використайте is_blacklisted замість видалення.",
        )

    await db.delete(client)
    await db.commit()


@router.post("/{client_id}/link/{target_client_id}", response_model=ClientResponse)
async def link_clients(
    client_id: int,
    target_client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Пов'язати дві клієнтські картки (напр. члени родини) - симетрично, в обидві сторони."""
    client = await _get_owned_client(db, current_user, client_id)
    target = await _get_owned_client(db, current_user, target_client_id)
    if client.business_id != target.business_id:
        raise HTTPException(status_code=400, detail="Клієнти належать різним закладам")

    existing = await db.execute(
        select(ClientLink).where(ClientLink.client_id == client_id, ClientLink.linked_client_id == target_client_id)
    )
    if existing.scalars().first() is None:
        db.add(ClientLink(client_id=client.id, linked_client_id=target.id))
        db.add(ClientLink(client_id=target.id, linked_client_id=client.id))
        await db.commit()

    _cl = await _load_with_links(db, client_id)
    return (await _with_stats(db, _cl.business_id, [_cl]))[0]


@router.delete("/{client_id}/link/{target_client_id}", response_model=ClientResponse)
async def unlink_clients(
    client_id: int,
    target_client_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Розірвати сімейний зв'язок - симетрично, в обидві сторони."""
    await _get_owned_client(db, current_user, client_id)

    await db.execute(
        ClientLink.__table__.delete().where(
            ClientLink.client_id == client_id, ClientLink.linked_client_id == target_client_id
        )
    )
    await db.execute(
        ClientLink.__table__.delete().where(
            ClientLink.client_id == target_client_id, ClientLink.linked_client_id == client_id
        )
    )
    await db.commit()
    _cl = await _load_with_links(db, client_id)
    return (await _with_stats(db, _cl.business_id, [_cl]))[0]
