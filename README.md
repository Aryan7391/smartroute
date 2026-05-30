# SmartRoute — Codebase Wiki

> Smart routing and delivery management system — FastAPI backend + two Next.js web apps + Expo mobile (in progress).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Database Schema](#3-database-schema)
4. [Backend — FastAPI](#4-backend--fastapi)
   - [Entry Point & Middleware](#41-entry-point--middleware)
   - [Auth & Sessions](#42-auth--sessions)
   - [Orders](#43-orders)
   - [Vehicles](#44-vehicles)
   - [Driver Endpoints](#45-driver-endpoints)
   - [Admin Endpoints](#46-admin-endpoints)
   - [Queue Endpoints](#47-queue-endpoints)
5. [Core Services](#5-core-services)
   - [Routing — interleave_stops & assign_and_build_routes](#51-routing)
   - [Live Injection](#52-live-injection)
   - [Queue Processing](#53-queue-processing)
   - [OTP Verification](#54-otp-verification)
   - [Notifications (stubs)](#55-notifications)
6. [Utilities](#6-utilities)
   - [Geo — Haversine](#61-geo--haversine)
   - [OSRM — Road Segments](#62-osrm--road-segments)
   - [OTP Generator](#63-otp-generator)
7. [Admin Web (Next.js)](#7-admin-web-nextjs)
8. [Sender Web (Next.js)](#8-sender-web-nextjs)
9. [Configuration & Environment](#9-configuration--environment)
10. [Order Lifecycle State Machine](#10-order-lifecycle-state-machine)
11. [Roles & Access Control](#11-roles--access-control)
12. [API Reference](#12-api-reference)
13. [Local Development & Seeding](#13-local-development--seeding)
14. [Known Limitations (MVP)](#14-known-limitations-mvp)

---

## 1. System Overview

SmartRoute is a same-day last-mile delivery platform. It manages a **fleet of vehicles**, each assigned an optimal interleaved route of **pickup and delivery stops**. Orders can be placed in bulk and dispatched together ("batch dispatch") or injected individually into live routes ("live injection").

**Key concepts:**

| Concept | Description |
|---|---|
| **Order** | A sender-to-receiver parcel with pickup and delivery geo-coordinates, OTPs, weight, and item count. |
| **Vehicle** | A delivery vehicle with a driver, capacity (max simultaneous orders), max weight, and live GPS location. |
| **Stop** | One waypoint on a vehicle's route — either a pickup or delivery for a specific order, with a sequence number. |
| **Route** | The ordered list of stops for a vehicle, computed by the greedy interleave algorithm. |
| **Queue** | Orders that could not be assigned to any vehicle (capacity/weight/no match) — held for the next available vehicle. |
| **Live Injection** | An order injected into a currently-active route without requiring re-dispatch of the whole fleet. |
| **OTP** | A 6-digit code used to verify pickup (sender hands over parcel) and delivery (receiver accepts parcel). |
| **Segment** | The OSRM road geometry between two consecutive stops, stored in `route_segments` for map display. |

---

## 2. Repository Structure

```
smartroute/
├── backend/                     FastAPI + Supabase
│   ├── app/
│   │   ├── main.py              App entry point
│   │   ├── core/
│   │   │   ├── config.py        Pydantic settings (env vars)
│   │   │   ├── security.py      Password hashing, JWT
│   │   │   └── dependencies.py  Auth guards, role checks (FastAPI Depends)
│   │   ├── db/
│   │   │   └── client.py        Supabase client singleton
│   │   ├── api/v1/
│   │   │   ├── router.py        Mounts all endpoint routers under /api/v1
│   │   │   └── endpoints/
│   │   │       ├── auth.py      Register, login, logout, me, sessions
│   │   │       ├── orders.py    Create, dispatch, inject, fail, return
│   │   │       ├── vehicles.py  Register, list, location update, inventory
│   │   │       ├── driver.py    Route, arrived, confirm pickup/delivery, complete
│   │   │       ├── admin.py     Fleet view, users, escalations, day controls
│   │   │       └── queue.py     List, retry, cancel queue items
│   │   ├── services/
│   │   │   ├── routing.py       interleave_stops, assign_and_build_routes
│   │   │   ├── injection.py     inject_order (live route injection)
│   │   │   ├── queue.py         process_queue_for_vehicle
│   │   │   ├── otp.py           verify_pickup_otp, verify_delivery_otp
│   │   │   ├── auth.py          Auth business logic
│   │   │   └── notification.py  Notification stubs (WhatsApp/SMS)
│   │   ├── schemas/             Pydantic I/O models
│   │   │   ├── order.py
│   │   │   ├── auth.py
│   │   │   ├── vehicle.py
│   │   │   ├── stop.py
│   │   │   └── user.py
│   │   ├── models/              Supabase direct (placeholders only)
│   │   └── utils/
│   │       ├── geo.py           haversine_km, nearest
│   │       ├── osrm.py          Road segment fetching and storage
│   │       └── otp.py           generate_otp
│   ├── db/
│   │   └── schema.sql           Full Supabase schema (run once)
│   ├── seed.py                  Create test drivers, vehicles, sender, orders
│   ├── seed_v2.py               Alternative seed
│   └── requirements.txt
│
├── admin-web/                   Next.js — Admin & Manager dashboard
│   ├── app/
│   │   ├── (auth)/login/        Login page
│   │   └── (dashboard)/
│   │       ├── layout.tsx       Sidebar + auth guard
│   │       ├── overview/        Stats + day controls
│   │       ├── fleet/           Live map of all vehicles
│   │       ├── orders/          Order list + detail + inject
│   │       ├── queue/           Queue list + retry
│   │       ├── escalations/     Escalated orders
│   │       ├── users/           User management
│   │       └── stats/           Charts
│   ├── lib/
│   │   ├── api.ts               Axios instance (bearer token)
│   │   └── auth.ts              Login/logout helpers
│   └── types/index.ts           TypeScript interfaces
│
└── sender-web/                  Next.js — Sender portal
    ├── app/
    │   ├── (auth)/login/
    │   └── (dashboard)/
    │       ├── layout.tsx
    │       ├── create/          Create order (map picker)
    │       ├── map/             Live vehicle map
    │       ├── orders/          Order list
    │       ├── orders/[id]/     Order detail + OTP
    │       ├── orders/[id]/sticker/ Printable delivery sticker
    │       └── track/           Public tracking page
    ├── lib/
    └── types/index.ts
```

---

## 3. Database Schema

All data lives in **Supabase (PostgreSQL)**. Run `db/schema.sql` once in the Supabase SQL editor to initialize.

### Enums

| Enum | Values |
|---|---|
| `user_role` | `admin`, `manager`, `sender`, `driver` |
| `order_status` | `pending`, `picked_up`, `delivered`, `failed_pickup`, `failed_delivery`, `escalated`, `return_to_sender`, `returned`, `queued` |
| `vehicle_status` | `idle`, `active` |
| `stop_type` | `pickup`, `delivery`, `return` |

### Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `phone` | text UNIQUE | Used as login |
| `email` | text | Optional |
| `password_hash` | text | bcrypt |
| `role` | user_role | |
| `is_active` | boolean | Soft disable |
| `last_seen` | timestamptz | |

#### `sessions`
Tracks active JWT sessions. Admin can revoke sessions (kick out managers/drivers).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `token` | text UNIQUE | JWT |
| `is_active` | boolean | Set false on logout/revoke |
| `last_active` | timestamptz | |

#### `vehicles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `driver_id` | uuid FK → users | One driver per vehicle |
| `capacity` | int | Max simultaneous orders |
| `max_weight` | float | Max total kg (optional) |
| `current_lat/lng` | double | Live location |
| `status` | vehicle_status | `idle` or `active` |

#### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `sender_id` | uuid FK → users | |
| `assigned_vehicle_id` | uuid FK → vehicles | Set on dispatch/injection |
| `current_vehicle_id` | uuid FK → vehicles | Tracks physical location |
| `pickup_address/lat/lng` | text/double | |
| `pickup_otp` | text | Generated on order creation |
| `delivery_address/lat/lng` | text/double | |
| `delivery_otp` | text | Generated on pickup confirmation |
| `receiver_phone` | text | For WhatsApp notification |
| `receiver_name` | text | |
| `item_count` | int | |
| `approx_weight` | float | kg — used for weight routing checks |
| `item_description` | text | |
| `status` | order_status | See state machine §10 |
| `attempt_count` | int | Failed delivery attempts (escalates at 2) |
| `is_live_injection` | boolean | True if injected mid-route |
| `is_return_to_sender` | boolean | |
| `picked_up_at / delivered_at` | timestamptz | |

#### `stops`
Each row = one waypoint on a vehicle's route.

| Column | Type | Notes |
|---|---|---|
| `vehicle_id` | uuid FK | |
| `order_id` | uuid FK | |
| `type` | stop_type | `pickup` or `delivery` |
| `sequence` | int | Route order (1, 2, 3…) |
| `lat / lng` | double | |
| `is_done` | boolean | Completed stops |
| `arrived_at` | timestamptz | When driver marked arrived |
| `completed_at` | timestamptz | When OTP was confirmed |

#### `vehicle_inventory`
Tracks what is physically inside each vehicle at any moment.

| Column | Notes |
|---|---|
| `vehicle_id` | |
| `order_id` | |
| `loaded_at` | Pickup confirmed |
| `unloaded_at` | null = still in vehicle; set on delivery |

#### `queue`
Orders waiting for vehicle assignment.

| Column | Notes |
|---|---|
| `order_id` | UNIQUE — one queue entry per order |
| `reason` | Why it was queued |
| `created_at` | FIFO ordering |

#### `route_segments` *(implicit — used by OSRM util)*
Stores GeoJSON road geometries for map display.

| Column | Notes |
|---|---|
| `vehicle_id` | |
| `from_sequence / to_sequence` | Stop sequence range this segment covers |
| `geometry` | GeoJSON from OSRM |
| `is_done` | Marked true as driver progresses |

### Views

| View | Purpose |
|---|---|
| `active_inventory` | Orders currently inside each vehicle (unloaded_at IS NULL) |
| `queue_detail` | Queue with order details joined |
| `active_sessions` | Active sessions with user name/role |

---

## 4. Backend — FastAPI

### 4.1 Entry Point & Middleware

**`app/main.py`**

- Creates the FastAPI app with title "SmartRoute API v1.0.0"
- Adds `CORSMiddleware` with `allow_origins=["*"]` (tighten before production)
- Mounts the v1 router under `/api/v1`
- Exposes `GET /` and `GET /health` health-check endpoints

### 4.2 Auth & Sessions

**`app/api/v1/endpoints/auth.py`**

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/auth/register` | POST | Public | Create a new user (any role) |
| `/auth/login` | POST | Public | Returns JWT; creates a session row |
| `/auth/logout` | POST | Any | Marks current session inactive |
| `/auth/me` | GET | Any | Returns current user profile |
| `/auth/sessions` | GET | Admin | Lists all active sessions |
| `/auth/sessions/{id}` | DELETE | Admin | Revokes a session (kick user) |

**JWT flow:** On login a JWT is signed with `JWT_SECRET`. Every request passes the token in `Authorization: Bearer <token>`. `get_current_user` dependency validates the token AND checks the session row is still active (allowing server-side revocation).

### 4.3 Orders

**`app/api/v1/endpoints/orders.py`**

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/orders/` | POST | sender/admin/manager | Create order. Generates `pickup_otp`. If system not accepting orders, immediately queues. |
| `/orders/my` | GET | sender | All orders for logged-in sender |
| `/orders/{id}` | GET | any (sender sees own only) | Single order detail |
| `/orders/dispatch` | POST | admin/manager | Assigns all unassigned pending orders to idle vehicles, builds routes |
| `/orders/{id}/inject` | POST | admin/manager | Live-inject a single order into active routes |
| `/orders/{id}/fail-pickup` | PATCH | driver/admin/manager | Mark pickup failed; notify sender |
| `/orders/{id}/fail-delivery` | PATCH | driver/admin/manager | Increment attempt count; escalate at 2 failures |
| `/orders/{id}/return-to-sender` | PATCH | admin/manager | Set return_to_sender flag; notify sender |

### 4.4 Vehicles

**`app/api/v1/endpoints/vehicles.py`**

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/vehicles/` | POST | admin/manager | Register a new vehicle with a driver |
| `/vehicles/` | GET | admin/manager | List all vehicles (with driver details) |
| `/vehicles/{id}/location` | PATCH | driver | Update vehicle GPS coordinates |

The `vehicle_inventory` sub-resource is accessible via admin and driver endpoints.

### 4.5 Driver Endpoints

**`app/api/v1/endpoints/driver.py`**

| Endpoint | Method | Description |
|---|---|---|
| `/driver/my-route` | GET | Returns vehicle info + all undone stops (with order addresses) |
| `/driver/my-inventory` | GET | Returns items currently inside the vehicle |
| `/driver/arrived/{stop_id}` | POST | Records `arrived_at`; notifies sender (pickup) or receiver (delivery) |
| `/driver/confirm-pickup/{order_id}` | POST | Verifies pickup OTP; loads item into vehicle; generates `delivery_otp`; notifies receiver via WhatsApp |
| `/driver/confirm-delivery/{order_id}` | POST | Verifies delivery OTP; unloads item; notifies sender |
| `/driver/route-complete` | POST | Marks vehicle idle; clears route segments; triggers queue processing |

### 4.6 Admin Endpoints

**`app/api/v1/endpoints/admin.py`**

| Endpoint | Description |
|---|---|
| `/admin/fleet` | All vehicles with driver info and stop counts |
| `/admin/orders` | All orders (with optional status filter) |
| `/admin/orders/escalated` | Only escalated orders |
| `/admin/users` | All users (admin only) |
| `/admin/day/status` | Returns `{ accepting_orders: bool }` |
| `/admin/day/start` | Enables accepting orders + triggers dispatch |
| `/admin/day/stop` | Disables new order acceptance |
| `/admin/day/resume` | Re-enables order acceptance mid-day |

Day controls write to a `system_config` table (`key=accepting_orders`, `value=true/false`).

### 4.7 Queue Endpoints

**`app/api/v1/endpoints/queue.py`**

| Endpoint | Description |
|---|---|
| `GET /queue/` | Returns `queue_detail` view (queued orders with reason) |
| `POST /queue/{id}/retry` | Re-runs `inject_order` for this queue item; removes from queue on success |
| `DELETE /queue/{id}` | Cancel/remove a queued order |

---

## 5. Core Services

### 5.1 Routing

**`app/services/routing.py`**

#### `interleave_stops(vehicle, orders) → list[stop]`

Greedy nearest-neighbor algorithm that builds an **interleaved** pickup/delivery sequence:

1. Start at vehicle's current position.
2. At each step, collect candidates:
   - All **pickups** from orders not yet in the vehicle (if `load < capacity` AND `current_weight + order.approx_weight ≤ max_weight`)
   - All **deliveries** for orders already in the vehicle
3. Choose the **nearest** candidate (Haversine distance).
4. Update position, load, and weight accordingly.
5. Repeat until all orders are delivered.

This ensures the vehicle never exceeds capacity or weight at any pickup. The sequence is returned as `[{ order_id, type, lat, lng, sequence }]`.

#### `assign_and_build_routes(order_ids) → dict`

Called by the `/dispatch` endpoint:

1. Fetch all specified orders and all idle vehicles.
2. For each order, find the **nearest idle vehicle** that has capacity and weight headroom → assign.
3. Orders with no suitable vehicle → insert into `queue` table with reason.
4. For each vehicle with assignments: call `interleave_stops`, insert `stops` rows, set vehicle status to `active`, call `save_segments` (OSRM).
5. Returns `{ vehicles_activated, total_stops, queued_orders }`.

### 5.2 Live Injection

**`app/services/injection.py`**

Constants:
- `PROXIMITY_KM = 3.0` — a stop must be within 3 km of new order's pickup or delivery
- `DETOUR_THRESHOLD = 0.40` — injecting cannot increase route distance by more than 40%

#### `inject_order(order_id) → dict`

1. Check `system_config.accepting_orders` — if false, queue immediately.
2. Fetch order and all vehicles, sorted by distance to pickup.
3. **For each vehicle (nearest first):**
   - **Idle vehicle:** If all vehicles idle OR within PROXIMITY_KM → assign directly via `_assign_to_idle` (same as dispatch for a single order).
   - **Active vehicle:** Check inventory not full; check proximity; calculate best insertion point (minimum added distance); check detour ≤ 40%; simulate weight check at every future stop → if all pass, call `_insert_into_route`.
4. If no vehicle matched → `_queue_order`.

#### `_insert_into_route(vehicle, order, remaining, insert_at)`

- Shifts sequence numbers of all subsequent stops up by 2.
- Inserts two new stop rows (pickup + delivery) at `insert_at`.
- Updates order's `assigned_vehicle_id` and sets `is_live_injection=True`.
- Calls `save_segments` for the new sub-segment only (`start_sequence=pickup_seq-1`).

### 5.3 Queue Processing

**`app/services/queue.py`**

#### `process_queue_for_vehicle(vehicle_id) → dict`

Called automatically when a driver completes their route (`/driver/route-complete`).

1. Fetch all idle vehicles (not just the one that just finished).
2. Fetch queue in FIFO order.
3. For each idle vehicle, pull a batch of up to `BATCH_SIZE=5` orders from the queue that fit weight constraints.
4. Build stops via `interleave_stops`, insert them, update orders to `pending`, delete queue entries, activate vehicle.
5. Call `save_segments` for the new route.

### 5.4 OTP Verification

**`app/services/otp.py`**

#### `verify_pickup_otp(order_id, otp)`
- Looks up order's `pickup_otp`.
- On match: marks the pickup stop `is_done=True`, `completed_at=now()`; updates order `status=picked_up`, `picked_up_at=now()`; inserts into `vehicle_inventory`; generates and saves `delivery_otp`.
- On mismatch: raises 400.

#### `verify_delivery_otp(order_id, otp)`
- Looks up order's `delivery_otp`.
- On match: marks delivery stop done; updates order `status=delivered`, `delivered_at=now()`; sets `vehicle_inventory.unloaded_at=now()`.
- On mismatch: raises 400.

### 5.5 Notifications

**`app/services/notification.py`** — All stubs (print to console). Intended for WhatsApp Business API integration.

| Function | Trigger |
|---|---|
| `notify_sender_driver_coming(phone, order_id)` | Driver arrives at pickup stop |
| `notify_receiver_driver_coming(phone, order_id)` | Driver arrives at delivery stop |
| `notify_receiver_whatsapp(phone, order_id, otp, tracking_url)` | Pickup confirmed — receiver gets OTP + tracking link |
| `notify_sender_delivered(phone, order_id)` | Delivery confirmed |
| `notify_sender_order_failed(phone, order_id)` | Pickup failed |
| `notify_admin_escalation(order_id, reason)` | 2nd delivery failure |
| `notify_sender_return(phone, order_id)` | Return to sender initiated |

---

## 6. Utilities

### 6.1 Geo — Haversine

**`app/utils/geo.py`**

```python
haversine_km(lat1, lng1, lat2, lng2) → float
```
Returns straight-line distance in kilometres using the Haversine formula (Earth radius = 6371 km).

```python
nearest(origin, candidates, lat_key, lng_key) → dict
```
Returns the candidate dict closest to `origin`.

### 6.2 OSRM — Road Segments

**`app/utils/osrm.py`**

Uses the public OSRM demo server (`router.project-osrm.org`) for road routing geometry. **Replace with self-hosted OSRM or Mapbox Directions API in production.**

| Function | Description |
|---|---|
| `fetch_geometry(lat1, lng1, lat2, lng2)` | Calls OSRM, returns GeoJSON geometry for road path between two points |
| `save_segments(vehicle_id, points, start_sequence)` | Iterates point pairs, fetches road geometry, inserts `route_segments` rows |
| `mark_segment_done(vehicle_id, to_sequence)` | Sets `is_done=True` for segment ending at `to_sequence` |
| `clear_segments(vehicle_id)` | Deletes all segment rows for a vehicle (called on route complete) |
| `get_segments(vehicle_id)` | Returns all segments for a vehicle (for map display) |

### 6.3 OTP Generator

**`app/utils/otp.py`**

```python
generate_otp() → str
```
Returns a random 6-character alphanumeric string (used for both pickup and delivery OTPs).

---

## 7. Admin Web (Next.js)

Runs on `localhost:3000`. Requires `admin` or `manager` role.

### Pages

| Route | Description |
|---|---|
| `/login` | Phone + password login |
| `/overview` | **Stats dashboard** — vehicle counts, order counts by status, day controls (Start Day / Stop Accepting / Resume) |
| `/fleet` | Live map showing all vehicles and their OSRM routes. Click a vehicle to see its stops. |
| `/orders` | Full order list with status filter. Click to view detail, inject, fail, return. |
| `/queue` | Queued orders with reason. Retry injection or cancel. |
| `/escalations` | Orders escalated after 2 failed deliveries. Initiate return or reschedule. |
| `/users` | User list (admin only). Add managers, deactivate users. |
| `/stats` | Charts — delivery rate over time, vehicle utilisation, etc. |

### Day Controls (Overview page)

- **Start Day** → calls `POST /admin/day/start` → enables accepting orders and dispatches all pending orders.
- **Stop Accepting Orders** → `POST /admin/day/stop` → new orders go to queue.
- **Resume Accepting Orders** → `POST /admin/day/resume` → shown only when stopped.

Stats auto-refresh every 30 seconds.

### Auth

`lib/auth.ts` stores the JWT in `localStorage`. `lib/api.ts` is an Axios instance that injects `Authorization: Bearer <token>` on every request. The dashboard layout redirects to `/login` if no token is found.

---

## 8. Sender Web (Next.js)

Runs on `localhost:3001`. Requires `sender` role.

### Pages

| Route | Description |
|---|---|
| `/login` | Phone + password login |
| `/map` | Live map — see all active vehicles and their routes |
| `/create` | **Create Order** — map picker for pickup and delivery, receiver details, item details |
| `/orders` | List of sender's own orders with status badges |
| `/orders/[id]` | Order detail — shows pickup OTP (before pickup), delivery OTP (after pickup), status timeline |
| `/orders/[id]/sticker` | **Printable delivery sticker** — pickup/delivery address, item count, QR/barcode |
| `/track` | Public tracking page (accessible without login via order ID) |

### Create Order — Map Picker

`/create/page.tsx` contains a full-screen `MapModal` component with:
- Leaflet map (OpenStreetMap tiles)
- Nominatim geocoding search (debounced, city-constrained via env vars)
- GPS "Use My Location" button
- Drag-to-adjust pin
- Reverse geocoding to show address
- Color-coded pins: green = pickup, red = delivery

### City Configuration (`.env`)

```
NEXT_PUBLIC_CITY_LAT=20.2961
NEXT_PUBLIC_CITY_LNG=85.8245
NEXT_PUBLIC_CITY_VIEWBOX=85.7,20.1,86.0,20.5
NEXT_PUBLIC_CITY_NAME=Bhubaneswar
NEXT_PUBLIC_CITY_COUNTRY=in
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

This constrains map search and default center to the operational city.

---

## 9. Configuration & Environment

### Backend `.env`

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=your-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_ENV=development
```

### Frontend `.env` (both admin-web and sender-web)

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_CITY_LAT=...
NEXT_PUBLIC_CITY_LNG=...
NEXT_PUBLIC_CITY_VIEWBOX=...
NEXT_PUBLIC_CITY_NAME=...
NEXT_PUBLIC_CITY_COUNTRY=...
```

---

## 10. Order Lifecycle State Machine

```
[Created]
    │
    ├─ system accepting orders ──► pending
    └─ system NOT accepting   ──► queued ◄─── no vehicle found (dispatch/inject)
                                      │
                                      └─ vehicle becomes idle ──► pending (auto-reassigned)

pending
    │
    ├─ driver arrives + pickup OTP confirmed ──► picked_up
    └─ driver marks fail-pickup              ──► failed_pickup

picked_up
    │
    ├─ driver arrives + delivery OTP confirmed ──► delivered ✓
    └─ driver marks fail-delivery:
          attempt_count < 2  ──► failed_delivery  (item stays in vehicle)
          attempt_count >= 2 ──► escalated

escalated
    │
    ├─ admin initiates return ──► return_to_sender
    └─ admin reschedules      ──► pending (re-injected)

return_to_sender
    │
    └─ pickup confirmed back to sender ──► returned ✓
```

---

## 11. Roles & Access Control

| Role | Capabilities |
|---|---|
| **admin** | Everything — user management, session revocation, day controls, all orders/vehicles |
| **manager** | Same as admin except cannot manage users or revoke sessions |
| **sender** | Create orders, view own orders, print stickers, track |
| **driver** | View own route, mark arrived, confirm pickups/deliveries, update vehicle location |

Enforced via FastAPI `Depends` guards in `app/core/dependencies.py`:
- `get_current_user` — validates JWT + active session
- `require_admin_manager` — checks role in `["admin", "manager"]`
- `require_sender` — checks role == `"sender"`
- `require_driver` — checks role == `"driver"`

---

## 12. API Reference

Full interactive docs available at `http://localhost:8000/docs` (Swagger UI).

### Quick Reference

```
Auth
  POST   /api/v1/auth/register
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout
  GET    /api/v1/auth/me
  GET    /api/v1/auth/sessions          (admin)
  DELETE /api/v1/auth/sessions/{id}     (admin)

Orders
  POST   /api/v1/orders/               Create order
  GET    /api/v1/orders/my             Sender's orders
  GET    /api/v1/orders/{id}           Single order
  POST   /api/v1/orders/dispatch       Batch dispatch (admin/manager)
  POST   /api/v1/orders/{id}/inject    Live inject (admin/manager)
  PATCH  /api/v1/orders/{id}/fail-pickup
  PATCH  /api/v1/orders/{id}/fail-delivery
  PATCH  /api/v1/orders/{id}/return-to-sender

Vehicles
  POST   /api/v1/vehicles/
  GET    /api/v1/vehicles/
  PATCH  /api/v1/vehicles/{id}/location

Driver
  GET    /api/v1/driver/my-route
  GET    /api/v1/driver/my-inventory
  POST   /api/v1/driver/arrived/{stop_id}
  POST   /api/v1/driver/confirm-pickup/{order_id}    body: { otp }
  POST   /api/v1/driver/confirm-delivery/{order_id}  body: { otp }
  POST   /api/v1/driver/route-complete

Admin
  GET    /api/v1/admin/fleet
  GET    /api/v1/admin/orders
  GET    /api/v1/admin/orders/escalated
  GET    /api/v1/admin/users
  GET    /api/v1/admin/day/status
  POST   /api/v1/admin/day/start
  POST   /api/v1/admin/day/stop
  POST   /api/v1/admin/day/resume

Queue
  GET    /api/v1/queue/
  POST   /api/v1/queue/{id}/retry
  DELETE /api/v1/queue/{id}
```

---

## 13. Local Development & Seeding

### Starting All Services

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000

# Terminal 2 — Admin Web
cd admin-web
npm install && npm run dev
# → http://localhost:3000

# Terminal 3 — Sender Web
cd sender-web
npm install && npm run dev
# → http://localhost:3001
```

### Seeding Test Data

```bash
cd backend && python seed.py
```

Creates:

| Type | Count | Credentials |
|---|---|---|
| Admin | 1 | Phone: 9999999999 / Password: test1234 |
| Drivers | 5 | Phones: 8000000001–8000000005 / test1234 |
| Vehicles | 5 | Random Bhubaneswar locations, capacity 4–8 |
| Sender | 1 | Phone: 7000000001 / test1234 |
| Orders | 10 | Random Bhubaneswar pickup/delivery pairs, auto-dispatched |

### Resetting State (Clean Slate)

Delete rows in this order in Supabase Table Editor:
1. `route_segments`
2. `stops`
3. `vehicle_inventory`
4. `queue`
5. `orders`
6. `vehicles`
7. `sessions`
8. `users` (keep the admin row: 9999999999)

Then run `seed.py` again.

### Sharing for External Demo (Cloudflare Tunnel)

```bash
cloudflared tunnel --url http://localhost:8000   # backend
cloudflared tunnel --url http://localhost:3000   # admin-web
cloudflared tunnel --url http://localhost:3001   # sender-web
```

Update `NEXT_PUBLIC_API_URL` in both `.env` files to the backend tunnel URL, then restart the Next.js dev servers.

---

## 14. Known Limitations (MVP)

| Area | Limitation |
|---|---|
| **Notifications** | WhatsApp/SMS stubs only — print to console. Plug in Twilio or WhatsApp Business API. |
| **Payment** | Not implemented. |
| **Address search** | Uses free Nominatim API — rate-limited and less accurate. Plan to upgrade to Mapbox. |
| **OSRM** | Uses public demo server (`router.project-osrm.org`) — unreliable for production. Self-host OSRM or use Mapbox Directions API. |
| **Driver GPS** | Manual location update via API/Swagger. Requires mobile app integration for automatic live tracking. |
| **Routing algorithm** | Greedy nearest-neighbor — not globally optimal. Consider OR-Tools / VRP solver for larger fleets. |
| **Timing windows** | No delivery time windows — all orders dispatched together. |
| **CORS** | `allow_origins=["*"]` — restrict to actual frontend origins before production. |
| **Mobile app** | Expo driver app is in progress — not included in this release. |
| **Multi-city** | Configured per-city via env vars — not multi-tenant. |
