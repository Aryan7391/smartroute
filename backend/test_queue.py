from app.db.client import supabase

res = supabase.table("orders").select("*, queue(reason, created_at)").limit(1).execute()
print(res.data)
