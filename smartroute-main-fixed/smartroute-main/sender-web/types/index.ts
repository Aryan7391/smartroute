export interface Order {
  id: string;
  sender_id: string;
  assigned_vehicle_id?: string;
  current_vehicle_id?: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_otp: string;
  delivery_otp?: string;
  receiver_phone?: string;
  status: string;
  attempt_count: number;
  is_live_injection: boolean;
  is_return_to_sender: boolean;
  created_at: string;
  picked_up_at?: string;
  delivered_at?: string;
  receiver_name?: string;
  item_count?:       number;
  approx_weight?:    number;
  item_description?: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  capacity: number;
  current_lat?: number;
  current_lng?: number;
  status: 'idle' | 'active';
  users?: { name: string; phone: string };
}
export interface Stop {
  id: string;
  vehicle_id: string;
  order_id: string;
  type: 'pickup' | 'delivery' | 'return';
  sequence: number;
  lat: number;
  lng: number;
  is_done: boolean;
  arrived_at?: string;
  completed_at?: string;
  orders?: {
    pickup_address: string;
    delivery_address: string;
  };
}