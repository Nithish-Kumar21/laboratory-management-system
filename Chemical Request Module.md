Chemical Request Module - Development Requirements & Business Logic
**Status:** ✅ **COMPLETED** (See `COMPLETED_CHEMICAL_REQUEST.md` for details)

🎯 Module Overview

Complete workflow system connecting Chemical Request → HOD Approval → Storekeeper Issue → Staff Usage Reporting → Inventory Reconciliation → Historical Logging. Implements strict role-based access control with automatic inventory management via PostgreSQL triggers.
📋 Database Schema Requirements
Core Tables

text
chemical_requests
├── id (SERIAL PRIMARY KEY)
├── request_number (VARCHAR(20), UNIQUE, REQ-001 format)
├── staff_name (VARCHAR(64))
├── class_name (VARCHAR(64))
├── request_date (DATE)
├── status (VARCHAR(20)): 'draft','requested','approved','rejected','issued','reported','completed'
├── submitted_at (TIMESTAMP)
├── approved_at (TIMESTAMP, NULL until approved)
├── issued_at (TIMESTAMP, NULL until issued)
├── reported_at (TIMESTAMP, NULL until reported)
├── completed_at (TIMESTAMP, NULL until completed)

chemical_request_items
├── id (SERIAL PRIMARY KEY)
├── chemical_request_id (INTEGER FK → chemical_requests ON DELETE CASCADE)
├── chemical_name (VARCHAR(64))
├── requested_quantity_ml (NUMERIC(10,2))
├── actual_used_quantity_ml (NUMERIC(10,2), NULL until reported)

draft_requests (SEPARATE table for drafts)
├── id (SERIAL PRIMARY KEY)
├── staff_name (VARCHAR(64))
├── class_name (VARCHAR(64))
├── request_items (JSON or related table)
├── created_at (TIMESTAMP)

issue_register (EXISTING - receives historical copy on completion)
├── ADD COLUMNS: returned_quantity_ml (NUMERIC(10,2)), additionally_used_ml (NUMERIC(10,2))

🔄 State Machine & Workflow

text
DRAFT → REQUESTED → APPROVED → ISSUED → REPORTED → COMPLETED
     ↘              ↘         ↘       ↘        ↘
     (unlimited)    REJECTED  (end)    (end states)

Status Transitions & Triggers
From → To	Role	Action	Inventory Impact
draft → requested	Staff	Submit	None
requested → approved	HOD	Approve	None
requested → rejected	HOD	Reject	None
approved → issued	Storekeeper	Mark Issued	DECREASE available_chemicals (requested qty)
issued → reported	Staff	Report Usage	None
reported → completed	Storekeeper	Mark Complete	ADJUST available_chemicals (returned/additional)
👥 Role-Based Access Control Matrix
Action	Staff	HOD	Storekeeper
Create Draft Requests	✅ Unlimited	❌	❌
Submit New Request	✅ (1 active max)	❌	❌
View Own Requests	✅ All statuses	✅ Own view	✅ Own view
View All Requests	❌	✅ All statuses	✅ All statuses
Approve/Reject Requests	❌	✅ ('requested' only)	❌
Mark as Issued	❌	❌	✅ ('approved' only)
Report Actual Usage	✅ (Own 'issued' only)	❌	❌
Mark as Completed	❌	❌	✅ ('reported' only)
View History	Own completed	All completed	All completed
⚙️ Business Logic Rules
1. Staff Request Lock (CRITICAL)

text
REQUIREMENT: Staff cannot submit new request if they have ANY active request
Active statuses = ['requested', 'approved', 'issued', 'reported']

Backend validation BEFORE submit:
IF ChemicalRequest.objects.filter(staff_name=user.staff_name, status__in=['requested','approved','issued','reported']).exists():
  RETURN 403 "Complete your previous request first"

2. Inventory Management (Two-Step)

