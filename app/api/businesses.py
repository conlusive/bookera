import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.models.user import Business, BusinessInvite, User, RoleEnum
from app.schemas.business import InviteCreate, InviteAccept

# ОГОЛОШУЄМО РОУТЕР (Це виправить помилку NameError)
router = APIRouter()


# --- ФУНКЦІЯ РЕАЛЬНОЇ ВІДПРАВКИ ЛИСТА ---
def send_invite_email_task(email_to: str, token: str, business_name: str, role: str):
    invite_link = f"http://localhost:3000/invite?token={token}"

    sender_email = "yaroslavkozopas165@gmail.com"  # ВПИШИ СВІЙ GMAIL
    sender_password = "xvdpzkrqpjfgkmqx"  # ВПИШИ ПАРОЛЬ ДОДАТКА БЕЗ ПРОБІЛІВ

    msg = MIMEMultipart("alternative")
    msg['From'] = f"BookEra <{sender_email}>"
    msg['To'] = email_to
    msg['Subject'] = f"Запрошення в команду салону {business_name}"

    text = f"Привіт!\n\nТебе запросили приєднатися до салону '{business_name}' у ролі: {role}.\nПерейди за цим посиланням, щоб прийняти запрошення:\n{invite_link}\n\nЗ повагою,\nКоманда BookEra"

    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #111827; text-align: center;">Вітаємо на BookEra! 🎉</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                Вас запросили приєднатися до команди салону <strong>'{business_name}'</strong>.
            </p>
            <p style="color: #4b5563; font-size: 16px;">
                Ваша нова роль: <span style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-weight: bold;">{role}</span>.
            </p>
            <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
               <a href="{invite_link}" style="background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                 Прийняти запрошення
               </a>
            </div>
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Якщо кнопка не працює, скопіюйте це посилання та вставте у браузер:<br>
              <a href="{invite_link}" style="color: #3b82f6; word-break: break-all;">{invite_link}</a>
            </p>
        </div>
      </body>
    </html>
    """
    msg.attach(MIMEText(text, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        print(f"✅ Лист успішно відправлено на {email_to}")
    except Exception as e:
        print(f"❌ Помилка відправки листа: {e}")


# --- ЕНДПОІНТИ ---
@router.post("/{business_id}/invites")
async def create_invite(
        business_id: int,
        invite_data: InviteCreate,
        background_tasks: BackgroundTasks,
        db: AsyncSession = Depends(get_db)
):
    query = select(Business).where(Business.id == business_id)
    result = await db.execute(query)
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=404, detail="Салон не знайдено")

    token = secrets.token_urlsafe(32)

    new_invite = BusinessInvite(
        business_id=business_id,
        email=invite_data.email,
        role=invite_data.role,
        token=token
    )
    db.add(new_invite)
    await db.commit()

    # Передаємо відправку листа у фонову задачу
    background_tasks.add_task(send_invite_email_task, invite_data.email, token, business.name, invite_data.role.value)

    return {"message": "Запрошення надіслано!"}


@router.post("/invites/accept")
async def accept_invite(data: InviteAccept, db: AsyncSession = Depends(get_db)):
    query = select(BusinessInvite).where(BusinessInvite.token == data.token)
    result = await db.execute(query)
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Недійсне або прострочене запрошення")

    if invite.is_accepted:
        raise HTTPException(status_code=400, detail="Це запрошення вже використано")

    user_query = select(User).where(User.email == invite.email)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Користувач не зареєстрований")

    user.business_id = invite.business_id
    user.role = invite.role
    invite.is_accepted = True

    await db.commit()
    return {"message": f"Вітаємо! Тепер ви {invite.role.value} у салоні."}


@router.delete("/{business_id}")
async def delete_business(
        business_id: int,
        db: AsyncSession = Depends(get_db),
        # current_user: User = Depends(get_current_user)
):
    # 1. Знаходимо бізнес
    query = select(Business).where(Business.id == business_id)
    result = await db.execute(query)
    business = result.scalar_one_or_none()

    if not business:
        raise HTTPException(status_code=404, detail="Бізнес не знайдено")

    # 2. Знаходимо власника цього бізнесу
    owner_query = select(User).where(User.id == business.owner_id)
    owner_result = await db.execute(owner_query)
    owner = owner_result.scalar_one_or_none()

    # 3. Видаляємо бізнес (каскадом видаляться послуги та запити)
    await db.delete(business)

    # 4. Якщо у власника більше немає інших бізнесів, понижуємо його роль до клієнта
    if owner:
        # Перевіряємо, чи є в нього інші салони
        other_biz_query = select(Business).where(Business.owner_id == owner.id, Business.id != business_id)
        other_biz_result = await db.execute(other_biz_query)
        other_business = other_biz_result.scalar_one_or_none()

        if not other_business:
            owner.role = RoleEnum.client  # Повертаємо статус звичайного клієнта

    await db.commit()
    return {"message": "Бізнес успішно видалено, статус акаунта оновлено."}