from django.core.management.base import BaseCommand
from django.db import transaction
from stock_request.models import StockRequest


class Command(BaseCommand):
    help = 'Migrate existing request IDs to new REQ-YYYY-XXX format'

    def handle(self, *args, **options):
        self.stdout.write('Starting request ID migration...')
        
        # Get all requests ordered by creation date
        requests = StockRequest.objects.all().order_by('created_at')
        
        if not requests.exists():
            self.stdout.write(self.style.WARNING('No requests found to migrate.'))
            return
        
        # Group requests by year
        requests_by_year = {}
        for request in requests:
            year = request.created_at.year
            if year not in requests_by_year:
                requests_by_year[year] = []
            requests_by_year[year].append(request)
        
        # Update request IDs
        updated_count = 0
        with transaction.atomic():
            for year, year_requests in sorted(requests_by_year.items()):
                for index, request in enumerate(year_requests, start=1):
                    old_id = request.request_id
                    new_id = f"REQ-{year}-{index:03d}"
                    
                    # Update using raw SQL to bypass the save() method
                    StockRequest.objects.filter(pk=request.pk).update(request_id=new_id)
                    
                    self.stdout.write(
                        f'Updated: {old_id} -> {new_id}'
                    )
                    updated_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully migrated {updated_count} request IDs!')
        )