text
STEP 1 - ISSUED (Storekeeper):
  Decrease available_chemicals by requested_quantity_ml
  TRIGGER fires on status='issued'

STEP 2 - COMPLETED (Storekeeper):
  Calculate:
    returned_qty = requested_qty - actual_used_qty (if > 0)
    additional_used_qty = actual_used_qty - requested_qty (if > 0)
  
  ADD returned_qty → available_chemicals
  SUBTRACT additional_used_qty → available_chemicals
  TRIGGER fires on issue_register INSERT

3. Request Numbering

text
Auto-generate: REQ-001, REQ-002, REQ-003...
Last request_number → extract number → increment → pad with 3 zeros

4. Usage Reporting Rules

text
- Staff can ONLY report on their OWN 'issued' requests
- actual_used_quantity_ml can be ANY value (more/less than requested)
- No inventory change at reporting (happens at completion)
- Must report ALL chemicals before completion allowed

🗄️ PostgreSQL Triggers (REQUIRED)
Trigger 1: Issue Inventory Decrease

text
WHEN: chemical_requests.status changes to 'issued'
ACTION: 
FOR each chemical_request_items:
  UPDATE available_chemicals 
  SET available_quantity_ml -= requested_quantity_ml
  WHERE chemical_name matches

Trigger 2: Completion Inventory Adjustment

text
WHEN: issue_register record created (copy from completed request)
ACTION:
FOR each chemical_issue_item:
  IF returned_quantity_ml > 0:
    available_chemicals += returned_quantity_ml
  IF additionally_used_ml > 0:
    available_chemicals -= additionally_used_ml

🎨 Frontend UI Requirements
Progressive Form States

text
1. STAFF CREATE: [Chemical List] [Save Draft] [Submit Request*]
2. HOD REVIEW:   [Request Details] [Approve] [Reject]
3. STOREKEEPER ISSUE: [Request Details] [Mark as Issued*]
4. STAFF REPORT: [Actual Usage Section*] [Submit Usage*]
5. STOREKEEPER COMPLETE: [Full Details + Calculations] [Mark Complete*]

Dynamic Submit Button

text
If staff has active request:
  Button: "Complete Previous Request First" (disabled)
Else:
  Button: "Submit Request" (enabled)

📊 Data Flow Example

text
Initial: HCl = 1000ml

1. Staff: REQ-001 requests 100ml HCl → REQUESTED
2. HOD: APPROVES
3. Storekeeper: ISSUES → available_chemicals: 900ml
4. Staff: Reports 120ml actual used → REPORTED
   calculated: returned=0ml, additional=20ml
5. Storekeeper: COMPLETES → 
   issue_register logs: returned=0ml, additional=20ml
   available_chemicals: 900ml - 20ml = 880ml ✓

⚠️ Validation Rules
Check	When	Who	Action
Staff active request	Submit	Backend	Block 403
All chemicals reported	Complete	Storekeeper	Block
Status progression	All transitions	Backend	Block invalid
Own request only	Usage report	Staff	Block others
🚀 Implementation Phases (3-Person Team)

text
WEEK 1:
├── Person 1: chemical_requests + chemical_request_items + draft_requests tables
├── Person 2: PostgreSQL triggers (issue + completion)
└── Person 3: Django models (managed=False)

WEEK 2:
├── Person 1: Staff create/submit + request lock logic
├── Person 2: HOD approve/reject APIs
└── Person 3: Storekeeper issue + React list views

WEEK 3:
├── Person 1: Staff usage reporting
├── Person 2: Storekeeper completion + issue_register copy
└── Person 3: Role-based UI components

WEEK 4:
├── Full testing + UI polish + documentation

✅ Success Criteria

    Staff cannot submit 2nd request until 1st is 'completed'

    Inventory decreases at 'issued', final adjustment at 'completed'

    Each role sees only their appropriate actions

    REQ-### numbering works

    Triggers fire correctly (no manual inventory math)

    Full audit trail in issue_register
