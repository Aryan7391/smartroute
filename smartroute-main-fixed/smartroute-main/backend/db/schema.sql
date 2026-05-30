-- ============================================================
-- SMARTROUTE DATABASE SCHEMA
-- Version 1.0 | May 2026
-- Run this in Supabase SQL Editor
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('admin', 'manager', 'sender', 'driver');

create type order_status as enum (
  'pending',        -- assigned to vehicle, not yet picked up
  'picked_up',      -- in vehicle, heading to delivery
  'delivered',      -- successfully delivered
  'failed_pickup',  -- sender not present
  'failed_delivery',-- receiver not present (attempt 1 or 2)
  'escalated',      -- failed twice, admin notified
  'return_to_sender',-- receiver cancelled, going back
  'returned',       -- back with sender
  'queued'          -- waiting for a vehicle
);

create type vehicle_status as enum (
  'idle',           -- no active route
  'active'          -- on route
);

create type stop_type as enum (
  'pickup',
  'delivery',
  'return'
);


-- ============================================================
-- USERS
-- ============================================================

create table users (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  phone           text not null unique,
  email           text unique,
  password_hash   text not null,
  role            user_role not null,
  is_active       boolean not null default true,
  last_seen       timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_users_role on users(role);
create index idx_users_phone on users(phone);


-- ============================================================
-- SESSIONS
-- for admin to track who is logged in and kick out managers
-- ============================================================

create table sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  token         text not null unique,
  created_at    timestamptz not null default now(),
  last_active   timestamptz not null default now(),
  is_active     boolean not null default true
);

create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_token on sessions(token);
create index idx_sessions_active on sessions(is_active);


-- ============================================================
-- VEHICLES
-- ============================================================

create table vehicles (
  id            uuid primary key default uuid_generate_v4(),
  driver_id     uuid not null references users(id) on delete restrict,
  capacity      int not null check (capacity > 0),   -- max number of orders at once
  current_lat   double precision,
  current_lng   double precision,
  max_weight    float not null default 100.0,   -- max cargo weight in kg
  status        vehicle_status not null default 'idle',
  created_at    timestamptz not null default now()
);

create index idx_vehicles_driver on vehicles(driver_id);
create index idx_vehicles_status on vehicles(status);


-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                  uuid primary key default uuid_generate_v4(),
  sender_id           uuid not null references users(id) on delete restrict,
  assigned_vehicle_id uuid references vehicles(id) on delete set null,
  current_vehicle_id  uuid references vehicles(id) on delete set null,

  -- Pickup details
  pickup_address      text not null,
  pickup_lat          double precision not null,
  pickup_lng          double precision not null,
  pickup_otp          text not null,

  -- Delivery details
  delivery_address    text not null,
  delivery_lat        double precision not null,
  delivery_lng        double precision not null,
  delivery_otp        text,           -- generated only after pickup is confirmed
  receiver_phone      text,          -- for WhatsApp notification and driver call           -- generated only after pickup is confirmed
  receiver_name       text,
  item_count          int not null check (item_count > 0),
  approx_weight       float not null check (approx_weight > 0), -- in kg
  item_description     text,
  -- State
  status              order_status not null default 'pending',
  attempt_count       int not null default 0 check (attempt_count >= 0),
  is_live_injection   boolean not null default false,
  is_return_to_sender boolean not null default false,

  created_at          timestamptz not null default now(),
  picked_up_at        timestamptz,
  delivered_at        timestamptz
);

create index idx_orders_sender on orders(sender_id);
create index idx_orders_status on orders(status);
create index idx_orders_assigned_vehicle on orders(assigned_vehicle_id);
create index idx_orders_current_vehicle on orders(current_vehicle_id);


-- ============================================================
-- STOPS
-- each row is one stop on a vehicle's route
-- ============================================================

create table stops (
  id            uuid primary key default uuid_generate_v4(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  order_id      uuid not null references orders(id) on delete cascade,
  type          stop_type not null,
  sequence      int not null,          -- position in the route
  lat           double precision not null,
  lng           double precision not null,
  is_done       boolean not null default false,
  arrived_at    timestamptz,           -- when driver reached the stop
  completed_at  timestamptz,           -- when OTP was confirmed
  created_at    timestamptz not null default now()
);

create index idx_stops_vehicle on stops(vehicle_id);
create index idx_stops_order on stops(order_id);
create index idx_stops_vehicle_sequence on stops(vehicle_id, sequence);
create index idx_stops_done on stops(is_done);


-- ============================================================
-- VEHICLE INVENTORY
-- tracks what is physically inside each vehicle at any moment
-- ============================================================

create table vehicle_inventory (
  id            uuid primary key default uuid_generate_v4(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  order_id      uuid not null references orders(id) on delete cascade,
  loaded_at     timestamptz not null default now(),
  unloaded_at   timestamptz           -- null means still in vehicle
);

create index idx_inventory_vehicle on vehicle_inventory(vehicle_id);
create index idx_inventory_order on vehicle_inventory(order_id);
create index idx_inventory_active on vehicle_inventory(vehicle_id) where unloaded_at is null;


-- ============================================================
-- QUEUE
-- orders waiting for a vehicle to become available
-- ============================================================

create table queue (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null unique references orders(id) on delete cascade,
  reason      text,                   -- why it was queued (e.g. 'no capacity', 'no corridor match', 'all vehicles busy')
  created_at  timestamptz not null default now()
);

create index idx_queue_created on queue(created_at);


-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Active inventory per vehicle (what is currently inside each vehicle)
create view active_inventory as
  select
    vi.vehicle_id,
    vi.order_id,
    vi.loaded_at,
    o.pickup_address,
    o.delivery_address,
    o.status
  from vehicle_inventory vi
  join orders o on o.id = vi.order_id
  where vi.unloaded_at is null;

-- Current queue with order details
create view queue_detail as
  select
    q.id as queue_id,
    q.order_id,
    q.reason,
    q.created_at as queued_at,
    o.pickup_address,
    o.delivery_address,
    o.sender_id,
    o.is_live_injection
  from queue q
  join orders o on o.id = q.order_id
  order by q.created_at asc;

-- Active sessions (for admin dashboard)
create view active_sessions as
  select
    s.id as session_id,
    s.user_id,
    u.name,
    u.role,
    u.phone,
    s.created_at as logged_in_at,
    s.last_active
  from sessions s
  join users u on u.id = s.user_id
  where s.is_active = true
  order by s.last_active desc;

-- ============================================================
-- MIGRATIONS
-- ============================================================

-- v1.1: Added max_weight to vehicles (run if upgrading from v1.0 schema)
-- ALTER TABLE vehicles ADD COLUMN max_weight float not null default 100.0;
