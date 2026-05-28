import requests
import random

BASE = "http://localhost:8000/api/v1"

# Bhubaneswar coordinates area
def rand_loc():
    return {
        "lat": round(random.uniform(20.25, 20.35), 6),
        "lng": round(random.uniform(85.79, 85.87), 6)
    }

areas = [
    "Patia, Bhubaneswar",
    "Nayapalli, Bhubaneswar", 
    "Saheed Nagar, Bhubaneswar",
    "Chandrasekharpur, Bhubaneswar",
    "Jaydev Vihar, Bhubaneswar",
    "Khandagiri, Bhubaneswar",
    "Baramunda, Bhubaneswar",
    "Rasulgarh, Bhubaneswar",
    "Damana, Bhubaneswar",
    "Aiginia, Bhubaneswar",
    "Unit 4, Bhubaneswar",
    "Unit 9, Bhubaneswar",
]

# 1. Login as admin
print("Logging in as admin...")
res = requests.post(f"{BASE}/auth/login", json={"phone": "9999999999", "password": "test1234"})
admin_token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {admin_token}"}
print("✓ Admin logged in")

# 2. Create 5 drivers
driver_ids = []
print("\nCreating 5 drivers...")
for i in range(1, 6):
    phone = f"800000000{i}"
    # Register
    r = requests.post(f"{BASE}/auth/register", json={
        "name": f"Driver {i}",
        "phone": phone,
        "password": "test1234",
        "role": "driver"
    })
    if r.status_code == 200:
        driver_id = r.json()["id"]
        driver_ids.append(driver_id)
        print(f"  ✓ Driver {i} created — {driver_id[:8]}...")
    else:
        # Already exists, get from login
        lr = requests.post(f"{BASE}/auth/login", json={"phone": phone, "password": "test1234"})
        if lr.status_code == 200:
            driver_id = lr.json()["user_id"]
            driver_ids.append(driver_id)
            print(f"  ✓ Driver {i} already exists — {driver_id[:8]}...")

# 3. Create 5 vehicles
vehicle_ids = []
print("\nCreating 5 vehicles...")
for i, driver_id in enumerate(driver_ids):
    r = requests.post(f"{BASE}/vehicles/", json={
        "driver_id": driver_id,
        "capacity": random.randint(4, 8)
    }, headers=headers)
    if r.status_code == 200:
        vehicle_id = r.json()["id"]
        vehicle_ids.append(vehicle_id)
        print(f"  ✓ Vehicle {i+1} created — {vehicle_id[:8]}...")

# 4. Set vehicle locations in Bhubaneswar
print("\nSetting vehicle locations...")
for i, vid in enumerate(vehicle_ids):
    loc = rand_loc()
    r = requests.patch(f"{BASE}/vehicles/{vid}/location", json={
        "lat": loc["lat"],
        "lng": loc["lng"]
    }, headers=headers)
    print(f"  ✓ Vehicle {i+1} location set — {loc['lat']}, {loc['lng']}")

# 5. Create sender if not exists
print("\nCreating test sender...")
r = requests.post(f"{BASE}/auth/register", json={
    "name": "Test Sender",
    "phone": "7000000001",
    "password": "test1234",
    "role": "sender"
})
if r.status_code == 200:
    print("  ✓ Sender created")
else:
    print("  ✓ Sender already exists")

# Login as sender
sr = requests.post(f"{BASE}/auth/login", json={"phone": "7000000001", "password": "test1234"})
sender_token = sr.json()["access_token"]
sender_headers = {"Authorization": f"Bearer {sender_token}"}

# 6. Create 10 orders
print("\nCreating 10 orders...")
order_ids = []
for i in range(10):
    pickup = rand_loc()
    delivery = rand_loc()
    pickup_area = random.choice(areas)
    delivery_area = random.choice(areas)
    
    r = requests.post(f"{BASE}/orders/", json={
        "pickup_address":   pickup_area,
        "pickup_lat":       pickup["lat"],
        "pickup_lng":       pickup["lng"],
        "delivery_address": delivery_area,
        "delivery_lat":     delivery["lat"],
        "delivery_lng":     delivery["lng"],
        "receiver_name":    f"Receiver {i+1}",
        "receiver_phone":   f"900000000{i}",
        "item_count":       random.randint(1, 5),
        "approx_weight":    round(random.uniform(0.5, 5.0), 1),
        "item_description": random.choice(["Documents", "Clothes", "Electronics", "Books", "Food items"])
    }, headers=sender_headers)
    
    if r.status_code == 200:
        order_ids.append(r.json()["id"])
        print(f"  ✓ Order {i+1} created — {pickup_area} → {delivery_area}")

# 7. Dispatch all orders
print("\nDispatching all orders...")
r = requests.post(f"{BASE}/orders/dispatch", headers=headers)
print(f"  ✓ {r.json()}")

print("\n✅ Seed complete!")
print(f"   Drivers: {len(driver_ids)}")
print(f"   Vehicles: {len(vehicle_ids)}")
print(f"   Orders: {len(order_ids)}")
print(f"\nSender login: 7000000001 / test1234")
print(f"Admin login:  9999999999 / test1234")