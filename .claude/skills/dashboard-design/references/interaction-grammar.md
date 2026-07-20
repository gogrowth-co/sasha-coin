# Interaction Grammar & Dense Tables

How a dashboard responds to a click is a design decision, not a framework default. Pick the **lightest pattern that fits the interaction's weight and permanence** — and use it consistently across the whole surface.

> Distilled from the dashboard-design video set (practical dashboard UI patterns), 2026-06-06. Source: `_ops/dashboard-video-distillation-2026-06-06.md`.

---

## The decision table

| Interaction | Pattern | Why |
|---|---|---|
| Hover hint, single fact | **Tooltip** | No click, transient, zero context cost |
| Quick peek / definition / settings toggle, non-blocking | **Popover** | Dismisses on click-away, user keeps context |
| Read a record's full detail without leaving the list | **Drawer** (side panel) | Keeps list context, slides over, `Esc` closes |
| Complex input / multi-field form / destructive confirm | **Modal** | Blocks, forces a decision, one focused task |
| Permanent or large context change (full edit, different object) | **Page / route** | URL changes, back button works, breadcrumb |
| Action feedback (saved, failed, queued) | **Toast** | Non-blocking, auto-dismiss, color-coded |

**Rules:**
- **Don't open a modal for a read.** Drawers are for detail; modals are for input.
- A modal is a blocker — use it only when the user must finish or cancel before doing anything else.
- Every navigation to a new page gets a back affordance (breadcrumb or back button).
- **Toasts:** bottom-right, auto-dismiss 4–6s, dismissible, one line, semantic icon (success / warn / error). Never a toast for something the user must *act* on — that's a banner or an inline state.

---

## Optimistic UI

For **reversible** actions (approve, archive, toggle, delete-with-undo): update the UI instantly assuming success, fire the request in the background, reconcile on response. A failure rolls back and a toast states why. This is what makes a console feel instant.

**Do NOT** use optimistic UI for irreversible or financial actions — wait for confirmation there.

---

## Dense tables — the >15-row rule

Any list/table over ~15 rows is no longer scannable. It needs interaction, or it's a wall.

- **> 15 rows** → search (filter-as-you-type over the primary column).
- **> 30 rows** → structured filters (by status / type / owner) + sortable columns.
- **> 100 rows** → virtualize or paginate. Never render a 150-row DOM wall.
- **Sortable headers** — click to sort, indicator shows direction.
- **Sticky header** on scroll.
- **The overflow state:** show `N of M` and how to reach the rest. Never silently truncate (a silent cap reads as "this is everything").
- Row height tracks density mode (48 / 40 / 32px — see `density-and-responsive.md`).

In MangaOS Mission Control this applies to: **Skills** (~79–150), **Automations** (141), **Tools** (31), **Memory**.
