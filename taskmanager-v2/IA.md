# ordify.me — Information Architecture (top-3 screens · 2026-04-29)

For each screen: **what user sees** (data, priority-ranked) and **what user does** (actions, priority-ranked).

Density rule:
- **PRIMARY** (>5×/day) — centre, largest, no clicks needed to access
- **SECONDARY** (1-5×/day) — visible but smaller, one click away
- **TERTIARY** (<1×/day) — collapsed, in a menu, settings

---

## App shell — persistent across every screen

```
╭─────────╮ ╭───────────────────────────╮ ╭────────╮
│         │ │                           │ │        │
│ SIDEBAR │ │   MAIN  (per-screen)      │ │ AI RAIL│
│  260px  │ │   1fr                     │ │ 360px  │
│         │ │                           │ │ (≥1400)│
╰─────────╯ ╰───────────────────────────╯ ╰────────╯
```

### Sidebar — what it shows (always)
| Pri | Element | Why this priority |
|---|---|---|
| 1 | brand wordmark `ordify.me` | identity anchor |
| 1 | `02 Today` (active by default) | J-02 — first thing every morning |
| 1 | `01 Capture` | J-01 — top job |
| 2 | `03 Tasks · N` count | flat overview |
| 2 | `04 Calendar` | meetings + deadlines |
| 2 | `05 Matters` | drilldown when reviewing client |
| 2 | `06 Time` | reports/timesheet |
| 2 | `07 Invoices` | weekly action |
| 1 | clients list (with industry-swatch + count) | navigation primary structure |
| 3 | settings ⚙ / theme / language | < 1×/day |

### AI rail — what it shows (≥1400px screens)
| Pri | Element |
|---|---|
| 1 | conversation bubbles + chip suggestions |
| 1 | input bar `Ask ordify…` |
| 2 | morning briefing (auto on first-open of day) |
| 3 | × close button (preference persisted) |

---

## Screen 01 — CAPTURE (J-01 · top priority)

**Goal:** dump a fragment in <10 sec, AI structures it correctly. User reviews and accepts.

### What user sees
| Pri | Element | Notes |
|---|---|---|
| 1 | **text input** (large, focused on open) | the only thing that matters |
| 1 | **mic button** | one-tap voice capture |
| 1 | submit button (Enter also works) | commit input to AI |
| 2 | recent captures (last 3, collapsed) | "what did I just write?" check |
| 2 | mode toggle: `quick` ↔ `meeting` (long transcript) | meeting paste shows different parser hint |
| 3 | example chips ("try: …") | onboarding only — hide after first 5 captures |
| 3 | reset / clear | < 1× per day |

### What user does
| Pri | Action | Trigger |
|---|---|---|
| 1 | type or speak the fragment | text/mic |
| 1 | submit → AI parse | Enter / submit btn |
| 1 | review parse in **AI Preview Modal** (overlay, see below) | auto-shown |
| 2 | switch mode quick ↔ meeting | toggle |
| 3 | paste long transcript | textarea grows |

### AI Preview Modal (overlay on top of Capture or any view)
Opens above whatever was on screen. Closes on accept/cancel.

| Pri | Element |
|---|---|
| 1 | detected action(s) — single OR chain (numbered N-014a/b/c) |
| 1 | for each: editable **type / name / parent ref / deadline / priority / tags** |
| 1 | for new matter: **billing-mode picker** (subscription / fixed / hourly) — AI pre-suggests |
| 1 | **fuzzy-match dropdowns** for ambiguous client/matter/company refs |
| 1 | per-row include/exclude checkbox (chain mode) |
| 1 | accept ▸ commit button |
| 2 | re-parse button (✕ try different parse) |
| 2 | cancel |

### Why this layout
Capture is the highest-frequency entry point. Single text input dominates. Everything else is one click below or in the modal-on-commit. No filtering, no list, no drill-down — those belong to Today/Tasks.

---

## Screen 02 — TODAY (J-02 · morning triage)

**Goal:** in 5 seconds of looking, see what's burning today. Then plan the rest.

### What user sees (top → bottom)

#### **«ON FIRE» band — top, largest visual weight (PRIMARY)**
| Pri | Element |
|---|---|
| 1 | overdue tasks (vermillion fill) |
| 1 | procedural deadlines (vermillion + PROCEDURAL badge) |
| 1 | meetings within next 2h (with countdown to start) |

If band is empty → small affirmative line "all clear · nothing burning".

#### **Today's schedule — middle, primary list (PRIMARY)**
| Pri | Element |
|---|---|
| 1 | task rows grouped by hour blocks (`MORNING / AFTERNOON / EVENING`) |
| 1 | meetings interleaved with tasks (date-sorted) |
| 2 | done-earlier section (collapsed by default) |
| 2 | filter chips (`mine / all / billable / fixed-deadline`) |

