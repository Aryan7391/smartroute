from app.db.client import supabase


def is_accepting_orders() -> bool:
    """
    Check the system_config table to see if new orders are currently accepted.
    Defaults to True if the config key is missing.
    """
    res = supabase.table("system_config").select("value").eq("key", "accepting_orders").single().execute()
    if not res.data:
        return True
    return res.data["value"] == "true"
