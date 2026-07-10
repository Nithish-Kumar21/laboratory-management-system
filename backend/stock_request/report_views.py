import csv
from datetime import date, timedelta

from django.db import connection
from django.http import HttpResponse
from django.utils.timezone import now

from rest_framework.views import APIView
from rest_framework.response import Response

from reports.permissions import IsHODOrStorekeeper


ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI']


class IssueRegisterReportView(APIView):
    permission_classes = [IsHODOrStorekeeper]

    def get(self, request):
        date_param = request.query_params.get('date')
        week_param = request.query_params.get('week')
        month_param = request.query_params.get('month')
        chemical_id = request.query_params.get('chemical_id')
        staff_id = request.query_params.get('staff_id')
        raw_day_order = request.query_params.get('day_order')
        raw_hour = request.query_params.get('hour')
        export = request.query_params.get('export')

        if raw_day_order is not None:
            try:
                d = int(raw_day_order)
                if d < 1 or d > 6:
                    return Response({'error': 'day_order must be between 1 and 6'}, status=400)
            except ValueError:
                return Response({'error': 'Invalid day_order'}, status=400)

        if raw_hour is not None:
            try:
                h = int(raw_hour)
                if h < 1 or h > 5:
                    return Response({'error': 'hour must be between 1 and 5'}, status=400)
            except ValueError:
                return Response({'error': 'Invalid hour'}, status=400)

        with connection.cursor() as cursor:
            query = """
                SELECT ic.chemical_name, ic.issued_quantity,
                       ir.staff_name, ir.date,
                       sr.day_order, sr.hour
                FROM issue_chemicals ic
                JOIN issue_register ir ON ir.ir_id = ic.ir_id
                LEFT JOIN stock_request sr ON sr.id = ir.stock_request_db_id
                WHERE 1=1
            """
            params = []

            if date_param:
                query += " AND ir.date = %s"
                params.append(date_param)

            if week_param:
                try:
                    year_str, week_str = week_param.split('-W')
                    year = int(year_str)
                    week_num = int(week_str)
                    jan4 = date(year, 1, 4)
                    start = jan4 - timedelta(days=jan4.isoweekday() - 1) + timedelta(weeks=week_num - 1)
                    end = start + timedelta(days=6)
                    query += " AND ir.date BETWEEN %s AND %s"
                    params.extend([start, end])
                except (ValueError, IndexError):
                    return Response({'error': 'Invalid week format. Use YYYY-Www (e.g. 2026-W27)'}, status=400)

            if month_param:
                try:
                    year_str, month_str = month_param.split('-')
                    query += " AND EXTRACT(YEAR FROM ir.date) = %s AND EXTRACT(MONTH FROM ir.date) = %s"
                    params.extend([int(year_str), int(month_str)])
                except (ValueError, IndexError):
                    return Response({'error': 'Invalid month format. Use YYYY-MM (e.g. 2026-07)'}, status=400)

            if chemical_id:
                query += " AND ic.id = %s"
                params.append(chemical_id)

            if staff_id:
                query += """ AND EXISTS (
                    SELECT 1 FROM users_user u WHERE u.id = sr.requested_by_id AND u.employee_id = %s
                )"""
                params.append(staff_id)

            if raw_day_order is not None:
                query += " AND sr.day_order = %s"
                params.append(ROMAN[int(raw_day_order)])

            if raw_hour is not None:
                query += " AND %s = ANY(sr.hour)"
                params.append(int(raw_hour))

            query += " ORDER BY ir.date DESC, ir.ir_id DESC"

            cursor.execute(query, params)
            rows = cursor.fetchall()

        items = []
        for row in rows:
            items.append({
                'chemical_name': row[0],
                'quantity_issued': float(row[1]),
                'staff_name': row[2],
                'date': row[3],
                'day_order': row[4],
                'hour': row[5],
            })

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
        filename = f"issue_register_report_{timestamp}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(['Chemical Name', 'Quantity Issued', 'Staff Name', 'Date', 'Day Order', 'Hour'])
        for item in items:
            hour_str = ', '.join(str(h) for h in item['hour']) if item['hour'] else ''
            writer.writerow([
                item['chemical_name'],
                item['quantity_issued'],
                item['staff_name'],
                item['date'].isoformat() if hasattr(item['date'], 'isoformat') else item['date'],
                item['day_order'] or '',
                hour_str,
            ])

        return response
