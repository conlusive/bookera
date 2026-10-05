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
  /** Координати закладу. Заповнюються автоматично за адресою. */
  latitude?: number | null;
  longitude?: number | null;
  /** Відстань від точки пошуку - лише якщо клієнт передав координати. */
  distance_km?: number | null;
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

/** Стан підписки закладу. days_left рахує сервер: дата на пристрої
 *  людини може бути будь-якою, і «залишився 1 день» не має залежати
 *  від годинника її ноутбука. */
export interface SubscriptionState {
  status: 'trial' | 'active' | 'expired';
  has_access: boolean;
  until: string | null;
  days_left: number | null;
  is_trial: boolean;
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
  /** Чи показувати людину в блоці «Наша команда» на сторінці закладу.
   *  Окремо від provides_services: майстер може приймати записи,
   *  але не бути на вітрині. */
  show_in_storefront?: boolean;
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

export interface AnalyticsSummary {
  revenue: number; completed: number; cancelled: number; no_show: number; upcoming: number;
  avg_check: number; cancel_rate: number; clients: number; new_clients: number; returning_clients: number; tips: number;
}

export interface Analytics {
  period: { start: string; end: string; days: number };
  previous_period: { start: string; end: string; elapsed_days: number | null };
  current: AnalyticsSummary;
  previous: AnalyticsSummary;
  series: { date: string; revenue: number; completed: number }[];
  money: {
    revenue: number; expenses: number; profit: number; tips: number;
    expenses_by_category: { category: string; amount: number }[];
    expenses_through: string | null;
  };
  monthly: { month: string; revenue: number; expenses: number; profit: number }[];
  clients: {
    active: number; new: number; returning: number; returning_share: number; regular: number; lapsed: number;
    avg_gap_days: number | null; avg_lifetime_value: number; top: { name: string; visits: number; spent: number }[];
  };
  services: { service_id: number; name: string; count: number; revenue: number; avg_price: number; share: number }[];
  staff: { staff_id: string | null; name: string; completed: number; revenue: number; avg_check: number; share: number; cancel_rate: number; tips: number }[];
  sources: { label: string; count: number; revenue: number; share: number }[];
  load: { heatmap: number[][]; weekday_totals: number[]; busiest_weekday: number | null; quietest_weekday: number | null };
  goal: { goal: number | null; month_start: string; month_revenue: number; percent: number | null; days_left: number };
}

export interface AuditEvent {
  id: number;
  category: string;
  action: string;
  summary: string;
  meta?: { changes?: { field: string; label: string; from?: string; to?: string }[] } & Record<string, any> | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  created_at: string;
}

export interface AuditPage { items: AuditEvent[]; has_more: boolean; next_before_id: number | null }

export interface AuditSummary {
  total: number;
  by_category: Record<string, number>;
  by_actor: { actor_id: string | null; name: string | null; role: string | null; count: number }[];
}

export interface AuditQuery {
  category?: string; actor_id?: string; q?: string; date_from?: string; date_to?: string; before_id?: number; limit?: number;
}

function auditQs(params: AuditQuery): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) q.set(k, String(v)); });
  return q.toString() ? `?${q}` : '';
}

