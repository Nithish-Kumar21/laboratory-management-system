# OpenCode Session Prompt — Year-End Report Feature

---

## OVERVIEW

Build a Year-End Audit Report feature for the Laboratory Management System (LMS) of the
Chemistry Department, Guru Nanak College (PG and Research Programme).

This is a **read-only reporting feature** accessible only to **HOD** and **Storekeeper** roles.
Staff role must be blocked at both API and UI level.

The report covers one **academic year** (June–May) selected by the user on demand.
It produces:
1. An **on-screen infographic dashboard** (React + Recharts)
2. A **downloadable PDF** — formatted printable report with plain header
3. A **downloadable Excel (.xlsx)** — raw tabular data, one sheet per category

---

## PROJECT CONTEXT

**Stack:** Django 5.2 + DRF, React 19 (CRA), PostgreSQL, JWT auth (djangorestframework-simplejwt)
**Roles:** Staff, HOD, Storekeeper
**Frontend base URL:** `http://localhost:3000/`
**Backend base URL:** `http://localhost:8000/api/`
**Mobile-first PWA:** base viewport 375px, desktop layout at 768px+
**Existing chart library:** Recharts (already installed)
**Existing PDF library:** Check if reportlab or weasyprint is in backend/venv — use whichever exists. If neither, use reportlab (pip install reportlab).
**Existing Excel library:** Check if openpyxl is in backend/venv — use it. If not, pip install openpyxl.

---

## DATA SOURCES (Existing Models)

All data already exists in the database. Do NOT create new data models —
only create the API endpoint and report logic.

| Data | Model | Key Fields |
|------|-------|------------|
| Chemicals/apparatus purchased | `StockRegister` | `chemical_name`, `apparatus_name`, `quantity`, `unit`, `cost`, `date_added` |
| Chemicals used in lab sessions | `IssueRegister` / `IssueChemicals` | `chemical_name`, `requested_quantity`, `actual_used_quantity`, `returned_quantity`, `additional_used_quantity`, `date` |
| Damaged/lost items | `DamagedEntry` | `chemical_name` or `apparatus_name`, `quantity`, `reason`, `date` |
| Current inventory | `AvailableChemical`, `AvailableApparatus` | `name`, `quantity`, `unit`, `reorder_level` |
| Requests (for usage context) | `StockRequest` | `class_name`, `submitted_by`, `status`, `created_at` |

**Academic year filter logic:**
- Academic year = June 1 of year Y to May 31 of year Y+1
- Example: "2025–2026" = `2025-06-01` to `2026-05-31`
- All queries must filter by `date__range` using this range

---

## PART 1 — BACKEND API

### Endpoint

```
GET /api/reports/year-end/?year=2025
```

- `year` parameter = start year of academic year (e.g. `2025` means June 2025 – May 2026)
- Default: current academic year if no param provided
- Permission: HOD and Storekeeper only — block Staff with 403

### Permission Class

Create a custom DRF permission:

```python
class IsHODOrStorekeeper(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['HOD', 'Storekeeper']
```

### Response Structure

Return a single JSON object with all report data:

