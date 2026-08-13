export type UserRole = 'client' | 'owner' | 'admin' | 'master';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  role: UserRole;
  business_id?: number | null;
  created_at?: string;
}

export interface StaffMember {
  id: number | string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  photo?: string | null;
  avatar_url?: string | null;
  provides_services?: boolean;
  assigned_services?: (string | number)[];
  shifts?: any[];
  fixed_salary?: number;
  payout_period?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  payout_day?: string | number;
}