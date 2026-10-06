# Налаштування Supabase Auth: підтвердження пошти й пароль

Ці налаштування робляться в дашборді Supabase (код їх змінити не може). Фронтенд уже готовий:
показує «Ми надіслали лист…», перекладає помилки й перевіряє пароль (мінімум 8 символів, літери й цифри).

## Чому це важливо
Зараз `mailer_autoconfirm = true`: можна зареєструватись на ЧУЖУ пошту без підтвердження. На цьому
тримається захист запрошень у команду («лист має збігатися з поштою акаунта»), тож підтвердження обовʼязкове.

## Крок 1. Власний SMTP для листів Supabase
Вбудована пошта Supabase дає лише кілька листів на годину. Authentication → Emails → SMTP Settings → Enable custom SMTP:
- Host `smtp.gmail.com`, Port `465`
- Username: ваша Gmail-адреса, Password: пароль застосунку Google (той самий, що в `.env`)
- Sender email: ваша Gmail-адреса, Sender name: `BookEra`

Коли буде власний домен, замініть на SMTP поштового сервісу (Resend, Brevo) з адресою на вашому домені.

## Крок 2. Вимоги до пароля
Authentication → Sign In / Providers (або Policies) → Password:
- Minimum password length: **8**
- Password requirements: **Letters and digits** (латинські літери й цифри)
- Prevent use of leaked passwords: лише на Pro-плані (на безкоштовному недоступно)

> Кроки 2 і 4 вже застосовано через Management API (мінімум 8, латинська літера + цифра, `http://localhost:3000/**`
> у списку переходів). Лишаються SMTP, шаблони й «Confirm email»: шаблони Supabase дозволяє змінювати
> лише після підключення власного SMTP.

## Крок 3. Підтвердження пошти
Authentication → Sign In / Providers → Email → **Confirm email: увімкнути**.

## Крок 4. Адреси переходу
Authentication → URL Configuration:
- Site URL: адреса сайту (локально `http://localhost:3000`, на проді — ваш домен)
- Redirect URLs: додайте `http://localhost:3000/**` і адресу прод-сайту з `/**`

## Крок 5. Листи українською в нашому стилі
Authentication → Emails → Templates. Для кожного шаблону вставте вміст файлу з `supabase/email-templates/`:
| Шаблон Supabase | Файл | Тема листа |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Підтвердіть пошту — BookEra |
| Reset password | `reset-password.html` | Відновлення пароля — BookEra |
| Change email address | `change-email.html` | Підтвердіть нову пошту — BookEra |

Файли збирає `venv/bin/python scripts/build_auth_email_templates.py` зі спільного шаблону листів, тож їх легко оновити.

## Перевірка
1. Зареєструйте тестовий акаунт на свою пошту: має зʼявитись «Ми надіслали лист на …», сесії ще немає.
2. Відкрийте лист, натисніть кнопку, увійдіть паролем.
3. Спроба входу до підтвердження показує «Пошту ще не підтверджено…».
