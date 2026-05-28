export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  is_active: boolean;
  last_seen?: string;
  created_at?: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  capacity: number;
  current_lat?: number;
  current_lng?: number;
  status: 'idle' | 'active';
  created_at: string;
  users?: { name: string; phone: string };
}

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

export interface QueueItem {
  queue_id: string;
  order_id: string;
  reason: string;
  queued_at: string;
  pickup_address: string;
  delivery_address: string;
  sender_id: string;
  is_live_injection: boolean;
}

export interface Session {
  session_id: string;
  user_id: string;
  name: string;
  role: string;
  phone: string;
  logged_in_at: string;
  last_active: string;
}