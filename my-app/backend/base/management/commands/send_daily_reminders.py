from django.core.management.base import BaseCommand
from base.models import Orders, DailyReport # Import your new model
from base.services.sms_service import send_owner_sms_report

class Command(BaseCommand):
    def handle(self, *args, **options):
        overdue_orders = Orders.objects.filter(payment_status__in=['due', 'partial'])
        
        if not overdue_orders.exists():
            send_owner_sms_report("✅ Shree Ganesh Traders: No defaulters today.")
            return

        # 1. Build the Report Content
        report_content = "⚠️ SHREE GANESH TRADERS - DEFAULTER REPORT ⚠️\n\n"
        total_pending = 0
        for order in overdue_orders:
            due = order.Total_Amount - order.amount_paid
            total_pending += due
            report_content += f"Customer: {order.Customer.customer_name}\nDue: Rs.{due:,.0f}\n---\n"
        
        report_content += f"\nTOTAL: Rs.{total_pending:,.0f}"

        # 2. Save to YOUR OWN Database
        report_obj = DailyReport.objects.create(content=report_content)
        
        # 3. Create the Link (Replace with your actual domain if live)
        # For local testing, use your local IP/NGROK. For production, use your domain.
        base_url = "http://your-server-ip:8000" 
        report_url = f"{base_url}/report/{report_obj.id}/"

        # 4. Send the SMS
        sms_body = (
            f"⚠️ Defaulter Alert\n"
            f"Orders: {overdue_orders.count()}\n"
            f"Total: Rs.{total_pending:,.0f}\n\n"
            f"Link: {report_url}"
        )
        
        send_owner_sms_report(sms_body)
        self.stdout.write(f"SMS Sent! Local Report ID: {report_obj.id}")