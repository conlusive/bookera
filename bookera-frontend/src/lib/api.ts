const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// --- ТИПИ ДАНИХ ---

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

export interface LockSlotPayload {
  business_id: number;
  service_id: number;
  start_time: string; // ISO рядок: "2026-08-20T10:00:00"
  master_id?: string;
  client_id?: string;
  source?: "DIRECT" | "BOOKERA_SEARCH" | "BOOKERA_PROMO";
}

export interface AppointmentCreatePayload {
  business_id: number;
  service_id: number;
  start_time: string;
  master_id: string;
  client_id?: string;
  source?: "DIRECT" | "BOOKERA_SEARCH" | "BOOKERA_PROMO";
}

// --- МЕТОДИ API ---

export const api = {
  // 1. Пошук доступних закладів за датою та періодом доби
  async searchAvailableBusinesses(params: {
    city?: string;
    target_date: string;
    time_period?: "Ранок" | "Обід" | "Вечір" | "Будь-коли";
    category?: string;
  }): Promise<Business[]> {
    const query = new URLSearchParams({
      city: params.city || "Львів",
      target_date: params.target_date,
      time_period: params.time_period || "Будь-коли",
      category: params.category || "all",
    });

    const res = await fetch(`${API_URL}/businesses/search-available?${query.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Помилка під час пошуку закладів");
    return res.json();
  },

  // 2. Отримання деталей закладу за slug або id
  async getBusiness(slugOrId: string | number): Promise<Business> {
    const res = await fetch(`${API_URL}/businesses/${slugOrId}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Заклад не знайдено");
    return res.json();
  },

  // 3. Отримання списку послуг закладу
  async getBusinessServices(businessId: number): Promise<Service[]> {
    const res = await fetch(`${API_URL}/services/business/${businessId}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Помилка завантаження послуг");
    return res.json();
  },

  // 4. Тимчасове блокування слоту на 10 хвилин
  async lockTimeSlot(payload: LockSlotPayload): Promise<{ status: string; booking_id: number; message: string }> {
    const res = await fetch(`${API_URL}/appointments/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Не вдалося заблокувати час");
    }
    return res.json();
  },

  // 5. Розблокування слоту
  async unlockTimeSlot(payload: { business_id: number; master_id?: string; service_id: number; client_id?: string; start_time: string }): Promise<{ status: string }> {
    const res = await fetch(`${API_URL}/appointments/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // 6. Фінальне підтвердження запису
  async createAppointment(payload: AppointmentCreatePayload): Promise<any> {
    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Помилка при створенні запису");
    }
    return res.json();
  },
};