"""
База клієнтів: експорт, імпорт з Excel, обʼєднання дублів.

  GET  /crm/clients/export?business_id           - уся база в Excel
  GET  /crm/clients/import-template              - порожній шаблон для заповнення
  POST /crm/clients/import?business_id&dry_run   - імпорт .xlsx / .csv
  GET  /crm/clients/duplicates?business_id       - групи дублів
  POST /crm/clients/{keep_id}/merge              - обʼєднати дублі в одну картку

Доступ - розділ «Всі клієнти салону» (власник і адміністратор за
замовчуванням; майстрові - якщо власник відкрив).
"""
import csv
import io
import re
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, assert_section, get_current_user
from app.core.database import get_db
from app.models import Appointment
from app.models.client import Client, ClientLink
from app.services.client_stats import client_stats, phone_tail

router = APIRouter(tags=["Clients import/export"])

MAX_ROWS = 5000
MAX_BYTES = 5 * 1024 * 1024

# Як можуть зватись колонки у файлах з інших систем чи власних таблиць
COLUMNS = {
    "name": ["імʼя", "ім'я", "имя", "піб", "фіо", "клієнт", "client", "name", "full name", "імʼя та прізвище", "ім'я та прізвище"],
    "phone": ["телефон", "тел", "номер", "мобільний", "phone", "mobile", "tel"],
    "email": ["пошта", "email", "e-mail", "електронна пошта", "mail"],
    "birthday": ["день народження", "дата народження", "народження", "birthday", "birth date", "dob"],
    "notes": ["нотатки", "примітки", "коментар", "notes", "comment"],
    "tags": ["теги", "мітки", "tags", "група"],
}
EXPORT_HEADERS = ["Імʼя", "Телефон", "Пошта", "День народження", "Візити", "Витратили, ₴",
                  "Останній візит", "Наступний візит", "Депозит, ₴", "Теги", "Нотатки", "Чорний список"]
EXPORT_WIDTHS = [24, 16, 26, 16, 9, 13, 15, 15, 11, 18, 30, 13]


def _norm_header(h) -> str:
    return re.sub(r"\s+", " ", str(h or "").strip().lower().replace("’", "ʼ").replace("'", "ʼ"))


def _match_columns(headers: list) -> dict:
    out = {}
    for idx, h in enumerate(headers):
        n = _norm_header(h)
        for key, names in COLUMNS.items():
            if key not in out and any(n == _norm_header(x) for x in names):
                out[key] = idx
    return out


def _norm_phone(v) -> Optional[str]:
    """Будь-який український запис номера -> +380XXXXXXXXX; інакше None."""
    if v is None or str(v).strip() == "":
        return None
    raw = str(v).strip()
    if isinstance(v, float) and v.is_integer():
        raw = str(int(v))
    d = re.sub(r"\D", "", raw)
    if len(d) == 9:
        d = "380" + d
    elif len(d) == 10 and d.startswith("0"):
        d = "38" + d
    elif len(d) == 11 and d.startswith("80"):
        d = "3" + d
    return "+" + d if len(d) == 12 and d.startswith("380") else ""


def _norm_birthday(v) -> Optional[date]:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        v = v.date()
    if isinstance(v, date):
        return v if date(1900, 1, 1) <= v <= date.today() else None
    s = str(v).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%y"):
        try:
            d = datetime.strptime(s, fmt).date()
            return d if date(1900, 1, 1) <= d <= date.today() else None
        except ValueError:
            continue
    return None


def _read_rows(filename: str, data: bytes) -> list:
    if filename.lower().endswith((".xlsx", ".xlsm")):
        from openpyxl import load_workbook
        try:
            wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Не вдалося прочитати файл Excel")
        ws = wb.active
        return [list(r) for r in ws.iter_rows(values_only=True)]
    if filename.lower().endswith(".csv"):
        text = None
        for enc in ("utf-8-sig", "cp1251"):
            try:
                text = data.decode(enc); break
            except UnicodeDecodeError:
                continue
        if text is None:
            raise HTTPException(status_code=400, detail="Не вдалося прочитати кодування файлу")
        sample = text[:2000]
        delim = ";" if sample.count(";") > sample.count(",") else ","
        return [row for row in csv.reader(io.StringIO(text), delimiter=delim)]
    raise HTTPException(status_code=400, detail="Підтримуються файли .xlsx і .csv")


def _xlsx_response(headers: list, rows: list, filename: str, widths: Optional[list] = None) -> StreamingResponse:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "Клієнти"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="F1F5F9")
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths or [], start=1):
        ws.column_dimensions[chr(64 + i)].width = w
    ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    from urllib.parse import quote
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


# ------------------------------------------------------------------ експорт