```json
{
  "academic_year": "2025-2026",
  "date_range": {
    "start": "2025-06-01",
    "end": "2026-05-31"
  },
  "summary": {
    "total_spend": 0.00,
    "total_chemicals_purchased": 0,
    "total_apparatus_purchased": 0,
    "total_chemicals_used": 0,
    "total_apparatus_used": 0,
    "total_damaged_chemicals": 0,
    "total_damaged_apparatus": 0
  },
  "monthly_purchase_trend": [
    {
      "month": "Jun 2025",
      "chemicals_cost": 0.00,
      "apparatus_cost": 0.00,
      "total_cost": 0.00,
      "chemicals_quantity": 0,
      "apparatus_quantity": 0
    }
  ],
  "top_used_chemicals": [
    {
      "name": "Hydrochloric Acid",
      "total_used": 0.00,
      "unit": "ml",
      "times_requested": 0
    }
  ],
  "purchases": {
    "chemicals": [
      {
        "name": "Hydrochloric Acid",
        "total_quantity": 0.00,
        "unit": "ml",
        "total_cost": 0.00,
        "purchase_count": 0
      }
    ],
    "apparatus": [
      {
        "name": "Beaker (250ml)",
        "total_quantity": 0,
        "unit": "nos",
        "total_cost": 0.00,
        "purchase_count": 0
      }
    ]
  },
  "usage_by_class": [
    {
      "class_name": "I M.Sc Chemistry",
      "total_requests": 0,
      "total_chemicals_used": 0.00
    }
  ],
  "damage_summary": {
    "chemicals": [
      {
        "name": "Sulphuric Acid",
        "total_quantity": 0.00,
        "unit": "ml",
        "incident_count": 0
      }
    ],
    "apparatus": [
      {
        "name": "Beaker (250ml)",
        "total_quantity": 0,
        "unit": "nos",
        "incident_count": 0
      }
    ]
  },
  "current_stock": {
    "low_stock_chemicals": [
      {
        "name": "Ethanol",
        "current_quantity": 0.00,
        "unit": "ml",
        "reorder_level": 0.00,
        "recommended_purchase": 0.00
      }
    ],
    "low_stock_apparatus": []
  },
  "restock_recommendations": [
    {
      "name": "Hydrochloric Acid",
      "type": "chemical",
      "avg_monthly_usage": 0.00,
      "projected_annual_need": 0.00,
      "current_stock": 0.00,
      "recommended_purchase": 0.00,
      "unit": "ml"
    }
  ]
}
```

### Restock Recommendation Logic

```python
avg_monthly_usage = total_used_this_year / 12
projected_annual_need = avg_monthly_usage * 12  # same as total used
recommended_purchase = max(0, projected_annual_need - current_stock)
```

Only include items where `recommended_purchase > 0`.

### URL Registration

```python
# backend/backend/urls.py
path('api/reports/', include('reports.urls')),
```

Create a new Django app: `reports`

```bash
python manage.py startapp reports
```

---

## PART 2 — FRONTEND DASHBOARD (React + Recharts)

### Route

```
/reports/year-end
```

Protected route — redirect to `/dashboard` with error if role is Staff.

### Page Layout — Desktop (768px+)

```
┌─────────────────────────────────────────────────────┐
│  Year-End Audit Report          [Year Selector ▼]   │
│  Chemistry Dept, Guru Nanak College  2025–2026       │
│                          [Download PDF] [Download Excel] │
├──────────┬──────────┬──────────┬──────────┐
│ Total    │ Chemicals│ Total    │ Total    │
│ Spend    │ Purchased│ Used     │ Damaged  │
│ ₹XX,XXX  │ XX items │ XX items │ XX items │
├──────────┴──────────┴──────────┴──────────┤
│  Monthly Purchase Trend (Line Chart)       │
│  [cost + quantity over 12 months]          │
├────────────────────┬───────────────────────┤
│ Top 10 Used        │ Spend by Category     │
│ Chemicals (Bar)    │ Chem vs Apparatus     │
│                    │ (Donut Chart)         │
├────────────────────┼───────────────────────┤
│ Usage by Class     │ Damage Summary        │
│ (Horizontal Bar)   │ (Bar Chart)           │
├────────────────────┴───────────────────────┤
│  Restock Recommendations (Table)           │
│  Name | Type | Avg Monthly | Recommended   │
│  Qty  | Current Stock | Unit              │
└────────────────────────────────────────────┘
```

### Page Layout — Mobile (375px)

- Single column, full width
- Stat cards: 2×2 grid
- All charts: full width, stacked vertically, scrollable
- Download buttons: sticky footer bar above bottom nav
  - Use `position: fixed; bottom: 60px` to clear the nav overlay
- Charts: reduce data labels, increase font size for readability

### Component Structure

