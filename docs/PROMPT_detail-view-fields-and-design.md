# Task: Add missing fields (Rate/Pack, Total Quantity) + improve visual design of Stock Entry detail view

## Context
The Stock Entry detail/view page (read-only summary shown after saving, "Chemical Acquisitions" and "Apparatus Acquisitions" sections) is missing two data points that already exist in the database and should be shown to the user:

- **Rate per Pack** — currently not shown anywhere on this view for Chemical Acquisitions.
- **Total Quantity** — currently not shown; only Pack Size × No. of Packs is implied via "500.00 ml × 4 packs", but the actual computed Total Quantity (2000.00 ml in this example) is never displayed.

Separately, the current card design is functionally correct but visually flat — plain white cards, no distinguishing hierarchy beyond bold/grey text weight, no visual texture or depth. This needs a more polished, intentional design treatment, not just a data fix.

Treat this as two combined goals: (1) surface the missing data, (2) elevate the visual design — both within the same section redesign, not as separate patches.

---

## Part 1 — Add missing fields

### Chemical Acquisitions — each line item must show:
- Chemical Name
- Pack Size × Unit × No. of Packs (existing — e.g. "500 ml × 4 packs")
- **Rate per Pack** (new — e.g. "₹250.00/pack")
- **Total Quantity** (new — e.g. "2000.00 ml total")
- Total Price (existing)
- Make (existing)

### Apparatus Acquisitions — each line item must show:
- Apparatus Name
- Quantity (pcs) × Rate/Piece (existing)
- Total Price (existing)
- Make (existing)
(Apparatus already shows all its relevant fields — no missing data here, only the visual redesign in Part 2 applies.)

Pull `rate` and `total_quantity` directly from the existing `chemical_item` record — these fields already exist in the database (confirmed via schema: `rate numeric(10,2)`, `total_quantity numeric(10,2)`) and just need to be included in the serializer response used by this detail view, and rendered on the page.

---

## Part 2 — Visual design improvement

The current design is too plain: flat white cards, uniform text weight aside from bold on name/price, no clear visual rhythm across multiple data points per line item. With more fields now being added (Rate/Pack, Total Quantity), the layout needs a more considered hierarchy so it doesn't just become a denser wall of text.

### Design direction
- Establish a clearer typographic hierarchy: the chemical/apparatus name and total price remain the most prominent (largest/boldest), but introduce a visually distinct secondary tier for the supporting metrics (Pack Size, Rate/Pack, Total Quantity, Make) — e.g. using a label + value pairing style (small uppercase muted label above or beside each value, similar to how "INVOICE NUMBER" / "SUPPLIER NAME" are already styled higher up on this same page) rather than dumping all secondary info into one plain inline sentence.
- Consider a light background tint, subtle divider, or icon accent per line item to break up repetition when there are multiple chemicals/apparatus in one entry — avoid a monotonous stacked list of identical plain cards.
- Maintain strong alignment discipline (already fixed in the prior task) — do not reintroduce misalignment while adding new fields.
- Keep to the existing color palette and typeface already used on this page (navy/blue accents, existing font) — this is about layout/hierarchy refinement, not a full re-theme.
- Ensure the added fields don't make individual line items feel cramped — prioritize breathing room and clear grouping over fitting everything into the smallest possible space.

### Constraints
- This is a read-only view — no input fields or edit affordances.
- Do not change the underlying data or calculation logic — this task only adds display of already-correct existing values and improves visual presentation.
- Test with multiple line items in a single entry, and with varying text lengths (short names like "qwertyu" vs. longer ones like "Sodium Bicarbonate"), to confirm the new design holds up consistently across items, not just a single best-case example.
- Confirm layout integrity at both mobile (375px base) and desktop widths.

---

## Final verification
1. Confirm Rate per Pack and Total Quantity now display correctly on every Chemical Acquisitions line item, matching the underlying `chemical_item` record values exactly.
2. Confirm Apparatus Acquisitions section is visually consistent with the redesigned Chemical Acquisitions section (matching hierarchy/style treatment).
3. Confirm alignment holds across multiple line items with varying text lengths.
4. Confirm mobile (375px) and desktop layouts both look intentional and uncramped.

Report back with a description of the design approach taken, and confirm all fields are now present and correctly sourced from the database.

Do not merge this branch. Stop after committing changes — manual verification and merge will be handled separately.