#### **AI footer-bar — bottom, persistent (SECONDARY)**
| Pri | Element |
|---|---|
| 1 | one AI suggestion at a time (`AI ▸ Defer 2 P3 tasks?`) |
| 1 | Apply / Dismiss buttons |
| 2 | dismiss-all toggle (mute for the day) |

### What user does
| Pri | Action |
|---|---|
| 1 | check task as done (×) |
| 1 | start timer ▶ on a task |
| 1 | click task to open editor (modal) |
| 2 | apply AI suggestion |
| 2 | filter the list |
| 2 | jump to matter/client from a task row (right-click? hover?) |
| 3 | reorder tasks (drag) |

### Each task row shows
| Pri | Element | Notes |
|---|---|---|
| 1 | checkbox / status indicator | one-click cycle |
| 1 | title | the thing itself |
| 1 | due time/date | scheduling anchor |
| 1 | priority pill (P0/P1/P2/P3) | visual scan |
| 2 | matter context (`Acme · subscription`) | mono label, secondary |
| 2 | tags (industry + custom) | filtering signal |
| 2 | AI mark `AI ▸` if AI-touched | trust signal |
| 3 | hover actions (timer, edit, delete) | rare per row |
| 3 | task idx `T-XXXX` | mono, faint, mostly aesthetic |

### Why this layout
"On fire" must be visually different and at top — rule of "what's the situation" before "what's the schedule". AI footer is persistent so the assistant can suggest mid-day, not just morning.

---

## Screen 03 — QUICK-LOG-CALL POPOVER (J-03 · biggest $ leak)

**Goal:** 5-second flow to log a finished short client call. Fewest possible inputs.

### What user sees
A 200×260px popover anchored top-right (or wherever `⌘L` was triggered). Modal-style — focus trap, but small.

| Pri | Element | Notes |
|---|---|---|
| 1 | **client picker** | auto-pre-filled with last-active client; click to change |
| 1 | **matter picker** | auto-pre-filled with most-recent matter for that client; click to change |
| 1 | **duration** | ⊟/⊞ stepper, default = 12 min (or time since last keypress / since incoming call timestamp) |
| 1 | **log button** | also bound to Enter |
| 2 | topic (1 line, optional) | short description |
| 2 | billable toggle | auto-on for billable matters; auto-off for fixed; counts-toward-scope for subscription |
| 3 | "switch to full editor" link | for the rare case the user wants more |

### What user does
| Pri | Action | Trigger |
|---|---|---|
| 1 | confirm defaults & log | Enter |
| 1 | change client/matter | dropdown |
| 1 | tweak duration | stepper |
| 2 | type topic | text input |
| 2 | escape (cancel) | Esc |

### What COMMIT does (under the hood)
1. creates `Timelog { source: 'quick-call', billable, hours, taskId }`
2. if no current task on matter → creates a stub task `Call · {topic or "—"}` with that hours
3. updates subscription scope_used if applicable
4. shows toast: `"12 min logged · Acme · 7.4h / 10h"`
5. closes popover

### Why this layout
J-03 is a 5-sec interaction. Every field beyond duration+matter is friction. The popover is small (200×260) on purpose — it's the OPPOSITE of a structured form. Auto-prefilling 80% of the data is the entire point.

---

## Cross-cutting — what's COMMON to all three

| Element | Where |
|---|---|
| Brand · Sidebar · AI rail | persistent shell |
| Vermillion | only for: overdue · procedural · OFAC-style alarm. Never for plain CTAs |
| Plum (accent) | brand · active sidebar · primary CTA · AI mark · headline accent |
| Linen surface | Capture pad only |
| Lime | tracker-now block (when timer running) |
| Cobalt / saffron / magenta | tags & swatch dots |
| Mono caps (JetBrains) | every label, idx, eyebrow, status |
| Inter Tight 800 lowercase | every headline |
| Inter | body copy |

---

## What's NEXT in IA (the other 9 screens, deferred)

| Screen | Job | Will design when |
|---|---|---|
| Tracker (running clock + log + bar chart) | J-03 part 2 | after top-3 done |
| Matter detail (subscription variant) | J-04 + J-05 | next batch |
| Matter detail (fixed variant) | J-05 | next batch |
| Matter detail (hourly variant) | J-05 | next batch |
| Calendar (with meetings) | J-08 | next batch |
| Meeting editor | J-08 | next batch |
| Invoice list | J-06 | next batch |
| Invoice wizard (3 steps, mixed lines) | J-06 | next batch |
| Invoice document | J-06 | next batch |
| Client detail | F-48,49 | post-Phase-1 |
| Settings | F-160..F-169 | post-Phase-1 |

---

**Status:** locked for top-3. Next: §⑦ — wireframes (low-fi boxes) of these 3 screens.