```
frontend/src/pages/reports/
  YearEndReport.jsx          ← main page component
  components/
    StatCards.jsx            ← 4 summary stat cards
    MonthlyTrendChart.jsx    ← Recharts LineChart
    TopChemicalsChart.jsx    ← Recharts BarChart (horizontal)
    SpendDonutChart.jsx      ← Recharts PieChart
    UsageByClassChart.jsx    ← Recharts BarChart
    DamageSummaryChart.jsx   ← Recharts BarChart
    RestockTable.jsx         ← plain HTML table
    YearSelector.jsx         ← dropdown for academic year
    DownloadButtons.jsx      ← PDF + Excel download buttons
```

### Year Selector

Dropdown showing last 5 academic years:
```
2024–2025
2025–2026  ← default (current)
```

On change → re-fetch `/api/reports/year-end/?year=YYYY`

### Recharts Config

```javascript
// Colors — use these consistently across all charts
const COLORS = {
  chemical: '#3B82F6',   // blue
  apparatus: '#10B981',  // green
  damage: '#EF4444',     // red
  spend: '#F59E0B',      // amber
  usage: '#8B5CF6',      // purple
}

// All charts must be responsive
<ResponsiveContainer width="100%" height={300}>
```

### Loading & Error States

- Show skeleton loaders while fetching (simple grey animated divs)
- On API error: show "Failed to load report. Please try again." with retry button
- On empty data (no records for selected year): show "No data found for 2025–2026"

### API Call

```javascript
// frontend/src/utils/api.js — use existing axios instance
const fetchYearEndReport = async (year) => {
  const response = await api.get(`/reports/year-end/?year=${year}`);
  return response.data;
};
```

---

## PART 3 — PDF DOWNLOAD

### Trigger

```
GET /api/reports/year-end/download/pdf/?year=2025
```

Returns `application/pdf` with `Content-Disposition: attachment; filename="year_end_report_2025_2026.pdf"`

### PDF Structure (reportlab)

```
Page 1 — Cover / Summary
┌─────────────────────────────────────┐
│        Guru Nanak College           │
│  (PG and Research Programme)        │
│     Department of Chemistry         │
│                                     │
│   Year-End Audit Report             │
│      Academic Year 2025–2026        │
│   Generated on: 27 June 2026        │
│                                     │
│  ┌──────────┬──────────┬──────────┐ │
│  │ Total    │ Chemicals│ Damaged  │ │
│  │ Spend    │ Purchased│ Items    │ │
│  │ ₹XX,XXX  │ XX       │ XX       │ │
│  └──────────┴──────────┴──────────┘ │
└─────────────────────────────────────┘

Page 2 — Purchases Table
- Chemicals purchased (name, qty, unit, cost)
- Apparatus purchased (name, qty, unit, cost)

Page 3 — Usage Summary
- Top used chemicals table
- Usage by class table

Page 4 — Damage Log
- Chemicals damaged table
- Apparatus damaged table

Page 5 — Restock Recommendations
- Table with recommended purchase quantities
```

### PDF Styling

