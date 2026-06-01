import os
import sys
from supabase import create_client
from passlib.context import CryptContext

SUPABASE_URL = "https://adklxedeotiijubyuvnr.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFka2x4ZWRlb3RpaWp1Ynl1dm5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc5MzY2OSwiZXhwIjoyMDk1MzY5NjY5fQ.FKJbyohmvr5P9vVXiLfkQDMZq9BLR_7ChcfsWhBo2eA"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
res = supabase.table("users").select("password_hash").eq("phone", "9999999999").execute()
if res.data:
    admin_hash = res.data[0]['password_hash']
    print(f"Hash: {admin_hash}")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    try:
        match = pwd_context.verify("test1234", admin_hash)
        print(f"Match: {match}")
    except Exception as e:
        print(f"Error: {e}")
