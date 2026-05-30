import requests
import random

BASE = "http://localhost:8000/api/v1"

def rand_loc():
    return {
        "lat": round(random.uniform(20.25, 20.35), 6),
        "lng": round(random.uniform(85.79, 85.87), 6)
    }

areas = [
    "Patia, Bhubaneswar", "Nayapalli, Bhubaneswar",
    "Saheed Nagar, Bhubaneswar", "Chandrasekharpur, Bhubaneswar",
    "Jaydev Vihar, Bhubaneswar", "Khandagiri, Bhubaneswar",
    "Baramunda, Bhubaneswar", "Rasulgarh, Bhubaneswar",
    "Damana, Bhubaneswar", "Aiginia, Bhubaneswar",
    "Unit 4, Bhubaneswar", "Unit 9, Bhubaneswar",
]

# 1. Login as admin
print("Logging in as admin...")
res = requests.post(f"{BASE}/auth/login", json={"phone": "9999999999", "password": "test1234"})
admin_token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {admin_token}"}
print("✓ Admin logged in")

# 2. Create/get 5 drivers
driver_ids = []
print("\nCreating 5 drivers...")
for i in range(1, 6):
    phone = f"800000000{i}"
    r = requests.post(f"{BASE}/auth/register", json={
        "name": f"Driver {i}", "phone": phone,
        "password": "test1234", "role": "driver"
    })
    if r.status_code == 200:
        driver_id = r.json()["id"]
        requests.patch(f"{BASE}/admin/users/{driver_id}",
            json={"is_active": True}, headers=headers)
        driver_ids.append(driver_id)
        print(f"  ✓ Driver {i} created — {driver_id[:8]}...")
    else:
        lr = requests.post(f"{BASE}/auth/login", json={"phone": phone, "password": "test1234"})
        if lr.status_code == 200:
            driver_id = lr.json()["user_id"]
            driver_ids.append(driver_id)
            print(f"  ✓ Driver {i} exists — {driver_id[:8]}...")

# 3. Create vehicles with locations and max_weight
vehicle_ids = []
print("\nCreating vehicles with locations...")
locs = [
    {"lat": 20.2961, "lng": 85.8245},
    {"lat": 20.3100, "lng": 85.8100},
    {"lat": 20.2800, "lng": 85.8400},
    {"lat": 20.3200, "lng": 85.8300},
    {"lat": 20.2700, "lng": 85.8100},
]
for i, driver_id in enumerate(driver_ids):
    r = requests.post(f"{BASE}/vehicles/", json={
        "driver_id": driver_id,
        "capacity": random.randint(4, 8),
        "max_weight": round(random.uniform(30.0, 80.0), 1)
    }, headers=headers)
    if r.status_code == 200:
        vehicle_id = r.json()["id"]
        vehicle_ids.append(vehicle_id)
        loc = locs[i % len(locs)]
        lr = requests.patch(f"{BASE}/vehicles/{vehicle_id}/location",
            json={"lat": loc["lat"], "lng": loc["lng"]}, headers=headers)
        print(f"  ✓ Vehicle {i+1} — location set {loc['lat']}, {loc['lng']} — status: {lr.status_code}")
    else:
        print(f"  ✗ Vehicle {i+1} failed: {r.status_code} — {r.text[:200]}")

# 4. Create sender
print("\nCreating test sender...")
r = requests.post(f"{BASE}/auth/register", json={
    "name": "Test Sender", "phone": "7000000001",
    "password": "test1234", "role": "sender"
})
print(f"  ✓ {'Created' if r.status_code == 200 else 'Already exists'}")

sr = requests.post(f"{BASE}/auth/login", json={"phone": "7000000001", "password": "test1234"})
sender_token = sr.json()["access_token"]
sender_headers = {"Authorization": f"Bearer {sender_token}"}

# 5. Create 10 orders
print("\nCreating 10 orders...")
for i in range(10):
    pickup = rand_loc()
    delivery = rand_loc()
    r = requests.post(f"{BASE}/orders/", json={
        "pickup_address":   random.choice(areas),
        "pickup_lat":       pickup["lat"],
        "pickup_lng":       pickup["lng"],
        "delivery_address": random.choice(areas),
        "delivery_lat":     delivery["lat"],
        "delivery_lng":     delivery["lng"],
        "receiver_name":    f"Receiver {i+1}",
        "receiver_phone":   f"900000000{i}",
        "item_count":       random.randint(1, 5),
        "approx_weight":    round(random.uniform(0.5, 5.0), 1),
        "item_description": random.choice(["Documents", "Clothes", "Electronics", "Books"])
    }, headers=sender_headers)
    if r.status_code == 200:
        print(f"  ✓ Order {i+1} created")
    else:
        print(f"  ✗ Order {i+1} failed: {r.status_code} — {r.text[:200]}")

# 6. Dispatch
print("\nDispatching all orders...")
r = requests.post(f"{BASE}/orders/dispatch", headers=headers)
if r.status_code == 200:
    print(f"  ✓ {r.json()}")
else:
    print(f"  ✗ Dispatch failed: {r.status_code} — {r.text[:200]}")

print("\n✅ Seed complete!")
print(f"   Vehicles: {len(vehicle_ids)}")
print(f"\nSender: 7000000001 / test1234")
print(f"Admin:  9999999999 / test1234")