# SmartRoute — Test & Demo Guide

## Prerequisites

Make sure all three services are running before testing:

### 1. Start Backend
```powershell
cd D:\LogisticSid-main\smartroute\backend
venv\Scripts\activate
uvicorn app.main:app --reload
```
Backend runs at: `http://localhost:8000`
Swagger UI: `http://localhost:8000/docs`

### 2. Start Admin Web
```powershell
cd D:\LogisticSid-main\smartroute\admin-web
npm run dev
```
Admin dashboard runs at: `http://localhost:3000`

### 3. Start Sender Web
```powershell
cd D:\LogisticSid-main\smartroute\sender-web
npm run dev
```
Sender portal runs at: `http://localhost:3001`

---

## Seeding Test Data

The seed script creates 5 drivers, 5 vehicles, 1 sender, and 10 orders — all dispatched and ready.

### Run seed
```powershell
cd D:\LogisticSid-main\smartroute\backend
venv\Scripts\activate
python seed.py
```

### What gets created
| Type | Count | Details |
|------|-------|---------|
| Drivers | 5 | Phones: 8000000001 to 8000000005, Password: test1234 |
| Vehicles | 5 | Random Bhubaneswar locations, capacity 4-8 |
| Sender | 1 | Phone: 7000000001, Password: test1234 |
| Orders | 10 | Random Bhubaneswar pickup/delivery pairs, auto-dispatched |

---

## Test Accounts

| Role | Phone | Password | Portal |
|------|-------|----------|--------|
| Admin | 9999999999 | test1234 | localhost:3000 |
| Manager | (add via admin panel) | test1234 | localhost:3000 |
| Sender (test) | 7000000001 | test1234 | localhost:3001 |
| Driver 1 | 8000000001 | test1234 | Mobile app |
| Driver 2 | 8000000002 | test1234 | Mobile app |
| Driver 3 | 8000000003 | test1234 | Mobile app |
| Driver 4 | 8000000004 | test1234 | Mobile app |
| Driver 5 | 8000000005 | test1234 | Mobile app |

---

## Demo Flow — Full End to End

### Step 1 — Admin dispatches fleet
1. Open `http://localhost:3000` → login as admin
2. Go to **Overview** → verify vehicles and orders showing
3. Go to **Fleet** → see all 5 vehicles on map
4. Click any vehicle → see its assigned route with OSRM road path

### Step 2 — Sender places and tracks order
1. Open `http://localhost:3001` → login as sender (7000000001)
2. **Live Map** loads — see all active vehicles and their routes
3. Click a vehicle to see its stops and route
4. Click **Send Item** → fill pickup/delivery on map → create order
5. After order created → click **Print Sticker** → print and attach to item
6. Go to **My Orders** → see order with OTP displayed

### Step 3 — Driver picks up (via Swagger for now, mobile app later)
1. Open `http://localhost:8000/docs`
2. Login as Driver 1 (8000000001 / test1234) → Authorize
3. GET `/api/v1/driver/my-route` → see assigned stops
4. POST `/api/v1/driver/arrived/{stop_id}` → mark arrived at pickup
5. POST `/api/v1/driver/confirm-pickup/{order_id}` → body: `{"otp": "XXXXXX"}`
   - OTP is visible on sender's order detail page
6. Order status changes to `picked_up`
7. Receiver gets WhatsApp notification (stub — prints to console for now)

### Step 4 — Driver delivers
1. POST `/api/v1/driver/arrived/{stop_id}` → mark arrived at delivery
2. POST `/api/v1/driver/confirm-delivery/{order_id}` → body: `{"otp": "XXXXXX"}`
   - Delivery OTP visible in Supabase orders table or admin panel
3. Order status changes to `delivered`
4. Sender gets confirmation notification (stub)

### Step 5 — Admin monitors
1. **Overview** → delivered count increases
2. **Orders** → filter by status, click order for full detail
3. **Fleet** → vehicle load updates as items are picked up/delivered
4. **Stats** → charts update with new data

---

## Testing Live Injection

1. While vehicles are active, go to Swagger UI
2. Create a new order as sender
3. POST `/api/v1/orders/{order_id}/inject` as admin
4. Check log — order either injected into nearest vehicle or queued
5. **Queue** tab in admin shows queued orders
6. Retry injection from queue if needed

---

## Testing Failure Flow

### Pickup failure
1. After driver arrives at pickup stop
2. PATCH `/api/v1/orders/{order_id}/fail-pickup`
3. Order status → `failed_pickup`, sender notified

### Delivery failure (1st attempt)
1. PATCH `/api/v1/orders/{order_id}/fail-delivery`
2. `attempt_count` increments to 1
3. Item stays in vehicle for next round

### Delivery failure (2nd attempt)
1. PATCH `/api/v1/orders/{order_id}/fail-delivery` again
2. Order status → `escalated`
3. Admin notified, appears in **Escalations** tab
4. Admin can: Reschedule / Return to Sender / Charge Extra

---

## Re-running Tests

Running `seed.py` multiple times will add duplicate vehicles. To get a clean state:

1. Go to Supabase → Table Editor
2. Delete rows from these tables in order:
   - `stops`
   - `vehicle_inventory`
   - `queue`
   - `orders`
   - `vehicles`
   - `sessions`
   - `users` (keep admin: 9999999999)
3. Run `seed.py` again

---

## Sharing for Demo (Tunnel)

To share with others on the same network or externally:

```powershell
# Terminal 1 — tunnel backend
cloudflared tunnel --url http://localhost:8000

# Terminal 2 — tunnel sender web  
cloudflared tunnel --url http://localhost:3001

# Terminal 3 — tunnel admin web
cloudflared tunnel --url http://localhost:3000
```

After getting tunnel URLs, update `.env` in both sender-web and admin-web:
```
NEXT_PUBLIC_API_URL=https://your-backend-tunnel-url/api/v1
```

Restart both Next.js dev servers after updating `.env`.

---

## Known Limitations (MVP)

- WhatsApp notifications are stubs — they print to console only
- Payment module not implemented yet
- Address search uses Nominatim (will upgrade to Mapbox later)
- Driver GPS updates require mobile app (manual via Swagger for now)
- No timing windows — all orders dispatched together

---

## Project Structure

```
smartroute/
├── backend/          FastAPI + Supabase
├── admin-web/        Next.js — Admin & Manager dashboard  
├── sender-web/       Next.js — Sender portal
└── mobile/           Expo — Driver & Sender mobile app (in progress)
```