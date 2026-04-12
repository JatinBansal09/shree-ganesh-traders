import re
from twilio.rest import Client
from django.conf import settings

PHONE_CLEANER_REGEX = re.compile(r'[^0-9+]')

def normalize_phone_number(phone_number, default_country_code='91'):
    if not phone_number:
        raise ValueError("Phone number is required")

    normalized = PHONE_CLEANER_REGEX.sub('', str(phone_number).strip())

    if normalized.startswith('00'):
        normalized = '+' + normalized[2:]

    if normalized.startswith('0') and len(normalized) == 11:
        normalized = normalized[1:]

    if normalized.startswith('+'):
        return normalized

    if len(normalized) == 10:
        return f'+{default_country_code}{normalized}'

    if len(normalized) == 11 and normalized.startswith(default_country_code):
        return f'+{normalized[1:]}'

    if len(normalized) == 12 and normalized.startswith(default_country_code):
        return f'+{normalized}'

    if normalized.startswith(default_country_code):
        return f'+{normalized}'

    raise ValueError(f"Invalid phone number format: {phone_number}")


def send_overdue_sms(phone_number, customer_name=None, order_id=None, due_amount=0, months=0):
    """
    Sends a standard SMS reminder to a customer using Twilio.
    """
    if not settings.TWILIO_NUMBER:
        raise ValueError("TWILIO_NUMBER is not configured in Django settings")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    from_number = normalize_phone_number(settings.TWILIO_NUMBER)
    target_number = normalize_phone_number(phone_number)

    body = (
        f"Dear {customer_name}, payment of Rs.{due_amount:,.0f} for Order #{order_id} "
        f"is pending for {months} month(s). Please settle with Shree Ganesh Traders. Thank you."
    )

    message = client.messages.create(
        body=body,
        from_=from_number,
        to=target_number
    )

    return message.sid


def send_owner_sms_report(message):
    """
    Sends the Defaulter Report/Link directly to the Owner's phone via SMS.
    """
    if not settings.OWNER_PHONE:
        raise ValueError("OWNER_PHONE is not configured in Django settings")
    if not settings.TWILIO_NUMBER:
        raise ValueError("TWILIO_NUMBER is not configured in Django settings")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    owner_number = normalize_phone_number(settings.OWNER_PHONE)
    from_number = normalize_phone_number(settings.TWILIO_NUMBER)

    print(f"Sending owner SMS from {from_number} to {owner_number}")

    message = client.messages.create(
        body=message,
        from_=from_number,
        to=owner_number
    )

    return message.sid


def send_sms(phone_number, body):
    """
    Sends a generic SMS using Twilio.
    """
    if not settings.TWILIO_NUMBER:
        raise ValueError("TWILIO_NUMBER is not configured in Django settings")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    from_number = normalize_phone_number(settings.TWILIO_NUMBER)
    target_number = normalize_phone_number(phone_number)

    message = client.messages.create(
        body=body,
        from_=from_number,
        to=target_number
    )

    return message.sid