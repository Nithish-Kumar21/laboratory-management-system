import csv
from datetime import date, timedelta

from django.db import connection
from django.http import HttpResponse
from django.utils.timezone import now

from rest_framework.views import APIView
from rest_framework.response import Response

from reports.permissions import IsHODOrStorekeeper
from stock_register.models import StockRegister, ChemicalItem, ApparatusItem


class StockRegisterReportView(APIView):
    permission_classes = [IsHODOrStorekeeper]

    def get(self, request):
        date_param = request.query_params.get('date')
        week_param = request.query_params.get('week')
        month_param = request.query_params.get('month')
        chemical_id = request.query_params.get('chemical_id')
        apparatus_id = request.query_params.get('apparatus_id')
        export = request.query_params.get('export')

        registers = StockRegister.objects.all()

        if date_param:
            registers = registers.filter(date=date_param)

        if week_param:
            try:
                year_str, week_str = week_param.split('-W')
                year = int(year_str)
                week_num = int(week_str)
                jan4 = date(year, 1, 4)
                start = jan4 - timedelta(days=jan4.isoweekday() - 1) + timedelta(weeks=week_num - 1)
                end = start + timedelta(days=6)
                registers = registers.filter(date__range=[start, end])
            except (ValueError, IndexError):
                return Response({'error': 'Invalid week format. Use YYYY-Www (e.g. 2026-W27)'}, status=400)

        if month_param:
            try:
                year_str, month_str = month_param.split('-')
                registers = registers.filter(date__year=int(year_str), date__month=int(month_str))
            except (ValueError, IndexError):
                return Response({'error': 'Invalid month format. Use YYYY-MM (e.g. 2026-07)'}, status=400)

        register_ids = list(registers.values_list('id', flat=True))

        items = []

        if register_ids:
            items.extend(self._get_chemical_items(register_ids, chemical_id))
            items.extend(self._get_apparatus_items(register_ids, apparatus_id))

        items.sort(key=lambda x: x['date'], reverse=True)

        if export == 'csv':
            return self._export_csv(items)

        page = int(request.query_params.get('page', 1))
        page_size = 25
        total = len(items)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size if total > 0 else 0,
            'results': items[start_idx:end_idx],
        })

    def _export_csv(self, items):
        response = HttpResponse(content_type='text/csv')
        timestamp = now().strftime('%Y%m%d_%H%M')
        filename = f"stock_register_report_{timestamp}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(['Item Name', 'Category', 'Quantity', 'Unit', 'Date'])
        for item in items:
            writer.writerow([
                item['name'],
                item['category'],
                item['quantity'],
                item['unit'],
                item['date'].isoformat() if hasattr(item['date'], 'isoformat') else item['date'],
            ])

        return response

    def _get_chemical_items(self, register_ids, chemical_id=None):
        with connection.cursor() as cursor:
            query = """
                SELECT ci.chemical_name, ci.total_quantity, ci.unit, sr.date
                FROM chemical_item ci
                JOIN stock_register sr ON sr.id = ci.stock_register_id
                WHERE ci.stock_register_id IN %s
            """
            params = [tuple(register_ids)]
            if chemical_id:
                query += " AND ci.id = %s"
                params.append(chemical_id)
            cursor.execute(query, params)
            return [
                {
                    'name': row[0],
                    'category': 'chemical',
                    'quantity': float(row[1]),
                    'unit': row[2] or 'ml',
                    'date': row[3],
                }
                for row in cursor.fetchall()
            ]

    def _get_apparatus_items(self, register_ids, apparatus_id=None):
        qs = ApparatusItem.objects.filter(stock_register_id__in=register_ids)
        if apparatus_id:
            qs = qs.filter(id=apparatus_id)
        return [
            {
                'name': item.apparatus_name,
                'category': 'apparatus',
                'quantity': item.quantity_pieces,
                'unit': 'nos',
                'date': item.stock_register.date,
            }
            for item in qs.select_related('stock_register')
        ]
