# Session Prompt — Chemical Request v2 (Owner: Dharani)

## Step 1: Branch setup
Create a new branch from the current branch `feature/year-end-report`:

```
git checkout feature/year-end-report
git pull
git checkout -b feature/chemical-request-v2
```

Note: DB schema changes for this task have already been applied manually to Postgres on this machine. This session only needs to sync `models.py` and build the module logic/UI on top of the existing schema. Do not attempt to run migrations or ALTER statements — schema is already live. If the schema is not yet applied on this machine, stop and confirm with Nithish before proceeding — do not attempt to write your own schema changes.

---

## Step 2: Sync models.py
Update the `StockRequest` model to match the already-applied schema (`managed=False`, do not change):

Add fields:
- `day_order` (varchar, values: I, II, III, IV, V, VI)
- `hour` (integer array field, values: 1–5, multiple allowed)
- `purpose_type` (varchar, values: `practical_lab` / `research_project`)
- `experiment_name` (text)
- `student_name` (varchar, nullable)

No changes needed to `StockRequestChemicalItem` or `StockRequestApparatusItem`.

---

## Step 3: New Request form — layout change
Current: Class field and Date field each take a full row.
Change: Class and Date sit side-by-side in one row, 50/50 width split.

---

## Step 4: New Request form — new row (Day Order + Hour)
Add a new row directly below Class/Date:

- **Day Order** — single-select dropdown: I, II, III, IV, V, VI
- **Hour** — multi-select dropdown (checkbox-style options): 1, 2, 3, 4, 5

Both required fields. Store `hour` as an array of selected integers.

---

## Step 5: Replace Purpose/Remarks with radio tabs
Remove the current free-text "Purpose/Remarks (Optional)" field.

Replace with a radio tab toggle, two options:
- **Practical Lab**
- **Research/Project**

This field is now required (no longer optional) — one option must be selected.

---

## Step 6: Conditional fields based on radio tab selection

**If "Practical Lab" selected:**
- Show one field: **Experiment Name** (descriptive text input, required)

**If "Research/Project" selected:**
- Show two fields:
  - **Student Name - Class** (text input, required) → maps to `student_name`
  - **Experiment Name** (text input, required) → maps to `experiment_name`

Only the fields relevant to the selected tab should be visible/required at a time. Switching tabs should clear or hide the non-relevant field's value rather than submitting stale data from the other tab.

---

## Step 7: Backend — StockRequestSerializer
Extend to read/write:
- `day_order`
- `hour` (array)
- `purpose_type`
- `experiment_name`
- `student_name` (nullable, only populated when `purpose_type == research_project`)

Add validation: `student_name` must be null/empty when `purpose_type == practical_lab`; `experiment_name` is always required regardless of purpose_type.

---

## Step 8: Constraints — do not touch
- Do not modify chemical selection/quantity logic in `StockRequestChemicalItem` — out of scope for this task.
- Do not touch the Stock Register module, `ChemicalItem`, `ApparatusItem`, or supplier fields — that is a separate branch owned by Nithish.
- Apparatus remains not permitted in stock requests — do not add apparatus fields to this form.

---

## Step 9: Tests
Run the existing test suite. Add tests covering:
- Day Order / Hour field save and retrieval (array correctness)
- Purpose type conditional validation (practical_lab vs research_project field requirements)
- Class/Date layout does not affect existing submit logic

Report pass/fail count. Do not fix unrelated failing tests — only flag them.

Do not merge this branch. Stop after committing changes and running tests — manual verification and merge will be handled separately.
