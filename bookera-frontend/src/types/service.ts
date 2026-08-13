export interface Service {
  id: number | string;
  business_id: number;
  name: string;
  duration: number;
  duration_minutes?: number;
  price: number;
  category?: string;
  order_index?: number;
  is_group?: boolean;
  max_participants?: number;
  addon_service_ids?: (number | string)[];
}