- Font: Helvetica (built into reportlab, no external fonts needed)
- Header on every page: "Chemistry Dept — Year-End Report 2025–2026"
- Footer on every page: page number "Page X of Y"
- College name in header: "Guru Nanak College (PG and Research Programme)"
- Department: "Department of Chemistry"
- Color accent: #1E3A8A (dark blue) for headers
- Tables: alternating row colors (#F8FAFC and #FFFFFF)

---

## PART 4 — EXCEL DOWNLOAD

### Trigger

```
GET /api/reports/year-end/download/excel/?year=2025
```

Returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
with `Content-Disposition: attachment; filename="year_end_report_2025_2026.xlsx"`

### Sheet Structure (openpyxl)

**Sheet 1 — Summary**
| Field | Value |
|-------|-------|
| Academic Year | 2025–2026 |
| Generated On | 27 June 2026 |
| Total Spend (₹) | XXXX |
| Total Chemicals Purchased | XX |
| Total Apparatus Purchased | XX |
| Total Chemicals Used | XX |
| Total Damaged Items | XX |

**Sheet 2 — Purchases**
Columns: Type | Name | Quantity | Unit | Cost (₹) | Purchase Count | Date Range

**Sheet 3 — Usage**
Columns: Chemical Name | Total Used | Unit | Times Requested | Class Name

**Sheet 4 — Damage Log**
Columns: Type | Name | Quantity | Unit | Reason | Incident Count

**Sheet 5 — Current Stock**
Columns: Type | Name | Current Qty | Unit | Reorder Level | Status (Low/OK)

**Sheet 6 — Restock Recommendations**
Columns: Type | Name | Avg Monthly Usage | Projected Annual Need | Current Stock | Recommended Purchase | Unit

### Excel Styling (openpyxl)

- Header row: bold, background fill #1E3A8A, white font
- Alternating data rows: #F0F4FF and #FFFFFF
- Column widths: auto-fit to content (minimum 15, maximum 40)
- Sheet tab colors: use distinct colors per sheet
- Number format: `#,##0.00` for quantities and costs

---

## PART 5 — NAVIGATION & ACCESS CONTROL

### Add to Sidebar/Nav

Add "Year-End Report" link in the navigation for HOD and Storekeeper roles only.
Do NOT show this link to Staff role.

```javascript
// Show only if role === 'HOD' || role === 'Storekeeper'
{(role === 'HOD' || role === 'Storekeeper') && (
  <NavLink to="/reports/year-end">Year-End Report</NavLink>
)}
```

### Protected Route (Frontend)

```javascript
// If Staff tries to access /reports/year-end directly via URL
if (role === 'Staff') {
  return <Navigate to="/dashboard" />;
}
```

### Backend Permission (API)

Return 403 with message if Staff role hits the endpoint:
```json
{"detail": "You do not have permission to access reports."}
```

---

## IMPLEMENTATION ORDER

Execute in this exact order — do not skip steps:

1. **Create `reports` Django app** and register in `INSTALLED_APPS`
2. **Build `/api/reports/year-end/` GET endpoint** with all aggregations
3. **Build `/api/reports/year-end/download/pdf/`** endpoint
4. **Build `/api/reports/year-end/download/excel/`** endpoint
5. **Register all 3 URLs** in `backend/backend/urls.py`
6. **Test all 3 endpoints manually** with HOD token — verify response structure matches spec
7. **Test 403** — verify Staff token gets blocked
8. **Build `YearEndReport.jsx`** page with all sub-components
9. **Wire up year selector** and API fetch
10. **Wire up PDF download button** — fetch blob, trigger browser download
11. **Wire up Excel download button** — same pattern
12. **Add route** to React Router config
13. **Add nav link** with role guard
14. **Test on mobile viewport (375px)** — verify sticky download buttons clear the bottom nav

---

## PDF/EXCEL DOWNLOAD PATTERN (Frontend)

```javascript
const downloadFile = async (type) => {
  const response = await api.get(
    `/reports/year-end/download/${type}/?year=${selectedYear}`,
    { responseType: 'blob' }
  );
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `year_end_report_${selectedYear}_${parseInt(selectedYear)+1}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
```

---

## CRITICAL GUARDS

- Do NOT expose this feature to Staff role — enforce at both API (403) and UI (redirect) levels
- All date queries must use academic year range (June 1 – May 31), not calendar year
- Chemical name matching is case-insensitive — use `iexact` or `icontains` in ORM queries
- `returned_quantity` and `additional_used_quantity` are stored explicitly — never calculate from other fields
- PDF and Excel must include generation date and academic year in filename and header
- Mobile download buttons must clear the bottom nav bar (`bottom: 60px` minimum)
- If no data exists for selected year, return empty arrays (not null) in JSON — frontend handles empty state gracefully
- Do NOT use `managed=False` models for the new `reports` app — standard Django managed models only
- Recharts `ResponsiveContainer` must be used on all charts — no fixed pixel widths
