# Notification service
# For now this is a stub — plug in WhatsApp API (e.g. Twilio, Meta Cloud API) later

def notify_sender_driver_coming(phone: str, order_id: str):
    """Send SMS/WhatsApp to sender: driver is 10 min away."""
    print(f"[NOTIFY] Sender {phone} — driver coming for order {order_id}")

def notify_receiver_whatsapp(phone: str, order_id: str, delivery_otp: str, tracking_url: str):
    """Send WhatsApp to receiver with tracking link and delivery OTP."""
    print(f"[NOTIFY] Receiver {phone} — track at {tracking_url}, OTP: {delivery_otp}")

def notify_receiver_driver_coming(phone: str, order_id: str):
    """Send WhatsApp to receiver: driver is 10 min away."""
    print(f"[NOTIFY] Receiver {phone} — driver coming for order {order_id}")

def notify_sender_order_failed(phone: str, order_id: str):
    """Sender was not present — order failed."""
    print(f"[NOTIFY] Sender {phone} — pickup failed for order {order_id}")

def notify_sender_delivered(phone: str, order_id: str):
    """Order successfully delivered."""
    print(f"[NOTIFY] Sender {phone} — order {order_id} delivered")

def notify_admin_escalation(order_id: str, reason: str):
    """Alert admin team about a failed delivery needing escalation."""
    print(f"[ESCALATE] Order {order_id} — {reason}")

def notify_sender_return(phone: str, order_id: str):
    """Item being returned to sender."""
    print(f"[NOTIFY] Sender {phone} — item for order {order_id} is being returned")
