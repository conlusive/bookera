from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth import CurrentUser, assert_business_access, get_current_user
from app.models import Client, ClientLink, Business, PointsLedgerEntry
from app.models.appointment import Appointment
from app.services.monetization import award_points_for_new_client
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter(prefix="/crm/clients", tags=["CRM - Clients"])


async def _load_with_links(db: AsyncSession, client_id: int) -> Optional[Client]:
    result = await db.execute(
        select(Client).where(Client.id == client_id).options(selectinload(Client.links))
    )
    return result.scalars().first()


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
    if search:
        like = f"%{search.lower()}%"
        from sqlalchemy import or_, func
        stmt = stmt.where(or_(func.lower(Client.name).like(like), Client.phone.like(like)))
    stmt = stmt.order_by(Client.last_visit_at.desc().nullslast()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_business_access(db, current_user, client_in.business_id)
    client = Client(**client_in.model_dump())
    db.add(client)
    await db.flush()

    if client_in.phone:
        biz_res = await db.execute(select(Business).where(Business.id == client_in.business_id))
        business = biz_res.scalars().first()
        if business:
            await award_points_for_new_client(db, business, client_in.phone, client.id)

    await db.commit()
    return await _load_with_links(db, client.id)


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
    return await _load_with_links(db, client_id)


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

    return await _load_with_links(db, client_id)


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
    return await _load_with_links(db, client_id)
