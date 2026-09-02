const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// ============ Типи ============

export interface BusinessHoursItem {
  weekday: number; // 0=понеділок ... 6=неділя
  is_open: boolean;
  open_time: string; // "09:00"
  close_time: string; // "20:00"
}

export interface Business {
  id: number;
  name: string;
  slug: string;
  category?: string;
  business_type?: string;
  workspace_type?: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  rating?: number;
  reviews_count?: number;
  cover_photo?: string;
  logo?: string;
  tags?: string[];
  is_active?: boolean;
  services?: Service[];
  accent_color?: string;
  layout_config?: Record<string, any>;
  workplace_photos?: string[];
  booking_settings?: Record<string, any>;
  security_settings?: Record<string, any>;
  notification_settings?: Record<string, any>;
  payments_settings?: Record<string, any>;
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
  order_index?: number;
  addon_service_ids?: number[];
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
  client_id?: number;
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

export interface Client {
  id: number;
  business_id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  allergies?: string;
  tags?: string[];
  is_blacklisted: boolean;
  balance: number;
  visits_count: number;
  total_spent: number;
  last_visit_at?: string;
  medical_pdf_url?: string;
  birthday?: string;
  instagram?: string;
  formulas?: string;
  consent_photo?: boolean;
  consent_procedure?: boolean;
  linked_client_ids?: number[];
  created_at?: string;
}

export interface StaffInvite {
  id: number;
  business_id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface StaffMember {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: string;
  specialization?: string;
  avatar_url?: string;
  commission_rate?: number;
  fixed_salary?: number;
  tax_rate?: number;
  payment_method?: string;
  shifts?: Record<string, any>[];
  assigned_services?: number[];
  provides_services?: boolean;
  payout_period?: string;
  payout_day?: string;
  tips_full?: boolean;
  deduct_materials?: boolean;
  auto_reset_balance?: boolean;
  is_active: boolean;
}

export interface BusinessStats {
  period_start: string;
  period_end: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  upcoming_appointments: number;
  revenue_completed: number;
  revenue_expected: number;
  new_clients: number;
  top_services: { service_id: number; name: string; bookings_count: number; revenue: number }[];
}

export interface MonetizationSummary {
  points_balance: number;
  direct_link_token?: string;
  commission_rate: number;
  total_commission_owed: number;
  radar_active: boolean;
  radar_expires_at?: string;
}

export interface GiftCertificate {
  id: number;
  business_id: number;
  code: string;
  initial_amount: number;
  remaining_amount: number;
  status: string;
  purchaser_name?: string;
  message?: string;
  created_at?: string;
  expires_at?: string;
}

export interface Review {
  id: number;
  business_id: number;
  appointment_id?: number;
  author_name?: string;
  rating: number;
  comment?: string;
  business_reply?: string;
  created_at?: string;
}

export interface InventoryItem {
  id: number;
  business_id: number;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold?: number;
  cost_per_unit?: number;
}

export interface Expense {
  id: number;
  business_id: number;
  category?: string;
  description?: string;
  amount: number;
  expense_date: string;
  recurrence?: 'none' | 'weekly' | 'monthly';
  recurrence_group_id?: string;
}

// ============ Внутрішні хелпери ============

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handle(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Помилка ${res.status}` }));
    throw new ApiError(err.detail || `Помилка ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Публічні запити - без токена авторизації. */
async function publicFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return handle(res);
}

/**
 * Авторизовані запити (CRM) - token дістає компонент-викликач із Supabase-сесії
 * (createClient().auth.getSession() на клієнті, або await createClient() на сервері)
 * і передає сюди явно. api.ts свідомо не знає, звідки взявся токен - це працює
 * однаково і в Server Components, і в Client Components.
 */
async function authFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return handle(res);
}

// ============ API ============

export const api = {
  // === КЛІЄНТСЬКИЙ МАРКЕТПЛЕЙС (публічно, без токена) ===

  async getBusiness(slugOrId: string | number): Promise<Business> {
    return publicFetch(`/businesses/${slugOrId}`);
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
    return publicFetch(`/businesses/search-available?${query}`);
  },

  async listBusinesses(limit = 50, offset = 0): Promise<Business[]> {
    return publicFetch(`/businesses/?limit=${limit}&offset=${offset}`);
  },

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
    return publicFetch(`/appointments/available-slots?${query}`);
  },

