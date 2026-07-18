import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { type, message, recipients } = await request.json();

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Немає отримувачів' }, { status: 400 });
    }

    if (type === 'email') {
      // 🟢 ВІДПРАВКА EMAIL
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER, // Твоя пошта
          pass: process.env.EMAIL_PASS  // Спеціальний пароль додатку Gmail
        }
      });

      const emailPromises = recipients.map((client: any) => {
        if (!client.email) return Promise.resolve();
        return transporter.sendMail({
          from: `"BookEra" <${process.env.EMAIL_USER}>`,
          to: client.email,
          subject: 'Спеціальна пропозиція для вас!',
          html: `<div style="font-family: sans-serif; padding: 20px; color: #0f172a;">
                   <h2 style="color: #3b82f6;">Привіт, ${client.name}!</h2>
                   <p style="font-size: 16px; white-space: pre-wrap;">${message}</p>
                 </div>`
        });
      });

      await Promise.all(emailPromises);

    } else if (type === 'sms') {
      // 🟢 ВІДПРАВКА SMS (через TurboSMS Україна)
      const smsToken = process.env.TURBOSMS_TOKEN;
      const sender = process.env.TURBOSMS_SENDER || 'MobilSms'; // Базове альфа-ім'я

      if (!smsToken) {
         console.warn("TurboSMS токен не налаштовано! Імітуємо успіх для тестування.");
         return NextResponse.json({ success: true, simulated: true });
      }

      const phones = recipients.map((c: any) => c.phone).filter(Boolean);

      const response = await fetch('https://api.turbosms.ua/message/send.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${smsToken}`
        },
        body: JSON.stringify({
          recipients: phones,
          sms: {
            sender: sender,
            text: message
          }
        })
      });

      const turboResult = await response.json();
      // Код 800 або 801 - це успішна прийнята розсилка в TurboSMS
      if (turboResult.response_code !== 800 && turboResult.response_code !== 801) {
         throw new Error(`TurboSMS Error: ${turboResult.response_status}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Помилка API розсилки:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}