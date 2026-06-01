import requests
res = requests.post("https://smartroute-production.up.railway.app/api/v1/auth/login", json={"phone": "9999999999", "password": "test1234"})
print(res.status_code)
print(res.text)
