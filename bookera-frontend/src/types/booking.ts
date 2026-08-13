export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no-show' | 'late' | 'blocked';

export type BookingSource = 'DIRECT' | 'BOOKERA';

export interface Booking {
  id: number | string;
  business_id: number;
  service_id?: number | string | null;
  staff_id?: number | string | null;
  client_id?: string | null;
  client_name: string;
  client_phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source?: BookingSource | string;
  block_reason?: string;
  service_name?: string;
  master_name?: string;
  created_at?: string;
  expires_at?: string;
}

export interface SmartSlot {
  id: string;
  date: string;
  time: string;
  type?: string;
  title?: string;
  insight?: string;
  suggestedPromo?: number;
  audience?: string;
  [key: string]: any; // Дозволяє додаткові атрибути без помилок TS
}