export interface SubscriptionOverview {
  status: 'trial' | 'active' | 'expired';
  has_access: boolean;
  is_trial: boolean;
  until: string | null;
  days_left: number | null;
  price_uah: number;
  period_days: number;
  live_payments: boolean;
  manual_note: string | null;
  payments: { id: number; date: string | null; amount: number; status: 'completed' | 'pending' | 'failed' | string }[];
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
  master_id?: string | null;
  author_name?: string;
  rating: number;
  master_rating?: number | null;
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

/**
 * Публічні запити - без токена авторизації.
 *
 * За замовчуванням без кешу: слоти, бронювання, відстані мають бути
 * живими. Але no-store на сервері робить ВСЮ сторінку динамічною - вона
 * рендериться заново на кожен запит, ігноруючи `revalidate` сторінки.
 * Саме так головна тягнула 100 закладів із бекенду для кожного
 * відвідувача. Тому `revalidate` (секунди) дозволяє кешувати там, де
 * дані можуть бути хвилину старими.
 */
async function publicFetch(path: string, options: RequestInit & { revalidate?: number } = {}) {
  const { revalidate, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' as const }),
    ...rest,
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

/** Завантажити файл із сервера (Excel) - і віддати браузеру як звичайне завантаження. */
async function downloadFile(path: string, token: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) await handle(res);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Надіслати файл: без Content-Type - браузер сам поставить multipart із межею. */
async function uploadFile(path: string, token: string, file: File): Promise<any> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
  return handle(res);
}

// ============ API ============

export interface RadarPackage {
  days: number;
  price_uah: number;
  price_points: number;
  per_day_uah: number;
  discount_percent: number;
  can_afford_points: boolean;
}

export interface RadarOverview {
  active: boolean;
  expires_at?: string | null;
  days_left: number;
  points_balance: number;
  packages: RadarPackage[];
  position?: { total: number; position: number; position_without_radar: number; position_with_radar: number } | null;
  results?: { storefront_bookings_30d: number; storefront_bookings_prev_30d: number } | null;
  history: { started_at?: string | null; expires_at: string; paid_with: 'points' | 'payment'; points_spent?: number | null; amount_uah?: number | null; is_active: boolean }[];
  rules?: RankingRules | null;
  activated?: boolean | null;
  checkout?: { action: string; fields: Record<string, string> } | null;
  checkout_url?: string | null;
}

export interface RankingRules {
  weights: { quality_max: number; proximity_max: number; free_slots: number; radar: number };
  proximity_radius_km: number;
  nearby_radius_km: number;
  radar_bonus_km: number;
}

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
      near_lat?: number;
    near_lng?: number;
}): Promise<Business[]> {
    const query = new URLSearchParams({
      city: params.city || 'Львів',
      target_date: params.target_date,
      time_period: params.time_period || 'Будь-коли',
      category: params.category || 'all',
    });
    // Координати лише якщо людина їх дала: порожні параметри
    // бекенд би відкинув, але зайвий шум у запиті ускладнює
    // читання логів.
    if (params.near_lat != null && params.near_lng != null) {
      query.set('near_lat', String(params.near_lat));
      query.set('near_lng', String(params.near_lng));
    }
    return publicFetch(`/businesses/search-available?${query}`);
  },

  async listBusinesses(limit = 50, offset = 0, revalidate?: number): Promise<Business[]> {
    return publicFetch(`/businesses/?limit=${limit}&offset=${offset}`, { revalidate });
  },

  /** Підказки адрес під час набору - для мапи в налаштуваннях. */
  async geoSuggest(token: string, q: string, lat?: number, lng?: number): Promise<{ title: string; subtitle: string; lat: number; lng: number }[]> {
    const params = new URLSearchParams({ q });
    if (lat != null && lng != null) { params.set('lat', String(lat)); params.set('lng', String(lng)); }
    return authFetch(`/crm/businesses/geo/suggest?${params}`, token);
  },

  /** Знайти координати закладу за його поточною адресою. */
  async geocodeBusiness(token: string, businessId: number): Promise<{ latitude: number; longitude: number }> {
    return authFetch(`/crm/businesses/${businessId}/geocode`, token, { method: 'POST' });
  },

  /** Власні дані: імʼя, телефон, фото, роль. Пошта - лише через Supabase Auth. */
  async getMe(token: string): Promise<{ email: string | null; full_name: string | null; phone: string | null; birthday?: string | null; avatar_url: string | null; role: string | null }> {
    return authFetch('/account/me', token);
  },

  /** Змінюються лише передані поля; avatar_url: null прибирає фото. */
  async updateMe(token: string, payload: { full_name?: string; phone?: string | null; avatar_url?: string | null; birthday?: string | null }): Promise<any> {
    return authFetch('/account/me', token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  /** «Моя робота»: розклад, заробіток і салони майстра - по всіх салонах разом. */
  /** Порядок послуг у прайсі - одним запитом. */
  async reorderServices(token: string, businessId: number, ids: number[]): Promise<void> {
    await authFetch('/services/reorder', token, { method: 'PUT', body: JSON.stringify({ business_id: businessId, ids }) });
  },

  // --- Якість роботи майстрів ---
  async getStaffQuality(token: string, businessId: number, staffId: string, period: { days?: number; from?: string; to?: string } = { days: 90 }): Promise<any> {
    const q = period.from && period.to ? `date_from=${period.from}&date_to=${period.to}` : `days=${period.days || 90}`;
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/quality?${q}`, token);
  },
  async getTeamQuality(token: string, businessId: number, days = 90): Promise<{ staff_id: string; score: number | null; rating: number | null; retention: number | null; tips_share: number | null; visits: number }[]> {
    return authFetch(`/crm/businesses/${businessId}/staff-quality?days=${days}`, token);
  },
  async setAppointmentTip(token: string, appointmentId: number, amount: number): Promise<{ id: number; tip_amount: number | null }> {
    return authFetch(`/crm/appointments/${appointmentId}/tip`, token, { method: 'PATCH', body: JSON.stringify({ amount }) });
  },

  /** Справжня історія клієнта: візити, послуги, майстри, статуси, оцінки. */
  async getClientHistory(token: string, clientId: number): Promise<{ id: number; start_time: string; status: string; service: string | null; master: string | null; price: number | null; tip: number | null; rating: number | null; comment: string | null; notes: string | null }[]> {
    return authFetch(`/crm/clients/${clientId}/history`, token);
  },

  /** Автозаповнення нового клієнта за поштою (дані - лише якщо людина вже була в закладі). */
  async lookupClient(token: string, businessId: number, email: string): Promise<{ existing_client?: { id: number; name: string }; found?: boolean; shared?: boolean; name?: string | null; phone?: string | null; birthday?: string | null }> {
    return authFetch(`/crm/clients/lookup?business_id=${businessId}&email=${encodeURIComponent(email)}`, token);
  },

  // --- База клієнтів: Excel і дублі ---
  async exportClients(token: string, businessId: number): Promise<void> {
    return downloadFile(`/crm/clients/export?business_id=${businessId}`, token, 'Клієнти.xlsx');
  },
  async downloadClientsTemplate(token: string): Promise<void> {
    return downloadFile('/crm/clients/import-template', token, 'Шаблон імпорту клієнтів.xlsx');
  },
  async importClients(token: string, businessId: number, file: File, dryRun: boolean): Promise<{
    total: number; to_create: number; skipped: number; created?: number; columns: string[]; truncated: boolean;
    skipped_rows: { row: number; name?: string; reason: string }[]; preview: { name: string; phone: string | null; email: string | null }[];
  }> {
    return uploadFile(`/crm/clients/import?business_id=${businessId}&dry_run=${dryRun}`, token, file);
  },
  async getClientDuplicates(token: string, businessId: number): Promise<{ id: number; name: string; phone: string | null; email: string | null; visits_count: number; total_spent: number; created_at: string | null }[][]> {
    return authFetch(`/crm/clients/duplicates?business_id=${businessId}`, token);
  },
  async mergeClients(token: string, keepId: number, mergeIds: number[]): Promise<{ id: number; merged: number }> {
    return authFetch(`/crm/clients/${keepId}/merge`, token, { method: 'POST', body: JSON.stringify({ merge_ids: mergeIds }) });
  },

  /** Прихід товару: +кількість, ціна і (за замовчуванням) витрата «Матеріали». */
  async restockInventoryItem(token: string, itemId: number, payload: { quantity: number; cost_per_unit?: number; add_expense?: boolean; note?: string }): Promise<InventoryItem> {
    return authFetch(`/crm/inventory/${itemId}/restock`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  // --- Доступи й журнал ---
  async getMyAccess(token: string, businessId: number): Promise<{ role: string; sections: Record<string, boolean> }> {
    return authFetch(`/crm/businesses/${businessId}/me/access`, token);
  },
  async getStaffAccess(token: string, businessId: number, staffId: string): Promise<{ role: string; sections: Record<string, boolean>; defaults?: Record<string, boolean>; editable: boolean }> {
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/access`, token);
  },
  async setStaffAccess(token: string, businessId: number, staffId: string, payload: { role?: 'master' | 'admin'; sections?: Record<string, boolean> }): Promise<{ role: string; sections: Record<string, boolean> }> {
    return authFetch(`/crm/businesses/${businessId}/staff/${staffId}/access`, token, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async escalateStaffRequest(token: string, businessId: number, id: number, note?: string): Promise<any> {
    return authFetch(`/crm/businesses/${businessId}/staff-requests/${id}/escalate`, token, { method: 'POST', body: JSON.stringify({ note }) });
  },
  /** Журнал дій: сторінка подій за курсором (before_id) з фільтрами. */
  async getAuditLog(token: string, businessId: number, params: AuditQuery = {}): Promise<AuditPage> {
    return authFetch(`/crm/businesses/${businessId}/audit${auditQs(params)}`, token);
  },

  /** Скільки подій за період: загалом, за розділами й за людьми. */
  async getAuditSummary(token: string, businessId: number, params: Pick<AuditQuery, 'q' | 'date_from' | 'date_to'> = {}): Promise<AuditSummary> {
    return authFetch(`/crm/businesses/${businessId}/audit/summary${auditQs(params)}`, token);
  },

  // --- Інструменти майстра ---
  async listMyRequests(token: string, businessId: number): Promise<any[]> {
    return authFetch(`/work/me/requests?business_id=${businessId}`, token);
  },
  async createStaffRequest(token: string, payload: any): Promise<any> {
    return authFetch('/work/me/requests', token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async cancelStaffRequest(token: string, id: number): Promise<void> {
    await authFetch(`/work/me/requests/${id}`, token, { method: 'DELETE' });
  },
  async listStaffRequests(token: string, businessId: number, status = 'pending'): Promise<any[]> {
    return authFetch(`/crm/businesses/${businessId}/staff-requests?status=${status}`, token);
  },
  async decideStaffRequest(token: string, businessId: number, id: number, approve: boolean, note?: string): Promise<any> {
    return authFetch(`/crm/businesses/${businessId}/staff-requests/${id}/decide`, token, { method: 'POST', body: JSON.stringify({ approve, note }) });
  },
  async listMyClients(token: string, businessId: number): Promise<any[]> {
    return authFetch(`/work/me/clients?business_id=${businessId}`, token);
  },
  async listMyPortfolio(token: string, businessId: number): Promise<any[]> {
    return authFetch(`/work/me/portfolio?business_id=${businessId}`, token);
  },
  async addPortfolioItem(token: string, payload: { business_id: number; image_url: string; caption?: string }): Promise<any> {
    return authFetch('/work/me/portfolio', token, { method: 'POST', body: JSON.stringify(payload) });
  },
  async deletePortfolioItem(token: string, id: number): Promise<void> {
    await authFetch(`/work/me/portfolio/${id}`, token, { method: 'DELETE' });
  },
  async getPublicPortfolio(businessId: number): Promise<{ user_id: string; name: string; avatar_url: string | null; items: { id: number; image_url: string; caption: string | null }[] }[]> {
    return publicFetch(`/public/businesses/${businessId}/portfolio`);
  },

  /** Скільки моїх записів у кожен день місяця: {"2026-09-24": 3}. */
  async getMyCalendar(token: string, businessId: number | null | undefined, month: string): Promise<Record<string, number>> {
    return authFetch(`/work/me/calendar?month=${month}${businessId ? `&business_id=${businessId}` : ''}`, token);
  },

  /** Мої записи й особистий час на день. */
  async getMyAgenda(token: string, businessId: number | null | undefined, date: string): Promise<any[]> {
    return authFetch(`/work/me/agenda?date=${date}${businessId ? `&business_id=${businessId}` : ''}`, token);
  },

  async addTimeOff(token: string, payload: { business_id: number; start_time: string; end_time: string; note?: string }): Promise<any> {
    return authFetch('/work/me/time-off', token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async removeTimeOff(token: string, id: number): Promise<void> {
    await authFetch(`/work/me/time-off/${id}`, token, { method: 'DELETE' });
  },

  /** Мій графік - той, що виставив салон у «Команді». source: master | salon. */
  async getMyShifts(token: string, businessId: number): Promise<{ source: 'master' | 'salon'; shifts: { day: string; active: boolean; start: string; end: string }[] }> {
    return authFetch(`/work/me/shifts?business_id=${businessId}`, token);
  },

  /** «Моя робота». З businessId - лише один заклад (для кабінету майстра). */
  async getMyWorkStats(token: string, days: number, businessId?: number): Promise<any> {
    return authFetch(`/work/me/stats?days=${days}${businessId ? `&business_id=${businessId}` : ""}`, token);
  },

  async getMyWork(token: string, businessId?: number): Promise<any> {
    return authFetch(businessId ? `/work/me?business_id=${businessId}` : '/work/me', token);
  },

  /** Гаманець: баланс бонусів BookEra, історія й подарункові картки. */
  async getWallet(token: string): Promise<{
    bonus_balance: number;
    bonus_history: { amount: number; reason: string; business_name: string | null; created_at: string | null }[];
    gift_cards: any[];
  }> {
    return authFetch('/wallet/my', token);
  },

  /** Купівля подарункової картки. checkout_url - куди вести на оплату (null, якщо вже оплачено). */
  async buyGiftCard(token: string, payload: {
    business_id: number; amount: number; recipient_name?: string; recipient_email?: string; message?: string;
  }): Promise<{ card: any; checkout_url: string | null; checkout?: { action: string; fields: Record<string, string> } | null }> {
    return authFetch('/wallet/gift-cards', token, { method: 'POST', body: JSON.stringify(payload) });
  },

  /** Відгук на власний завершений візит - за токеном керування записом. */
  async createVisitReview(appointmentId: number, token: string, payload: { master_rating?: number; salon_rating: number; comment?: string }): Promise<{ ok: boolean }> {
    return publicFetch(`/appointments/${appointmentId}/review`, {
      method: 'POST',
      body: JSON.stringify({ token, ...payload }),
    });
  },

  /** Перші вільні години на дату для кількох закладів - одним запитом. */
  async getTodaySlots(businessIds: number[], date: string): Promise<Record<string, string[]>> {
    return publicFetch(`/appointments/today-slots?business_ids=${businessIds.join(',')}&target_date=${date}`);
  },

  /** Найближче вільне вікно для кожної послуги закладу - одним запитом. */
  async getNearestSlots(businessId: number): Promise<Record<string, string>> {
    return publicFetch(`/appointments/nearest-slots?business_id=${businessId}`);
  },

  async getAvailableSlots(params: {
    business_id: number;
    service_id: number;
    target_date: string;
    master_id?: string;
    step_minutes?: number;
    /** Сумарна тривалість візиту з додатковими послугами. */
    duration_minutes?: number;
  }): Promise<AvailableSlotsResponse> {
    const query = new URLSearchParams({
      business_id: String(params.business_id),
      service_id: String(params.service_id),
      target_date: params.target_date,
      master_id: params.master_id || '0',
    });
    // step_minutes надсилаємо ЛИШЕ якщо він заданий явно.
    //
    // Раніше тут стояло `params.step_minutes || 15`, тобто 15 летіло
    // завжди - і налаштування «крок сітки» в кабінеті не працювало
    // взагалі: сервер отримував 15 і брав його замість свого значення.
    if (params.step_minutes) query.set('step_minutes', String(params.step_minutes));
    if (params.duration_minutes) query.set('duration_minutes', String(params.duration_minutes));
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
    addon_service_ids?: number[];
  }): Promise<Appointment> {
    return publicFetch(`/appointments`, { method: 'POST', body: JSON.stringify(payload) });
  },

  /** Клієнт переглядає своє бронювання за токеном з листа - без логіну. */
  /** Відгук і чайові за візит - за токеном із листа. */
  async getVisitFeedback(appointmentId: number, token: string): Promise<any> {
    return publicFetch(`/appointments/${appointmentId}/feedback?token=${encodeURIComponent(token)}`);
  },
  async deleteVisitReview(appointmentId: number, token: string): Promise<void> {
    await publicFetch(`/appointments/${appointmentId}/review?token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  },
  async tipMaster(appointmentId: number, token: string, amount: number): Promise<{ status: string; checkout_url: string | null; checkout?: { action: string; fields: Record<string, string> } | null; amount: number }> {
    return publicFetch(`/appointments/${appointmentId}/tip`, { method: 'POST', body: JSON.stringify({ token, amount }) });
  },

  async getAppointmentForClient(appointmentId: number, token: string): Promise<Appointment> {
    return publicFetch(`/appointments/${appointmentId}/manage?token=${encodeURIComponent(token)}`);
  },

  /** Клієнт переносить своє бронювання за токеном керування записом. */
  async rescheduleByClient(appointmentId: number, token: string, startTime: string): Promise<Appointment> {
    return publicFetch(`/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ token, start_time: startTime }),
    });
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


  async checkGiftCertificate(code: string, businessId: number): Promise<{ valid: boolean; remaining_amount?: number; message: string }> {
    return publicFetch(`/public/gift-certificates/check`, {
      method: 'POST',
      body: JSON.stringify({ code, business_id: businessId }),
    });
  },

  /** Що за запрошення - для сторінки прийняття, ще до входу. */
  async getInviteInfo(inviteToken: string): Promise<any> {
    return publicFetch(`/public/invites/${encodeURIComponent(inviteToken)}`);
  },

  /** Скасувати запрошення - посилання з нього більше не спрацює. */
  async cancelInvite(token: string, businessId: number, inviteId: number): Promise<void> {
    await authFetch(`/crm/businesses/${businessId}/invites/${inviteId}`, token, { method: 'DELETE' });
  },

  async acceptStaffInvite(token: string, inviteToken: string): Promise<{ status: string; business_id: number; role: string }> {
    return authFetch(`/public/invites/accept`, token, { method: 'POST', body: JSON.stringify({ token: inviteToken }) });
  },

  // === CRM: БІЗНЕС ===

  async getMyProfile(token: string): Promise<{
    id: string; email: string; full_name?: string; role: string | null;
    business_id: number | null; business: Business | null;
    subscription: SubscriptionState | null;
  }> {
    return authFetch(`/crm/businesses/me`, token);
  },

  /**
   * Створити платіж за підписку.
   *
   * Свідомо не вимагає чинної підписки: платити треба саме тоді, коли
   * доступ уже завершився.
   */
  async createSubscriptionCheckout(token: string, businessId: number): Promise<{
    payment_url: string | null; order_id: string; amount: number; period_days: number;
    activated?: boolean;
    checkout?: { action: string; fields: Record<string, string> } | null;
  }> {
    return authFetch(`/platform/subscription/checkout?business_id=${businessId}`, token, { method: 'POST' });
  },

  /** Підписка для «Налаштувань»: стан, ціна, історія оплат (лише власник). */
  async getSubscriptionOverview(token: string, businessId: number): Promise<SubscriptionOverview> {
    return authFetch(`/platform/subscription?business_id=${businessId}`, token);
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
      latitude?: number;
      longitude?: number;
      show_phone_publicly?: boolean;
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

  async listPublicMasters(businessId: number): Promise<{ id: string; full_name?: string; specialization?: string; avatar_url?: string ; show_in_storefront?: boolean; rating?: number | null; reviews_count?: number}[]> {
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

  /**
   * Розсилка клієнтам закладу.
   *
   * Повертає, скільки листів поставлено в чергу і скільки контактів
   * узагалі без пошти - власник має розуміти, чому листів менше,
   * ніж клієнтів у базі.
   */
  async sendCampaign(token: string, payload: {
    business_id: number; subject: string; message: string; audience?: 'all' | 'regular' | 'lapsed';
  }): Promise<{ queued: number; total_clients: number; without_email: number }> {
    return authFetch('/crm/campaigns', token, { method: 'POST', body: JSON.stringify(payload) });
  },

  /** Скільки людей отримає розсилку для кожної аудиторії - до відправки. */
  async getCampaignAudience(token: string, businessId: number): Promise<{
    all: number; regular: number; lapsed: number; total_clients: number; without_email: number;
  }> {
    return authFetch(`/crm/campaigns/audience?business_id=${businessId}`, token);
  },

  /** Оновити правила бронювання за профілем закладу. */
  async applyProfileDefaults(token: string, businessId: number): Promise<{ booking_settings: any }> {
    return authFetch(`/crm/businesses/${businessId}/apply-profile-defaults`, token, { method: 'POST' });
  },

  /** Видалити заклад. Потребує точної назви - підтвердження галочкою
   *  для незворотної дії недостатньо. */
  async deleteBusiness(token: string, businessId: number, confirmName: string): Promise<void> {
    await authFetch(`/crm/businesses/${businessId}`, token, {
      method: 'DELETE',
      body: JSON.stringify({ confirm_name: confirmName }),
    });
  },

  /**
   * Пряме посилання закладу - за ним клієнт зараховується як власний
   * і комісія не стягується.
   *
   * Окремий запит, а не поле у відповіді закладу: та схема публічна,
   * і токен у ній означав би, що будь-хто може підставити його
   * у власне посилання.
   */
  async getDirectLink(token: string, businessId: number): Promise<{
    direct_url: string; marketplace_url: string; token: string;
  }> {
    return authFetch(`/crm/businesses/${businessId}/direct-link`, token);
  },

  /**
   * Записи поточного користувача - для сторінки профілю.
   *
   * Шукаються за поштою й телефоном: людина записується як гість,
   * і жодного звʼязку з її акаунтом при цьому не виникає.
   */
  async listMyAppointments(token: string): Promise<any[]> {
    return authFetch('/appointments/my', token);
  },

  /** Збережені заклади поточного користувача. */
  async listMyFavorites(token: string): Promise<any[]> {
    return authFetch('/businesses/favorites/my', token);
  },

  async addFavorite(token: string, businessId: number): Promise<void> {
    await authFetch(`/businesses/${businessId}/favorite`, token, { method: 'POST' });
  },

  async removeFavorite(token: string, businessId: number): Promise<void> {
    await authFetch(`/businesses/${businessId}/favorite`, token, { method: 'DELETE' });
  },

  /**
   * Відстані по дорогах від точки людини до закладів.
   *
   * POST, бо список id буває довгим і в адресному рядку впреться
   * в обмеження довжини.
   */
  async getDistances(lat: number, lng: number, businessIds: number[]): Promise<
    Record<string, { km: number; is_road: boolean }>
  > {
    const res = await fetch(`${API_URL}/businesses/distances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, business_ids: businessIds }),
    });
    return handle(res);
  },

  // === Робота в кількох закладах ===

  /** Заклади, у яких людина працює. */
  async listMyWorkplaces(token: string): Promise<{
    business_id: number; name: string; slug: string; city: string | null;
    logo: string | null; role: string; is_current: boolean; has_access: boolean;
  }[]> {
    return authFetch(`/crm/businesses/my-workplaces`, token);
  },

  /** Перемкнутись на інший заклад. Разом із закладом перемикається й роль. */
  async switchWorkplace(token: string, businessId: number): Promise<{ business_id: number; role: string }> {
    return authFetch(`/crm/businesses/switch-workplace`, token, {
      method: 'POST', body: JSON.stringify({ business_id: businessId }),
    });
  },

  // === Справи на день ===
  // Раніше цей список жив лише в localStorage: зникав при чистці кешу
  // і не бачився з іншого пристрою.

  async listTasks(token: string, businessId: number, taskDate?: string): Promise<{
    id: number; business_id: number; task_date: string; text: string; completed: boolean;
  }[]> {
    const q = taskDate ? `&task_date=${taskDate}` : '';
    return authFetch(`/crm/tasks?business_id=${businessId}${q}`, token);
  },

  async createTask(token: string, payload: { business_id: number; task_date: string; text: string }) {
    return authFetch(`/crm/tasks`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateTask(token: string, taskId: number, payload: { text?: string; completed?: boolean }) {
    return authFetch(`/crm/tasks/${taskId}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async deleteTask(token: string, taskId: number): Promise<void> {
    await authFetch(`/crm/tasks/${taskId}`, token, { method: 'DELETE' });
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
    addon_service_ids?: number[];
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

  /** Аналітика за період - усі цифри рахує сервер. Дати: YYYY-MM-DD. */
  async getAnalytics(
    token: string, businessId: number, dateFrom: string, dateTo: string, compare?: { from: string; to: string },
  ): Promise<Analytics> {
    const extra = compare ? `&compare_from=${compare.from}&compare_to=${compare.to}` : '';
    return authFetch(`/crm/businesses/${businessId}/analytics?date_from=${dateFrom}&date_to=${dateTo}${extra}`, token);
  },

  /** Ціль доходу на місяць (null - прибрати). */
  async setMonthlyGoal(token: string, businessId: number, amount: number | null): Promise<Analytics['goal']> {
    return authFetch(`/crm/businesses/${businessId}/analytics/goal`, token, { method: 'PUT', body: JSON.stringify({ amount }) });
  },

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

  /** Радар: стан, ціни пакетів, позиція у видачі, результат, історія. */
  async getRadarStatus(token: string, businessId: number): Promise<RadarOverview> {
    return authFetch(`/crm/businesses/${businessId}/radar`, token);
  },

  /** Оплата пакета балами (days: 7 / 14 / 30). */
  async activateRadarWithPoints(token: string, businessId: number, days: number): Promise<RadarOverview> {
    return authFetch(`/crm/businesses/${businessId}/radar/activate-with-points`, token, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  },

  /** Оплата пакета карткою. Відповідь: activated - дні вже нараховано, інакше checkout - на сторінку оплати. */
  async checkoutRadar(token: string, businessId: number, days: number): Promise<RadarOverview> {
    return authFetch(`/crm/businesses/${businessId}/radar/checkout`, token, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  },

  /** Ваги позиції у видачі - ті самі, що на сервері. */
  async getRankingRules(revalidate?: number): Promise<RankingRules> {
    return publicFetch('/businesses/ranking-rules', { revalidate });
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
