import os
import sys
from supabase import create_client

SUPABASE_URL = "https://adklxedeotiijubyuvnr.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFka2x4ZWRlb3RpaWp1Ynl1dm5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc5MzY2OSwiZXhwIjoyMDk1MzY5NjY5fQ.FKJbyohmvr5P9vVXiLfkQDMZq9BLR_7ChcfsWhBo2eA"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

try:
    res = supabase.table("users").select("*").execute()
    users = res.data
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"User: {u['phone']} - Role: {u['role']} - Hash length: {len(u['password_hash'])} - Hash: {u['password_hash'][:10]}...")
except Exception as e:
    print(f"Error connecting to DB: {e}")
