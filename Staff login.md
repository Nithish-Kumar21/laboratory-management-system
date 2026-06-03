# Prompt 01 — Staff Layout Shell (Desktop + Mobile)

## Goal
Create the persistent layout shell for the Staff role:
- **Desktop (`lg:` and above):** Fixed Header + Fixed Sidebar + `<Outlet />`
- **Mobile (below `lg:`):** Fixed Header + Fixed Bottom Nav + `<Outlet />`

No page content. Layout shell only.

---

## Read First (do not modify)
- `src/layouts/` — existing layout patterns
- `src/App.jsx` or `src/routes/` — current routing structure
- `tailwind.config.js` — existing theme config

---

## Files to Create

```
src/layouts/StaffLayout.jsx
src/components/staff/StaffHeader.jsx
src/components/staff/StaffSidebar.jsx
src/components/staff/StaffBottomNav.jsx
```

---

## Design Tokens

| Token | Value |
|---|---|
| Header + Sidebar bg | `#1A3C6E` |
| Sidebar active item bg | `#2d5aa0` |
| Sidebar active left bar | `#ffffff` 3px |
| Sidebar text default | `rgba(255,255,255,0.75)` |
| Sidebar text active | `#ffffff` |
| Avatar bg | `#4A90D9` |
| Page bg | `#F0F2F5` |
| Bottom nav bg | `#ffffff` |
| Bottom nav active color | `#1A3C6E` |
| Bottom nav active top bar | `#1A3C6E` 2.5px |
| Notification dot | `#ef4444` (red-500) |

---

## StaffHeader.jsx

**Both desktop and mobile use this same component — responsive internally.**

```
Height: 56px  |  bg: #1A3C6E  |  px-6 (desktop) / px-4 (mobile)
```

**Left:** Flask icon (lucide-react `FlaskConical`, white 22px) + text **"LMS"** (white, 20px, font-bold)

**Right (flex items-center gap-3):**
1. `Bell` icon button (lucide-react, white 20px) — red dot badge (6px absolute) when `hasNotification` prop is true
2. `Moon` / `Sun` icon button — toggles with `isDark` local state (visual only, no persistence)
3. Avatar circle (34px, rounded-full, bg `#4A90D9`, white initials text 13px font-semibold)
   - On **`lg:`** also show: name **"Staff"** (white 14px font-medium) + role **"Store Department"** (white/60, 12px) in a `<div>` to the right of avatar
   - On **mobile**: avatar only, no name/role text

Props: `{ hasNotification = false }`
User fallback: `{ name: 'Staff', role: 'Store Department', initials: 'ST' }` — read from auth context if available, else use fallback.

---

## StaffSidebar.jsx

```
Desktop only  |  fixed left-0 top-[56px] bottom-0  |  w-[220px]  |  bg: #1A3C6E
```

**Top nav — use `<NavLink>` from react-router-dom:**

| Icon (lucide-react) | Label | Route |
|---|---|---|
| `Package` | Inventory | `/staff/inventory` |
| `FileText` | Chemical Request | `/staff/chemical-request` |
| `PenLine` | My Draft | `/staff/draft` |

**Nav item classes:**
- Default: `flex items-center gap-3 px-5 py-3 text-sm text-white/75 hover:bg-white/10 hover:text-white relative`
- Active (`isActive`): `bg-[#2d5aa0] text-white font-medium` + left bar: `before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-white`
- Icon: size 18px, flex-shrink-0

**Bottom pinned (after `mt-auto`):**
- Divider: `border-t border-white/15 mx-4 mb-2`
- Settings: `<NavLink to="/staff/settings">` — same nav item style, icon `Settings`
- Logout: plain `<button>` — same visual style, icon `LogOut`, `onClick={() => console.log('logout')}`

---

## StaffBottomNav.jsx

```
Mobile only  |  fixed bottom-0 left-0 right-0  |  h-[60px]  |  bg-white border-t border-gray-200  |  z-50
```

**3 tabs — use `<NavLink>`:**

| Icon (lucide-react) | Label | Route |
|---|---|---|
| `Package` | Inventory | `/staff/inventory` |
| `FileText` | Requests | `/staff/chemical-request` |
| `PenLine` | Draft | `/staff/draft` |

**Tab item classes:**
- Wrapper: `flex-1 flex flex-col items-center justify-center gap-0.5 relative`
- Default icon: size 22px, `text-gray-400`
- Default label: `text-[10px] text-gray-400`
- Active: icon + label use `text-[#1A3C6E] font-medium` + top bar: `after:absolute after:top-0 after:left-[20%] after:right-[20%] after:h-[2.5px] after:bg-[#1A3C6E] after:rounded-b-sm`
- Notification dot on Requests tab: `absolute top-2 right-[calc(50%-14px)] w-[7px] h-[7px] bg-red-500 rounded-full border-2 border-white` — show when `hasNotification` prop is true

Props: `{ hasNotification = false }`

---

## StaffLayout.jsx

```jsx
// Renders: StaffHeader (always) + StaffSidebar (lg:) + StaffBottomNav (mobile) + <Outlet />
// Pass hasNotification={true} as placeholder to header and bottom nav

// Main content area classes:
// Desktop: ml-[220px] mt-[56px] min-h-[calc(100vh-56px)] bg-[#F0F2F5] p-6
// Mobile:  mt-[56px] pb-[60px] min-h-[calc(100vh-116px)] bg-[#F0F2F5] p-4
```

Use Tailwind responsive prefix:
- Sidebar: `hidden lg:flex` (flex-col)
- Bottom nav: `flex lg:hidden`
- Main padding: `p-4 lg:p-6`
- Main margin-left: `lg:ml-[220px]`

---

## Router Integration

In `src/App.jsx` (or router file), wrap staff routes with `StaffLayout` if not already done:

```jsx
<Route path="/staff" element={<StaffLayout />}>
  <Route path="inventory" element={<div className="p-4">Inventory — coming soon</div>} />
  <Route path="chemical-request" element={<div className="p-4">Chemical Request — coming soon</div>} />
  <Route path="draft" element={<div className="p-4">Draft — coming soon</div>} />
  <Route path="settings" element={<div className="p-4">Settings — coming soon</div>} />
</Route>
```

Only add if `/staff` wrapper does not exist. If it exists, update it to use `StaffLayout`.

---

## Hard Rules

- ❌ No backend files, API files, hooks, or context files — layout shell only
- ❌ No new npm packages — use only existing `lucide-react` and `react-router-dom`
- ❌ No inline styles — Tailwind classes only
- ❌ No dark mode persistence — theme toggle is visual placeholder (`isDark` local state only)
- ✅ `NavLink` active state via `className={({ isActive }) => ...}`
- ✅ `<Outlet />` inside main content area
- ✅ No horizontal scroll at any viewport width
- ✅ Header z-50, Sidebar z-40, Bottom nav z-50 — no overlap conflicts

---

## Done When

- `/staff/inventory` → header + sidebar on desktop, header + bottom nav on mobile, Inventory tab active
- Clicking each nav item → navigates and highlights correctly
- Bell shows red dot, theme toggle switches Moon ↔ Sun
- No console errors, no layout overflow
