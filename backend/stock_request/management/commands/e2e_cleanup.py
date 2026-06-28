from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from stock_request.models import StockRequest, StockRequestChemicalItem, IssueRegister


class Command(BaseCommand):
    help = "Clean up all E2E test stock requests"

    def handle(self, *args, **options):
        User = get_user_model()
        for eid in ['STAFF001', 'HOD001', 'Test_Store_Keeper']:
            try:
                u = User.objects.get(employee_id=eid)
            except Exception as e:
                self.stdout.write(f"User {eid} not found: {e}")
                continue

            # Delete IssueRegister entries (may fail, continue anyway)
            for sr in StockRequest.objects.filter(requested_by=u):
                try:
                    IssueRegister.objects.filter(stock_request_db_id=sr.id).delete()
                except Exception:
                    pass

            # Delete chemical items
            try:
                StockRequestChemicalItem.objects.filter(stock_request__requested_by=u).delete()
            except Exception as e:
                self.stdout.write(f"Error deleting ChemicalItems for {eid}: {e}")

            # Delete stock requests
            try:
                n, _ = StockRequest.objects.filter(requested_by=u).delete()
                self.stdout.write(f"Cleaned {eid} ({n} requests)")
            except Exception as e:
                self.stdout.write(f"Error deleting requests for {eid}: {e}")
