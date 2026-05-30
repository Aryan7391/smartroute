# SmartRoute API

Smart routing and delivery management system built with FastAPI + Supabase.

## Setup

1. Create and activate virtual environment
   ```
   python -m venv venv
   venv\Scripts\activate        # Windows
   source venv/bin/activate     # Mac/Linux
   ```

2. Install dependencies
   ```
   pip install -r requirements.txt
   ```

3. Copy env file and fill in your values
   ```
   cp .env.example .env
   ```

4. Run the schema in Supabase SQL Editor (db/schema.sql)

5. Start the server
   ```
   uvicorn app.main:app --reload
   ```

6. Open http://localhost:8000/docs

## Project Structure

```
app/
├── main.py                  FastAPI app entry point
├── core/
│   ├── config.py            Environment variables
│   ├── security.py          Password hashing, JWT
│   └── dependencies.py      Auth guards, role checkers
├── db/
│   └── client.py            Supabase client
├── api/v1/endpoints/
│   ├── auth.py              Register, login, logout, session management
│   ├── orders.py            Create, dispatch, inject, fail, return
│   ├── vehicles.py          Register vehicles, location updates, inventory
│   ├── driver.py            Route, OTP confirm, arrival, route complete
│   ├── admin.py             Fleet view, user management, escalations
│   └── queue.py             View, retry, cancel queued orders
├── services/
│   ├── auth.py              Auth business logic
│   ├── routing.py           Interleave stops, assign orders to vehicles
│   ├── injection.py         Live order injection logic
│   ├── otp.py               OTP verification for pickup and delivery
│   ├── queue.py             Queue processing when vehicle goes idle
│   └── notification.py      Notification stubs (plug in WhatsApp API)
└── utils/
    ├── geo.py               Haversine distance calculation
    └── otp.py               OTP generator

db/
└── schema.sql               Full Supabase schema — run this first
```

## API Endpoints

| Method | Route | Access |
|--------|-------|--------|
| POST | /api/v1/auth/register | Public |
| POST | /api/v1/auth/login | Public |
| POST | /api/v1/auth/logout | Any |
| GET | /api/v1/auth/me | Any |
| GET | /api/v1/auth/sessions | Admin |
| DELETE | /api/v1/auth/sessions/{id} | Admin |
| POST | /api/v1/orders/ | Sender/Admin/Manager |
| GET | /api/v1/orders/my | Sender |
| POST | /api/v1/orders/dispatch | Admin/Manager |
| POST | /api/v1/orders/{id}/inject | Admin/Manager |
| PATCH | /api/v1/orders/{id}/fail-pickup | Driver/Admin/Manager |
| PATCH | /api/v1/orders/{id}/fail-delivery | Driver/Admin/Manager |
| PATCH | /api/v1/orders/{id}/return-to-sender | Admin/Manager |
| POST | /api/v1/vehicles/ | Admin/Manager |
| GET | /api/v1/vehicles/ | Admin/Manager |
| PATCH | /api/v1/vehicles/{id}/location | Driver |
| GET | /api/v1/driver/my-route | Driver |
| POST | /api/v1/driver/confirm-pickup/{id} | Driver |
| POST | /api/v1/driver/confirm-delivery/{id} | Driver |
| POST | /api/v1/driver/route-complete | Driver |
| GET | /api/v1/admin/fleet | Admin/Manager |
| GET | /api/v1/admin/orders/escalated | Admin/Manager |
| GET | /api/v1/admin/users | Admin |
| GET | /api/v1/queue/ | Admin/Manager |
| POST | /api/v1/queue/{id}/retry | Admin/Manager |
