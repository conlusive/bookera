'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import VisitFeedback from '@/components/visit/VisitFeedback';
import { goToCheckout } from '@/lib/checkout';

/**
 * Сторінка запису для клієнта.
 *
 * На неї ведуть УСІ листи: підтвердження, перенесення, нагадування.
 * До цього її не існувало — людина натискала «Переглянути або
 * скасувати» й потрапляла на 404. Бекенд генерував токени, листи
 * були правильні, а посилання вело в нікуди.
 *
 * Доступ за токеном із листа, без входу в систему: вимагати
 * реєстрації від людини, яка просто хоче скасувати візит, —
 * найшвидший спосіб отримати неявку замість скасування.
 */
function BookingContent() {
  const params = useParams();
  const search = useSearchParams();
  const appointmentId = Number(params?.id);
  const token = search?.get('token') || '';

  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [payingDeposit, setPayingDeposit] = useState(false);

  useEffect(() => {
    if (!appointmentId || !token) {
      setError('Посилання неповне. Скористайтесь тим, що в листі.');
      setIsLoading(false);
      return;
    }
    void (async () => {
      try {
        setBooking(await api.getAppointmentForClient(appointmentId, token));
      } catch (err: any) {
        setError(err?.message || 'Запис не знайдено');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [appointmentId, token]);

  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', background: '#F2F4F2', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '18px', overflow: 'hidden' }}>
        <div style={{ height: '4px', background: '#C2D8C4' }} />
        <div style={{ padding: '1.75rem' }}>{children}</div>
      </div>
    </div>
  );

  if (isLoading) {
    return wrap(<div style={{ height: '160px', borderRadius: '12px', background: '#F2F6F1' }} />);
  }

  if (error) {
    return wrap(
      <>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#222222', margin: '0 0 0.6rem' }}>
          Не вдалося відкрити запис
        </h1>
        <p style={{ fontSize: '0.925rem', color: '#5C6B5E', margin: 0, lineHeight: 1.55 }}>
          {error} Якщо посилання застаріло — зв'яжіться із закладом.
        </p>
      </>
    );
  }

  const alreadyCancelled = isCancelled || booking?.status === 'cancelled';
  const startsAt = booking?.start_time ? new Date(booking.start_time) : null;
  // Минулий візит скасувати неможливо: кнопка там лише збиває з пантелику.
  const isPast = startsAt ? startsAt < new Date() : false;

  return wrap(
    <>
      <div style={{
        fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: '#6B756A', marginBottom: '0.75rem',
      }}>
        {booking?.business_name || 'Ваш запис'}
      </div>

      <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#222222', margin: '0 0 1.25rem', letterSpacing: '-0.02em' }}>
        {alreadyCancelled ? 'Візит скасовано' : booking?.status === 'pending_approval' ? 'Запит на запис' : 'Ваш візит'}
      </h1>

      {booking?.status === 'pending_approval' && !alreadyCancelled && (
        <div style={{ background: '#FFFAF0', border: '1px solid #FCD9A1', color: '#92400E', borderRadius: '12px', padding: '0.8rem 1rem', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.45 }}>
          <b>Чекаємо відповіді закладу.</b> Час за вами зарезервовано, а підтвердження ми надішлемо листом.
        </div>
      )}

      <div style={{
        background: '#F4FAF5', border: '1px solid #E4EBE3', borderRadius: '14px',
        padding: '1.15rem 1.25rem', opacity: alreadyCancelled ? 0.55 : 1,
      }}>
        {startsAt && (
          <>
            <div style={{ fontSize: '0.8rem', color: '#6B756A', marginBottom: '3px' }}>Коли</div>
            <div style={{
              fontSize: '1.35rem', fontWeight: 700, color: '#222222', marginBottom: '0.9rem',
              textDecoration: alreadyCancelled ? 'line-through' : 'none',
            }}>
              {startsAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
              {', '}
              {startsAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </>
        )}

        {booking?.service_name && (
          <>
            <div style={{ fontSize: '0.8rem', color: '#6B756A', marginBottom: '3px' }}>Послуга</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#222222', marginBottom: '0.9rem' }}>
              {booking.service_name}
            </div>
          </>
        )}

        {booking?.master_name && (
          <>
            <div style={{ fontSize: '0.8rem', color: '#6B756A', marginBottom: '3px' }}>Майстер</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#222222' }}>{booking.master_name}</div>
          </>
        )}
      </div>

      {booking?.deposit_status && booking?.deposit_due ? (
        <div style={{
          marginTop: '1rem', padding: '0.9rem 1.1rem', borderRadius: '14px', fontSize: '0.875rem', lineHeight: 1.5,
          background: booking.deposit_status === 'awaiting' ? '#FDF6E9' : '#F4FAF5',
          border: `1px solid ${booking.deposit_status === 'awaiting' ? 'rgba(180,130,40,0.25)' : '#E4EBE3'}`, color: '#2E3A30',
        }}>
          {booking.deposit_status === 'awaiting' && !alreadyCancelled && (
            <>
              <b>Завдаток {booking.deposit_due} ₴ ще не сплачено.</b> Без нього запис зніметься за 15 хвилин після створення.
              <button
                type="button"
                disabled={payingDeposit}
                onClick={async () => {
                  setPayingDeposit(true);
                  try {
                    const pay = await api.depositCheckout(appointmentId, token);
                    if (!pay.paid && goToCheckout(pay)) return;
                    setBooking(await api.getAppointmentForClient(appointmentId, token));
                  } catch (err: any) {
                    setError(err?.message || 'Не вдалося сплатити завдаток');
                  } finally {
                    setPayingDeposit(false);
                  }
                }}
                style={{ display: 'block', width: '100%', height: '42px', marginTop: '0.7rem', borderRadius: '10px', border: 'none', background: '#222222', color: '#fff', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', cursor: payingDeposit ? 'wait' : 'pointer' }}
              >
                {payingDeposit ? 'Зачекайте…' : `Сплатити завдаток ${booking.deposit_due} ₴`}
              </button>
            </>
          )}
          {booking.deposit_status === 'held' && !alreadyCancelled && (<><b>Завдаток {booking.deposit_paid ?? booking.deposit_due} ₴ сплачено.</b> Решту — у закладі. Якщо скасувати запис, завдаток повернеться.</>)}
          {booking.deposit_status === 'paid_out' && <><b>Завдаток {booking.deposit_paid ?? booking.deposit_due} ₴ сплачено</b> і зарахований у вартість візиту.</>}
          {booking.deposit_status === 'refunded' && <><b>Завдаток {booking.deposit_paid ?? booking.deposit_due} ₴ повернено.</b> Гроші повернуться на картку.</>}
          {booking.deposit_status === 'retained' && <>Клієнт не прийшов, тож завдаток лишився закладу.</>}
        </div>
      ) : null}

      {!alreadyCancelled && !isPast && (
        <button
          onClick={async () => {
            if (!confirm(booking?.deposit_status === 'held' ? `Скасувати візит? Завдаток ${booking.deposit_paid ?? booking.deposit_due} ₴ повернеться.` : 'Скасувати візит?')) return;
            setIsCancelling(true);
            try {
              await api.cancelAppointmentByClient(appointmentId, token);
              setIsCancelled(true);
            } catch (err: any) {
              setError(err?.message || 'Не вдалося скасувати');
            } finally {
              setIsCancelling(false);
            }
          }}
          disabled={isCancelling}
          style={{
            width: '100%', height: '44px', marginTop: '1.25rem', borderRadius: '12px',
            border: '1px solid rgba(168,57,52,0.25)', background: '#FBF0EF', color: '#A83934',
            fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit',
            cursor: isCancelling ? 'not-allowed' : 'pointer', opacity: isCancelling ? 0.6 : 1,
          }}
        >
          {isCancelling ? 'Скасовуємо…' : 'Скасувати візит'}
        </button>
      )}

      {alreadyCancelled && (
        <p style={{ fontSize: '0.875rem', color: '#5C6B5E', margin: '1.25rem 0 0', lineHeight: 1.55 }}>
          Щоб записатись знову — відкрийте сторінку закладу.
        </p>
      )}

      {isPast && !alreadyCancelled && booking?.status !== 'completed' && (
        <p style={{ fontSize: '0.875rem', color: '#A5AEA3', margin: '1.25rem 0 0', textAlign: 'center' }}>
          Цей візит уже відбувся.
        </p>
      )}

      {/* Оцінка й чайові - сюди веде лист «Як вам візит?» (зірка з листа вже обрана) */}
      {booking?.status === 'completed' && (
        <VisitFeedback appointmentId={appointmentId} token={token} initialRate={Number(search?.get('rate')) || undefined} />
      )}
    </>
  );
}


/**
 * Обгортка Suspense: useSearchParams() у App Router без неї валить
 * збірку сторінки, і вона віддає 404.
 *
 * Для цієї сторінки наслідок найгірший: на неї ведуть УСІ листи -
 * підтвердження, перенесення, нагадування. Клієнт натискав би
 * «Переглянути запис» і потрапляв у нікуди.
 */
export default function MyBookingPage() {
  return (
    <Suspense fallback={
      // Та сама розмітка, що й у стані завантаження всередині:
      // інакше сервер віддає одне, клієнт малює інше, і React
      // скаржиться на розбіжність гідратації.
      <div style={{
        minHeight: '100vh', background: '#F2F4F2', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem',
      }}>
        <div style={{ width: '100%', maxWidth: '440px', background: '#fff', borderRadius: '18px', overflow: 'hidden' }}>
          <div style={{ height: '4px', background: '#C2D8C4' }} />
          <div style={{ padding: '1.75rem' }}>
            <div style={{ height: '160px', borderRadius: '12px', background: '#F2F6F1' }} />
          </div>
        </div>
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
