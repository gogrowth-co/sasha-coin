# Edge State Matrix — the 13 states every screen needs

A dashboard is only done when all of these are designed. Most dashboards ship the happy path and break everywhere else. This reference is the checklist that prevents that.

For **every screen and every data widget**, design all of these before declaring it done.

---

## The 13 states

| # | State | When it happens | Design treatment |
|---|---|---|---|
| 1 | **First load (cold cache)** | User just logged in, nothing cached | Skeleton screens shaped like the content — never spinners |
| 2 | **First load (warm cache)** | Returning user, data may be stale | Show cached immediately, refresh in background, indicate freshness with a timestamp |
| 3 | **Empty (new user)** | Account just created, no data yet | Educational + aspirational + ONE clear CTA. Coach, don't greet. |
| 4 | **Empty (filtered to nothing)** | Filters returned no results | "No matches for these filters" + a "Clear filters" button |
| 5 | **Empty (legitimately zero)** | The number really is 0 | Don't apologize. State the fact plainly. "0 errors today" is good news. |
| 6 | **Loading (partial)** | Some widgets loaded, others pending | Per-widget skeletons. Never block the whole page on the slowest widget. |
| 7 | **Error (network)** | Connection lost mid-session | Persistent banner + retry button + last-good-state preserved (don't blank the screen) |
| 8 | **Error (permission)** | User lacks access | Specific message + who to ask for access. Never a dead end. |
| 9 | **Error (server / 500)** | Backend failure | Apology + status page link + retry. Never "Something went wrong." |
| 10 | **Stale data** | Data older than acceptable freshness | Visible timestamp ("Updated 14:32") + manual refresh affordance |
| 11 | **Realtime updating** | Data changing live | Subtle highlight animation on the changed value. A "Live" dot. Not jarring. |
| 12 | **Throttled / rate-limited** | API quota hit | Specific message + when it resets ("Quota resets in 18 min") |
| 13 | **Maintenance mode** | Planned downtime | Branded, honest, dated. "Back at 16:00 UTC." Not a generic 503. |

---

## Skeleton vs. spinner — the rule

**Default to skeletons. Spinners are almost always wrong.**

- A spinner says "we have no idea how long this takes or what's coming."
- A skeleton says "here's the shape of what's loading — you'll recognize it the moment it arrives."
- Skeletons reduce perceived load time because the layout doesn't shift when content arrives.

Spinner is acceptable only for: an action with genuinely unknown duration triggered by a deliberate user click (e.g., "Generating report…"), and even then prefer a progress message ("Crunching 14,238 events…").

---

## Progressive load order

When a page has multiple widgets, define the load order explicitly. Don't let it be whatever resolves first.

1. **Layout shell** — instant. Nav, page structure, skeleton placeholders.
2. **Hero metrics** — first real data. These are why the user is here.
3. **Hero chart** — next.
4. **Supporting metrics** — after heroes.
5. **Data tables / drill-down** — last. They're below the fold anyway.

Each widget shows its own skeleton until its data arrives. The page is usable the moment the heroes land, even if the table is still loading.

---

## Empty state copy patterns

Empty states are the highest-leverage microcopy in the whole product — they're the first thing a new user sees.

| State | Good | Bad |
|---|---|---|
| New user, no data | "No reports yet. Build your first one in under 60 seconds. [Create report]" | "Welcome! 👋 Get started by creating a report." |
| Filtered to nothing | "No tasks match these filters. [Clear filters]" | "No results found." |
| Legitimately zero | "0 errors in the last 24 hours." (state it as the good news it is) | "No data available." |
| Awaiting first sync | "Connected. First sync runs within 5 minutes." | "—" |

The pattern: **state the situation + give the next action.** Never leave the user at a dead end.

---

## Error state copy patterns

| Situation | Good | Bad |
|---|---|---|
| Network down | "Couldn't reach the API. [Retry] or check [status page]." | "Something went wrong." |
| Permission denied | "You don't have access to this workspace. Ask [admin] to add you." | "Access denied." |
| Server error | "Our end broke, not yours. We've been notified. [Retry] or see [status]." | "Error 500." |
| Rate limited | "API quota reached. Resets in 18 minutes. Cached data shown below." | "Too many requests." |

The pattern: **take responsibility + be specific + give an exit.** Never blame the user, never be vague, never dead-end.

---

## Stale data treatment

Trust dies when a dashboard shows a confident number that's secretly hours old.

- Every data surface shows its freshness: a timestamp ("Updated 2m ago") near the data, in `text-caption`, `color-text-tertiary`.
- When data crosses the staleness threshold (defined per metric — a realtime metric is stale at 1 min, a daily batch at 25 hours), surface it: dim the number slightly + show a refresh affordance.
- On manual refresh, show the loading skeleton for that widget only, then update + flash the changed values.

---

## Realtime update treatment

When a value changes live:
- **Flash the changed element** with a 300ms accent-color pulse, then settle.
- **Never animate the number counting up** on each update — that obscures the change and reads as decorative.
- Show a **"Live" indicator** (a small pulsing dot) so the user knows the data is streaming, not frozen.
- Honor reduced-motion: the flash becomes a brief background-color change with no pulse.

---

## The "break it on purpose" QA step

Before declaring any screen done, intentionally trigger each of the 13 states:
- Throttle the network in devtools → states 1, 7, 10.
- Log in as a fresh account → states 3, 13.
- Apply impossible filters → state 4.
- Revoke a permission → state 8.
- Kill the API → states 7, 9.

If any state shows a broken layout, a generic spinner, a "Something went wrong," or a dead end — it's not done. This QA step is mandatory and runs via `playwright-visual-qa` where automatable.