@router.get("/crm/clients/export")
async def export_clients(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    await assert_section(db, current_user, business_id, "clients")
    clients = (await db.execute(select(Client).where(Client.business_id == business_id).order_by(Client.name))).scalars().all()
    stats = await client_stats(db, business_id, clients)
    fmt = lambda d: d.strftime("%d.%m.%Y") if d else ""
    rows = []
    for c in clients:
        s = stats.get(c.id, {})
        rows.append([
            c.name, c.phone or "", c.email or "", fmt(c.birthday), s.get("visits_count", 0), s.get("total_spent", 0),
            fmt(s.get("last_visit_at")), fmt(s.get("next_visit_at")), float(c.balance or 0),
            ", ".join(c.tags or []), c.notes or "", "так" if c.is_blacklisted else "",
        ])
    from app.services.audit import record
    await record(db, business_id, str(current_user.id), "clients", "clients_exported", f"Експорт бази клієнтів: {len(rows)}")
    await db.commit()
    return _xlsx_response(EXPORT_HEADERS, rows, f"Клієнти {date.today():%d.%m.%Y}.xlsx", EXPORT_WIDTHS)


@router.get("/crm/clients/import-template")
async def import_template(current_user: CurrentUser = Depends(get_current_user)):
    """
    Шаблон - та сама таблиця, що й експорт (колонки, оформлення, ширини),
    лише порожня. Тож можна й вивантажити базу, виправити в Excel і
    завантажити назад: імпорт бере імʼя, телефон, пошту, дату народження,
    теги й нотатки, а пораховані колонки (візити, витрати…) пропускає.
    """
    return _xlsx_response(EXPORT_HEADERS, [], "Шаблон імпорту клієнтів.xlsx", EXPORT_WIDTHS)


# ------------------------------------------------------------------ імпорт

@router.post("/crm/clients/import")
async def import_clients(
    business_id: int = Query(...),
    dry_run: bool = Query(True, description="true - лише перевірити й показати, що буде"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Імпорт бази з Excel чи CSV. Спершу dry_run - перевірка з підсумком
    (скільки буде додано, які рядки пропущено й чому), потім - сам імпорт.

    Колонки розпізнаються за назвою: «Імʼя / ПІБ / Name», «Телефон /
    Phone», «Пошта / Email», «День народження», «Нотатки», «Теги».
    Номери приводяться до +380XXXXXXXXX. Той самий номер чи пошта, що вже є
    в базі чи трапляються у файлі вдруге, - пропускаються, а не дублюються.
    """
    await assert_section(db, current_user, business_id, "clients")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Файл завеликий - до 5 МБ")
    rows = [r for r in _read_rows(file.filename or "", data) if any(str(x or "").strip() for x in r)]
    if not rows:
        raise HTTPException(status_code=400, detail="Файл порожній")
    cols = _match_columns(rows[0])
    if "name" not in cols:
        raise HTTPException(status_code=400, detail="Не знайдено колонку з імʼям. Назвіть її «Імʼя» - або скористайтесь шаблоном.")
    body = rows[1:MAX_ROWS + 1]

    existing = (await db.execute(select(Client.phone, Client.email).where(Client.business_id == business_id))).all()
    seen_tails = {phone_tail(p) for p, _ in existing if phone_tail(p)}
    seen_emails = {(e or "").strip().lower() for _, e in existing if e}

    create, skipped = [], []
    for n, r in enumerate(body, start=2):
        get = lambda k: (r[cols[k]] if k in cols and cols[k] < len(r) else None)
        name = str(get("name") or "").strip()
        if not name:
            skipped.append({"row": n, "reason": "немає імені"}); continue
        phone = _norm_phone(get("phone"))
        if phone == "":
            skipped.append({"row": n, "name": name, "reason": "номер не схожий на український"}); continue
        email = str(get("email") or "").strip().lower() or None
        if email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", email):
            email = None
        tail = phone_tail(phone)
        if (tail and tail in seen_tails) or (email and email in seen_emails):
            skipped.append({"row": n, "name": name, "reason": "уже є в базі"}); continue
        if tail: seen_tails.add(tail)
        if email: seen_emails.add(email)
        tags = [t.strip() for t in re.split(r"[,;]", str(get("tags") or "")) if t.strip()][:10]
        create.append({"name": name[:120], "phone": phone, "email": email, "birthday": _norm_birthday(get("birthday")),
                       "notes": (str(get("notes")).strip()[:2000] if get("notes") else None), "tags": tags})

    result = {
        "total": len(body), "to_create": len(create), "skipped": len(skipped),
        "skipped_rows": skipped[:50], "columns": sorted(cols),
        "preview": [{k: (v.isoformat() if isinstance(v, date) else v) for k, v in c.items()} for c in create[:5]],
        "truncated": len(rows) - 1 > MAX_ROWS,
    }
    if dry_run:
        return result
    for c in create:
        db.add(Client(business_id=business_id, **c))
    from app.services.audit import record
    await record(db, business_id, str(current_user.id), "clients", "clients_imported",
                 f"Імпорт клієнтів: додано {len(create)}, пропущено {len(skipped)}")
    await db.commit()
    return {**result, "created": len(create)}


# ------------------------------------------------------------------ дублі

@router.get("/crm/clients/duplicates")
async def find_duplicates(
    business_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Групи карток з тим самим номером (останні 9 цифр) або поштою."""
    await assert_section(db, current_user, business_id, "clients")
    clients = (await db.execute(select(Client).where(Client.business_id == business_id).order_by(Client.id))).scalars().all()
    parent = {c.id: c.id for c in clients}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x

    by_key = {}
    for c in clients:
        for key in (("p", phone_tail(c.phone)), ("e", (c.email or "").strip().lower() or None)):
            if key[1]:
                if key in by_key:
                    parent[find(c.id)] = find(by_key[key])
                else:
                    by_key[key] = c.id
    groups = {}
    for c in clients:
        groups.setdefault(find(c.id), []).append(c)
    groups = [g for g in groups.values() if len(g) > 1]
    stats = await client_stats(db, business_id, [c for g in groups for c in g])
    return [[{
        "id": c.id, "name": c.name, "phone": c.phone, "email": c.email,
        "visits_count": stats[c.id]["visits_count"], "total_spent": stats[c.id]["total_spent"],
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in sorted(g, key=lambda x: -stats[x.id]["visits_count"])] for g in groups]


class MergeIn(BaseModel):
    merge_ids: List[int] = Field(min_length=1, max_length=20)


@router.post("/crm/clients/{keep_id}/merge")
async def merge_clients(
    keep_id: int,
    payload: MergeIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Обʼєднати дублі в одну картку (keep_id), решту - видалити.

    Переноситься ВСЕ, що посилається на клієнта: записи, сімейні звʼязки
    (з обох боків), історія балів. Порожні поля основної картки
    доповнюються з дублів, нотатки й формули - дописуються, теги -
    обʼєднуються, депозити - складаються, чорний список - якщо хоч одна
    картка в ньому.
    """
    keep = await db.get(Client, keep_id)
    if not keep:
        raise HTTPException(status_code=404, detail="Клієнта не знайдено")
    await assert_section(db, current_user, keep.business_id, "clients")
    ids = [i for i in dict.fromkeys(payload.merge_ids) if i != keep_id]
    others = (await db.execute(select(Client).where(Client.id.in_(ids)))).scalars().all()
    if len(others) != len(ids) or any(o.business_id != keep.business_id for o in others):
        raise HTTPException(status_code=400, detail="Обʼєднувати можна лише клієнтів цього закладу")

    for o in others:
        for f in ("phone", "email", "birthday", "instagram", "allergies", "medical_pdf_url", "linked_user_id"):
            if not getattr(keep, f, None) and getattr(o, f, None):
                setattr(keep, f, getattr(o, f))
        for f in ("notes", "formulas"):
            a, b = (getattr(keep, f) or "").strip(), (getattr(o, f) or "").strip()
            if b and b not in a:
                setattr(keep, f, f"{a}\n{b}".strip())
        keep.tags = list(dict.fromkeys((keep.tags or []) + (o.tags or [])))
        keep.balance = (keep.balance or 0) + (o.balance or 0)
        keep.is_blacklisted = bool(keep.is_blacklisted or o.is_blacklisted)
        keep.consent_photo = bool(keep.consent_photo or o.consent_photo)
        keep.consent_procedure = bool(keep.consent_procedure or o.consent_procedure)

    # Усе, що посилається на дублі, - на основну картку
    await db.execute(update(Appointment).where(Appointment.client_id.in_(ids)).values(client_id=keep_id))
    from app.models.monetization import PointsLedgerEntry
    await db.execute(update(PointsLedgerEntry).where(PointsLedgerEntry.reference_client_id.in_(ids)).values(reference_client_id=keep_id))
    links = (await db.execute(select(ClientLink).where(
        (ClientLink.client_id.in_(ids + [keep_id])) | (ClientLink.linked_client_id.in_(ids + [keep_id]))
    ))).scalars().all()
    pairs = set()
    for l in links:
        a = keep_id if l.client_id in ids else l.client_id
        b = keep_id if l.linked_client_id in ids else l.linked_client_id
        await db.delete(l)
        if a != b:
            pairs.add((a, b))
    await db.flush()
    for a, b in pairs:
        db.add(ClientLink(client_id=a, linked_client_id=b))

    for o in others:
        await db.delete(o)
    from app.services.audit import record
    await record(db, keep.business_id, str(current_user.id), "clients", "clients_merged",
                 f"Обʼєднано дублі клієнта {keep.name}: {len(others)}")
    await db.commit()
    return {"id": keep_id, "merged": len(others)}
