const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface Business {
  id: number;
  name: string;
  slug: string;
  category?: string;
  address?: string;
  city?: string;
  phone?: string;
  rating?: number;
  reviews_count?: number;
  cover_photo?: string;
  logo?: string;
  tags?: string[];
  open_time?: string;
  close_time?: string;
  days_off?: number[];
  is_active?: boolean;
}

export interface Service {
  id: number;
  business_id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  is_group?: boolean;
  max_participants?: number;
  is_active?: boolean;
}

export interface SlotStatusItem {
  time: string;
  status: 'available' | 'locked' | 'booked';
  available_masters_count: number;
}

export interface AvailableSlotsResponse {
  date: string;
  service_id: number;
  duration_minutes: number;
  slots: SlotStatusItem[];
}

export interface Appointment {
  id: number;
  business_id: number;
  service_id: number;
  client_id?: string;
  master_id?: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'blocked' | 'cancelled' | 'completed';
  source?: string;
  price?: number;
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  created_at?: string;
}

export const api = {
  // === КЛІЄНТСЬКИЙ МАРКЕТПЛЕЙС ===

  async getBusiness(slugOrId: string | number): Promise<Business> {
    const res = await fetch(`${API_URL}/businesses/${slugOrId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Заклад не знайдено');
    return res.json();
  },

  async searchAvailableBusinesses(params: {
    city?: string;
    target_date: string;
    time_period?: string;
    category?: string;
  }): Promise<Business[]> {
    const query = new URLSearchParams({
      city: params.city || 'Львів',
      target_date: params.target_date,
      time_period: params.time_period || 'Будь-коли',
      category: params.category || 'all',
    });

    const res = await fetch(`${API_URL}/businesses/search-available?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Помилка пошуку закладів');
    return res.json();
  },

  // === РОЗРАХУНОК СЛОТІВ ТА БРОНЮВАННЯ ===

  async getAvailableSlots(params: {
    business_id: number;
    service_id: number;
    target_date: string;
    master_id?: string;
    step_minutes?: number;
  }): Promise<AvailableSlotsResponse> {
    const query = new URLSearchParams({
      business_id: String(params.business_id),
      service_id: String(params.service_id),
      target_date: params.target_date,
      master_id: params.master_id || '0',
      step_minutes: String(params.step_minutes || 15),
    });

    const res = await fetch(`${API_URL}/appointments/available-slots?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Не вдалося завантажити вільні слоти');
    return res.json();
  },

  async lockTimeSlot(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    master_id?: string;
    client_id?: string;
    source?: string;
  }): Promise<{ status: string; booking_id: number; message: string }> {
    const res = await fetch(`${API_URL}/appointments/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Слот зайнято' }));
      throw new Error(err.detail || 'Цей час щойно зайняли');
    }
    return res.json();
  },

  async unlockTimeSlot(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    client_id?: string;
  }): Promise<{ status: string }> {
    const res = await fetch(`${API_URL}/appointments/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async createAppointment(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    master_id?: string;
    client_id?: string;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    source?: string;
  }): Promise<Appointment> {
    const res = await fetch(`${API_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Помилка оформлення' }));
      throw new Error(err.detail || 'Не вдалося створити візит');
    }
    return res.json();
  },

  // === КАБІНЕТ БІЗНЕСУ (CRM) ===

  async getBookedAppointments(businessId: number, masterId?: string): Promise<Appointment[]> {
    const query = new URLSearchParams({ business_id: String(businessId) });
    if (masterId && masterId !== '0' && masterId !== 'all') {
      query.append('master_id', masterId);
    }

    const res = await fetch(`${API_URL}/appointments/booked?${query.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Помилка завантаження розкладу');
    return res.json();
  },

  async updateAppointmentStatus(
    appointmentId: number,
    status: 'confirmed' | 'completed' | 'cancelled'
  ): Promise<Appointment> {
    const res = await fetch(`${API_URL}/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error('Не вдалося оновити статус');
    return res.json();
  },
};