  /** session_token - випадковий рядок з localStorage браузера (crypto.randomUUID()),
   * НЕ id клієнта - потрібен лише щоб браузер міг прибрати власний прострочений lock. */
  async lockTimeSlot(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    master_id?: string;
    session_token?: string;
    client_id?: number;
    direct_link_token?: string;
  }): Promise<{ status: string; booking_id: number; message: string }> {
    return publicFetch(`/appointments/lock`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async unlockTimeSlot(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    session_token?: string;
  }): Promise<{ status: string }> {
    return publicFetch(`/appointments/unlock`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async createAppointment(payload: {
    business_id: number;
    service_id: number;
    start_time: string;
    master_id?: string;
    session_token?: string;
    client_id?: number;
    client_name?: string;
    client_phone?: string;
    client_email?: string;
    direct_link_token?: string;
    gift_certificate_code?: string;
  }): Promise<Appointment> {
    return publicFetch(`/appointments`, { method: 'POST', body: JSON.stringify(payload) });
  },

  /** Клієнт переглядає своє бронювання за токеном з листа - без логіну. */
  async getAppointmentForClient(appointmentId: number, token: string): Promise<Appointment> {
    return publicFetch(`/appointments/${appointmentId}/manage?token=${encodeURIComponent(token)}`);
  },

  /** Клієнт скасовує своє бронювання за тим самим токеном. */
  async cancelAppointmentByClient(appointmentId: number, token: string): Promise<Appointment> {
    return publicFetch(`/appointments/${appointmentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async listReviews(businessId: number): Promise<Review[]> {
    return publicFetch(`/public/reviews?business_id=${businessId}`);
  },

  async createReview(payload: {
    business_id: number;
    appointment_id?: number;
    author_name?: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    return publicFetch(`/public/reviews`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async checkGiftCertificate(code: string, businessId: number): Promise<{ valid: boolean; remaining_amount?: number; message: string }> {
    return publicFetch(`/public/gift-certificates/check`, {
      method: 'POST',
      body: JSON.stringify({ code, business_id: businessId }),
    });
  },

  async acceptStaffInvite(token: string, inviteToken: string): Promise<{ status: string; business_id: number; role: string }> {
    return authFetch(`/public/invites/accept`, token, { method: 'POST', body: JSON.stringify({ token: inviteToken }) });
  },

  // === CRM: БІЗНЕС ===

  async getMyProfile(token: string): Promise<{
    id: string; email: string; full_name?: string; role: string | null;
    business_id: number | null; business: Business | null;
  }> {
    return authFetch(`/crm/businesses/me`, token);
  },

  async registerBusiness(
    token: string,
    payload: {
      name: string;
      category?: string;
      business_type?: string;
      workspace_type?: string;
      description?: string;
      address?: string;
      city?: string;
      phone?: string;
      email?: string;
      hours?: BusinessHoursItem[];
    }
  ): Promise<Business> {
    return authFetch(`/crm/businesses`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateBusiness(token: string, businessId: number, payload: Partial<Business>): Promise<Business> {
    return authFetch(`/crm/businesses/${businessId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async setBusinessHours(token: string, businessId: number, hours: BusinessHoursItem[]): Promise<BusinessHoursItem[]> {
    return authFetch(`/crm/businesses/${businessId}/hours`, token, { method: 'PUT', body: JSON.stringify(hours) });
  },

  async getBusinessHours(businessId: number): Promise<BusinessHoursItem[]> {
    return publicFetch(`/crm/businesses/${businessId}/hours`);
  },

  // === CRM: ПОСЛУГИ ===

  async createService(token: string, payload: Partial<Service> & { business_id: number; name: string; duration_minutes: number; price: number }): Promise<Service> {
    return authFetch(`/services`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async getBusinessServices(businessId: number): Promise<Service[]> {
    return publicFetch(`/services/business/${businessId}`);
  },

  async listPublicMasters(businessId: number): Promise<{ id: string; full_name?: string; specialization?: string; avatar_url?: string }[]> {
    return publicFetch(`/crm/businesses/${businessId}/masters`);
  },

  async updateService(token: string, serviceId: number, payload: Partial<Service>): Promise<Service> {
    return authFetch(`/services/${serviceId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async deleteService(token: string, serviceId: number): Promise<void> {
    await authFetch(`/services/${serviceId}`, token, { method: 'DELETE' });
  },

  // === CRM: КЛІЄНТИ ===

  async listClients(token: string, businessId: number, search?: string): Promise<Client[]> {
    const query = new URLSearchParams({ business_id: String(businessId) });
    if (search) query.append('search', search);
    return authFetch(`/crm/clients?${query}`, token);
  },

  async createClient(token: string, payload: { business_id: number; name: string; phone?: string; email?: string; notes?: string; allergies?: string; tags?: string[]; birthday?: string; instagram?: string }): Promise<Client> {
    return authFetch(`/crm/clients`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateClient(token: string, clientId: number, payload: Partial<Client>): Promise<Client> {
    return authFetch(`/crm/clients/${clientId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async deleteClient(token: string, clientId: number): Promise<void> {
    await authFetch(`/crm/clients/${clientId}`, token, { method: 'DELETE' });
  },

  async linkClients(token: string, clientId: number, targetClientId: number): Promise<Client> {
    return authFetch(`/crm/clients/${clientId}/link/${targetClientId}`, token, { method: 'POST' });
  },

  async unlinkClients(token: string, clientId: number, targetClientId: number): Promise<Client> {
    return authFetch(`/crm/clients/${clientId}/link/${targetClientId}`, token, { method: 'DELETE' });
  },

  // === CRM: ПЕРСОНАЛ ===

  async inviteStaff(token: string, businessId: number, payload: { email: string; role: string }): Promise<StaffInvite> {
    return authFetch(`/crm/businesses/${businessId}/invites`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async listInvites(token: string, businessId: number): Promise<StaffInvite[]> {
    return authFetch(`/crm/businesses/${businessId}/invites`, token);
  },

  async listStaff(token: string, businessId: number): Promise<StaffMember[]> {
    return authFetch(`/crm/businesses/${businessId}/staff`, token);
  },

  async updateStaff(token: string, staffId: string, payload: Partial<StaffMember>): Promise<StaffMember> {
    return authFetch(`/crm/staff/${staffId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async removeStaff(token: string, staffId: string): Promise<void> {
    await authFetch(`/crm/staff/${staffId}`, token, { method: 'DELETE' });
  },

  async getPayoutPreview(token: string, businessId: number, staffId: string): Promise<{
    staff_id: string; period_start: string; period_end: string; gross_revenue: number;
    commission_rate: number; payout_amount: number; completed_appointments_count: number;
  }> {
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/payout-preview`, token);
  },

  async createPayout(token: string, businessId: number, staffId: string, notes?: string) {
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/payouts`, token, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async listPayouts(token: string, businessId: number, staffId: string) {
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/payouts`, token);
  },

  /** Скасування помилкової виплати - візити повертаються в наступний розрахунок. */
  async cancelPayout(token: string, businessId: number, staffId: string, payoutId: number, reason = '') {
    return authFetch(
      `/crm/businesses/${businessId}/staff/${staffId}/payouts/${payoutId}?reason=${encodeURIComponent(reason)}`,
      token, { method: 'DELETE' }
    );
  },

  /** Кому вже пора платити за налаштованою періодичністю. */
  async listDuePayouts(token: string, businessId: number): Promise<{
    business_id: number; checked_at: string;
    due: { staff_id: string; staff_name: string; payout_period: string; amount_due: number; appointments_count: number }[];
  }> {
    return authFetch(`/crm/businesses/${businessId}/payouts/due`, token);
  },

  /** Матеріали, що витрачаються на одну послугу. */
  async getServiceMaterials(token: string, serviceId: number): Promise<{
    id: number; inventory_item_id: number; inventory_item_name?: string;
    unit?: string; quantity_per_use: number; cost_per_use?: number;
  }[]> {
    return authFetch(`/crm/services/${serviceId}/materials`, token);
  },

  async setServiceMaterials(token: string, serviceId: number, materials: { inventory_item_id: number; quantity_per_use: number }[]) {
    return authFetch(`/crm/services/${serviceId}/materials`, token, {
      method: 'PUT', body: JSON.stringify(materials),
    });
  },

  /** Історія руху позиції складу - видно, куди дівся залишок. */
  async getInventoryMovements(token: string, itemId: number) {
    return authFetch(`/crm/inventory/${itemId}/movements`, token);
  },

  async transferOwnership(token: string, businessId: number, newOwnerUserId: string) {
    return authFetch(`/crm/businesses/${businessId}/transfer-ownership`, token, {
      method: 'POST',
      body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
    });
  },

  // === CRM: ЗАПИСИ ===

  async getBookedAppointments(token: string, businessId: number, masterId?: string): Promise<Appointment[]> {
    const query = new URLSearchParams({ business_id: String(businessId) });
    if (masterId && masterId !== '0' && masterId !== 'all') query.append('master_id', masterId);
    return authFetch(`/appointments/booked?${query}`, token);
  },

  async updateAppointmentStatus(token: string, appointmentId: number, status: 'confirmed' | 'completed' | 'cancelled'): Promise<Appointment> {
    return authFetch(`/appointments/${appointmentId}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  /** Ручний запис персоналом (дзвінок/walk-in) - на відміну від createAppointment,
   * потребує токена і фіксує, хто саме зі staff його вніс. */
  async createManualAppointment(
    token: string,
    payload: {
      business_id: number;
      service_id?: number;
      start_time: string;
      duration_minutes?: number;
      master_id?: string;
      client_id?: number;
      client_name?: string;
      client_phone?: string;
      client_email?: string;
      notes?: string;
      is_block?: boolean;
    }
  ): Promise<Appointment> {
    return authFetch(`/crm/appointments`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async rescheduleAppointment(token: string, appointmentId: number, startTime: string): Promise<Appointment> {
    return authFetch(`/crm/appointments/${appointmentId}/reschedule`, token, {
      method: 'PATCH',
      body: JSON.stringify({ start_time: startTime }),
    });
  },

  // === CRM: СТАТИСТИКА ===

  async getBusinessStats(token: string, businessId: number, dateFrom?: string, dateTo?: string): Promise<BusinessStats> {
    const query = new URLSearchParams();
    if (dateFrom) query.append('date_from', dateFrom);
    if (dateTo) query.append('date_to', dateTo);
    const qs = query.toString();
    return authFetch(`/crm/businesses/${businessId}/stats${qs ? `?${qs}` : ''}`, token);
  },

  // === CRM: МОНЕТИЗАЦІЯ ===

  async getMonetizationSummary(token: string, businessId: number): Promise<MonetizationSummary> {
    return authFetch(`/crm/businesses/${businessId}/monetization`, token);
  },

  async getPointsLedger(token: string, businessId: number) {
    return authFetch(`/crm/businesses/${businessId}/points-ledger`, token);
  },

  async getCommissions(token: string, businessId: number) {
    return authFetch(`/crm/businesses/${businessId}/commissions`, token);
  },

  async getRadarStatus(token: string, businessId: number): Promise<{ active: boolean; expires_at?: string; points_balance: number }> {
    return authFetch(`/crm/businesses/${businessId}/radar`, token);
  },

  async activateRadarWithPoints(token: string, businessId: number, days: number) {
    return authFetch(`/crm/businesses/${businessId}/radar/activate-with-points`, token, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  },

  async createGiftCertificate(
    token: string,
    payload: { business_id: number; amount: number; purchaser_name?: string; purchaser_email?: string; message?: string; valid_days?: number }
  ): Promise<GiftCertificate> {
    return authFetch(`/crm/gift-certificates`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async listGiftCertificates(token: string, businessId: number): Promise<GiftCertificate[]> {
    return authFetch(`/crm/gift-certificates?business_id=${businessId}`, token);
  },

  async replyToReview(token: string, reviewId: number, businessReply: string): Promise<Review> {
    return authFetch(`/crm/reviews/${reviewId}/reply`, token, { method: 'PATCH', body: JSON.stringify({ business_reply: businessReply }) });
  },

  // === CRM: СКЛАД ===

  async listInventory(token: string, businessId: number): Promise<InventoryItem[]> {
    return authFetch(`/crm/inventory?business_id=${businessId}`, token);
  },

  async createInventoryItem(token: string, payload: { business_id: number; name: string; quantity?: number; unit?: string; low_stock_threshold?: number; cost_per_unit?: number }): Promise<InventoryItem> {
    return authFetch(`/crm/inventory`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateInventoryItem(token: string, itemId: number, payload: Partial<InventoryItem>): Promise<InventoryItem> {
    return authFetch(`/crm/inventory/${itemId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async deleteInventoryItem(token: string, itemId: number): Promise<void> {
    await authFetch(`/crm/inventory/${itemId}`, token, { method: 'DELETE' });
  },

  // === CRM: ВИТРАТИ ===

  async listExpenses(token: string, businessId: number): Promise<Expense[]> {
    return authFetch(`/crm/expenses?business_id=${businessId}`, token);
  },

  async createExpense(token: string, payload: { business_id: number; category?: string; description?: string; amount: number; expense_date?: string; recurrence?: 'none' | 'weekly' | 'monthly' }): Promise<Expense> {
    return authFetch(`/crm/expenses`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateExpense(token: string, expenseId: number, payload: Partial<Expense> & { apply_to_future?: boolean }): Promise<Expense> {
    return authFetch(`/crm/expenses/${expenseId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async deleteExpense(token: string, expenseId: number, deleteFuture = false): Promise<void> {
    await authFetch(`/crm/expenses/${expenseId}?delete_future=${deleteFuture}`, token, { method: 'DELETE' });
  },
};
