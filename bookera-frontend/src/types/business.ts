export interface ShiftDay {
  day: string;
  active: boolean;
  start: string;
  end: string;
}

export interface CalendarSettings {
  defaultView: 'day' | 'week' | 'month';
  displayMode: 'fit' | 'fill';
  colorScheme: 'pastel' | 'vivid';
  colorMode: 'master' | 'category';
}

export interface TaskItem {
  id: number;
  text: string;
  completed: boolean;
  date: string;
}

export interface Business {
  id: number;
  owner_id: string;
  name: string;
  slug: string;
  address: string;
  category?: string;
  city?: string;
  description?: string;
  business_type?: string;
  workspace_type?: string;
  shifts?: ShiftDay[];
  cover_photo?: string;
  logo?: string;
  phone?: string;
  rating?: number;
  reviews_count?: number;
  working_hours?: string;
  workplace_photos?: string[];
  is_radar_active?: boolean;
  virtual_balance?: number;
  cal_settings?: CalendarSettings;
  tasks?: TaskItem[];
  created_at?: string;
  updated_at?: string;
}