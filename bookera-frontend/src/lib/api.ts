const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface Business {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  category?: string;
  rating?: number;
  reviews_count?: number;
  cover_photo?: string;
  logo?: string;
  phone?: string;
  open_time?: string;
  close_time?: string;
  days_off?: number[];
}

export interface Service {
  id: number;
  business_id: number;
  name: string;
  duration_minutes: number;
  price: number;
  is_group: boolean;
  max_participants: number;
}

export interface SlotStatusItem {
  time: string;
  status: "available" | "locked" | "booked";
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
  status: string;
  source: string;
}

export const api = {
  // === ПУБЛІЧНИЙ ФЛОУ ===
  async getBusiness(slugOrId: string | number): Promise<Business> {
    const res = await fetch(`${API_URL}/businesses/${slugOrId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Заклад не знайдено");
    return res.json();
  },

  async getBusinessServices(businessId: number): Promise<Service[]> {
    const res = await fetch(`${API_URL}/services/business/${businessId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Помилка завантаження послуг");
    return res.json();
  },

  async getAvailableSlots(params: {
    business_id: number;
    service_id: number;
    target_date: string;
    master_id?: string;
  }): Promise<AvailableSlotsResponse> {
    const query = new URLSearchParams({
      business_id: String(params.business_id),
      service_id: String(params.service_id),
      target_date: params.target_date,
      master_id: params.master_id || "0",
    });
    const res = await fetch(`${API_URL}/appointments/available-slots?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Не вдалося завантажити вільні слоти");
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Цей час зайнято або заблоковано.");
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async createAppointment(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    master_id: string;
    client_id?: string;
    source?: string;
  }): Promise<Appointment> {
    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Помилка підтвердження бронювання.");
    }
    return res.json();
  },

  // === КАБІНЕТ БІЗНЕСУ (DASHBOARD) ===
  async getBookedAppointments(businessId: number): Promise<Appointment[]> {
    const res = await fetch(`${API_URL}/appointments/booked?business_id=${businessId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Помилка завантаження розкладу");
    return res.json();
  },

  async createService(serviceData: {
    business_id: number;
    name: string;
    duration_minutes: number;
    price: number;
    is_group?: boolean;
    max_participants?: number;
  }): Promise<Service> {
    const res = await fetch(`${API_URL}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serviceData),
    });
    if (!res.ok) throw new Error("Помилка додавання послуги");
    return res.json();
  },
};