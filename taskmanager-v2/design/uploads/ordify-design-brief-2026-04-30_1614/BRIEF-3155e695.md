# ordify.me — Design Brief for Claude Design

**Project:** AI-first task & matter manager for an international lawyer
**Status:** mid-build, design-system locked, top-3 hi-fi mockups done, omni-input paradigm just confirmed
**Goal:** design the remaining screens consistently with the locked principles

---

## 1 · WHO USES THIS

**Sergiy** — international lawyer based in Spain, solo or with a small team.

**Practice areas across very different industries:**
- IT (services + product)
- Crypto (licensing, compliance)
- B2B trade (e.g. aircraft engines)

**Recurring task types:**
- Corporate work (incorporation, ongoing maintenance)
- Crypto licensing
- Compliance
- Contracts

**Revenue mix (in order of weight):**
1. **Subscription** — large monthly retainer per client (the bulk)
2. **Fixed-price services** — e.g. "incorporate US LLC by 15 May for €2400" — project with deadline + fixed amount
3. **Billable hours** — minority of revenue

**Languages:** English, Spanish, Ukrainian.

**What must never be missed:** procedural deadlines, promised action deadlines (e.g. registration by date), client meetings.

---

## 2 · JOBS-TO-BE-DONE (ranked)

| # | Job | Frequency | Pain |
|---|---|---|---|
| J-01 | Capture a fragment (email/voice/call note) → AI structures into client+matter+task | 5–15×/day | Highest priority |
| J-02 | Morning: see what's burning (overdue + procedural + meetings-in-2h) before anything else | 1×/day | Second priority |
| J-03 | Log a 5–15 min client call without form-ceremony | 3–8×/day | Biggest $ leak |
| J-04 | Answer a subscription client's quick question + silently log it | 3–6×/day | Scope tracking |
| J-05 | Fixed-price project: see milestones & deadline-countdown, NOT hours | 2–5 active | Delivery-critical |
| J-06 | Generate invoice mixing subscription fee + fixed milestones + billable hours | 1–2×/week | Revenue gate |
| J-07 | Procedural / hard deadline coming up — surface everywhere | weekly | Irreversible |
| J-08 | Client meeting today — auto pre-task + auto-log post-meeting | 1–3×/day | Time-blocking |

---

## 3 · CORE PARADIGM (locked principles)

These are **non-negotiable** — every design decision should follow from them.

### 3.1 Spreadsheet-first
User has tried many trackers — always returns to Excel. **Excel wins because it's neutral**: own structure, own data, own workflow.

→ Tasks open in a **sortable, filterable, inline-editable table** by default. List/Board are alternative views.
→ **CSV/Excel export** is everywhere.
→ Two-way Google Sheets sync optional (Phase 10).
→ User can leave at any time with their data.

### 3.2 Omni-input (Lovable-style)
**One input bar handles all actions** — capture, log time, query, edit, command. AI dispatcher determines intent. No separate ⌘N / ⌘L / form-modals.

The omni-input is the **primary control of the entire app** — visually prominent, always visible at top of every screen.

```
"review acme NDA tomorrow"     → AI: create task    · Acme Series B · tomorrow 9am
"maria 12min EU stablecoin"    → AI: log timelog    · 12 min · SolanaPay subscription
"what's overdue?"              → AI: inline answer  · 1 overdue: T-0142 OFAC (20h late)
"show acme work this week"     → AI: filter table   · Acme · this week · 6 tasks
"move acme consent to friday"  → AI: edit task      · update T-0146 deadline
"send invoice for april acme"  → AI: command        · draft invoice €4,719
```

**Behavior decisions (locked):**
- Position: hybrid — thin top bar always visible, ⌘K expands to fullscreen for complex queries
- Style: smart-hybrid — simple actions = single-tap commit, queries/edits = conversational refine
- Intent signaling: text preview only ("→ create task: …"), no chip
- Query answers: combination — short facts inline, filter-queries apply to the table

### 3.3 AI = assistant, not dictator
AI parses voice/email/text into structured columns. **User can always override any cell.** No forced workflow. Confidence < 90% → AI shows uncertain field as italic and asks to confirm.

---

## 4 · DOMAIN MODEL

```
CLIENT (natural person)
  ├ companies: COMPANY[]              (legal entities owned by client)
  ├ industry: 'IT' | 'Crypto' | 'B2B-Trade' | 'Other'
  └ matters:   MATTER[]

COMPANY (legal entity, e.g. "Acme Tech US LLC", "SolanaPay Foundation Cyprus")
  ├ clientId
  └ jurisdiction: 'US-DE' | 'EE' | 'CY' | 'CH-ZG' | …

MATTER (= one piece of work for a client)
  ├ clientId, companyIds[]            // many-to-many with companies (default 1:1)
  ├ name, jurisdiction, status
  ├ billing.mode: 'subscription' | 'fixed' | 'hourly'
  │
  │ when subscription:                // billing-mode-specific fields
  │    period, period_fee, hours_included, overage_rate, auto_invoice
  │ when fixed:
  │    fixed_amount, deadline, milestones[]
  │ when hourly:
  │    hourly_rate
  │
  └ tasks: TASK[]

TASK
  ├ matterId? clientId?               // can be matterless or fully orphan
  ├ title, notes, deadline
  ├ priority: 'urgent' | 'high' | 'medium' | 'low'
  ├ status:   'todo' | 'in_progress' | 'done'
  ├ tags[], depends_on[], recurrence?
  └ timeLogs: TIMELOG[]

MEETING (first-class entity, syncs Google/iCloud)
  ├ matterId? clientId?
  ├ title, starts_at, ends_at, attendees, video_url
  ├ pre_task_minutes (auto-create prep task)
  └ auto_log_minutes (auto-log time after meeting)

TIMELOG
  ├ taskId, matterId, hours, billable, source
  └ invoiceId?                        // locked once invoiced

INVOICE (mixes 3 line types)
  ├ clientId, status: draft|sent|paid
  └ lines[]:
      type: subscription              ─ "April retainer · Acme · €1500"
      type: fixed_milestone           ─ "US LLC delivered 14.05 · €2400"
      type: hourly_bundle             ─ "April hours @ €150 · 6.5h · €975"
```

**Critical:** matters have 3 different billing.modes. Subscription / fixed / hourly all need DIFFERENT detail-screen layouts (scope-gauge, milestones-checklist, hours-accumulator).

---

## 5 · VISUAL SYSTEM (locked)

### 5.1 Colors — palette only, no improvisation

| Role | Token | Hex | Usage |
|---|---|---|---|
| Primary accent | `--accent` (plum) | `#6a1b9a` | Brand, active nav, AI mark, primary CTA hover, focus rings |
| Text/ink | `--ink` | `#0a0a0a` | Body text, secondary buttons, sidebar active fill |
| Background | `--bg` | `#ffffff` | Default surface |
| Bg-1 | `--bg-1` | `#fafafa` | Lifted zones, hover state |
| Vermillion (danger) | `--vermillion` | `#e63312` | OVERDUE, errors, P0 priority |
| Saffron | `--saffron` | `#f5b700` | DUE SOON, Research tag |
| Lime | `--lime` | `#c5f000` | Time tracker (running state) |
| Cobalt | `--cobalt` | `#1a3dd8` | MEETING, Corporate tag, info |
| Magenta | `--magenta` | `#ff2e93` | Personal tag |
| Cyan | `--cyan` | `#00e5ff` | Reserved |

**STATUS → COLOR mapping (locked, see STATUS-COLORS.md):**

| State | Color | Tint bg |
|---|---|---|
| OVERDUE | vermillion | `#fff1ee` |
| DUE SOON | saffron | `#fff8e0` |
| DOING | lime | `#f7ffd6` |
| MEETING | cobalt | `#ecefff` |
| DONE | ink + strikethrough | (no tint) |
| AI-touched | accent (plum) | (no tint) |

**Rules:**
- One color per state.
- Never two reds. Never "light overdue / dark overdue".
- Status badges = tint background.
- Tag badges = outline only, color comes from text.

### 5.2 Typography

```
--font-sans:  'Inter Tight', 'Helvetica Neue'    (display, headings)
--font-text:  'Inter'                            (body)
--font-mono:  'JetBrains Mono'                   (technical, numerals, IDs, dates)
```

**Headlines:** lowercase, sentence-case ("today, focused.", "your work."), Inter Tight 700–800, letter-spacing -0.02 to -0.04em.

**Mono caps** with letter-spacing 0.04–0.18em **only for**:
- Eyebrow labels (`VIEW 02 · TASKS · 8/37`)
- Status badges (`OVERDUE`, `DUE SOON`)
- IDs (`T-0142`)
- Dates/times in tables

**Body:** sentence-case, Inter regular/medium, 13–15px.

### 5.3 Layout

- **3-column shell:** sidebar 240px | main flex | AI rail 56px (collapsed) / 360px (expanded)
- **Sharp corners** everywhere. `border-radius: 0` is the default.
- **Hairline rules** (1px line) for separators. `var(--rule-thick)` (2px ink) for major boundaries.
- **No shadows** except: drop-shadow under elevated zones (omni-bar, modals).
- **Editorial Neo-Swiss feel** — but tempered for daily use (no oversized numerals, no rotated mono labels, no aggressive editorial gimmicks).

### 5.4 Anti-patterns (DO NOT)

- ❌ Notion-style soft rounded cards
- ❌ Glass / backdrop-blur
- ❌ Claude's terracotta colors
- ❌ Excessive mono caps everywhere
- ❌ Neon / fluoro colors as primary
- ❌ Heavy drop-shadows / glows
- ❌ Multiple stacked horizontal toolbars (more than 2 fight for attention)
- ❌ Filled background tints on every state — quiet outlines preferred

---

## 6 · ALREADY DESIGNED (don't re-design unless asked)

```
hifi-02-today.html       Today view — ON FIRE band + time-blocks + task rows + AI footer
                          (status colours, 3 levels of urgency)

hifi-04-tasks-table.html  Tasks table v2 — sortable columns, sentence-case headers,
                          status as left-rule (no separate ON FIRE band),
                          floating bulk-bar, single toolbar

hifi-05-omni-input.html   Omni-input concept — lifted bg-1 bar with plum glyph,
                          17px input, mic button, ⌘K kbd, text-only preview
                          slide-down. 5 intent variants in catalogue.

hifi-06-integrated.html   Integrated main screen — combines omni-bar + secondary
                          toolbar (filters · view-toggle · CSV) + Tasks table
```

These are the lock for visual consistency. Match the look-and-feel exactly.

---

## 7 · SCREENS TO DESIGN (deliverables)

For each screen below: produce a self-contained HTML file matching the visual system. Show one realistic state with seeded data (international lawyer, 4 clients: Acme Tech IT, SolanaPay Crypto, Maersk-flag B2B, Vasylenko private).

### 7.1 Calendar view (`hifi-07-calendar.html`)

**Purpose:** graphical view of tasks + meetings on a month grid.

Must include:
- Top: omni-bar (same as hifi-06) + secondary toolbar (filter, view-toggle [Month/Week/Day], CSV)
- Month grid 7 columns × 5–6 rows (Mon-first ISO week)
- Each day cell: day-number top-left, dots for items
  - Vermillion dot — overdue task with deadline that day
  - Saffron dot — due-soon task
  - Cobalt dot — meeting
  - Plum dot — AI-suggested
- Today's cell: ink-fill bg, white number
- Click day → bottom panel with that day's task list + meetings
- Week toggle: hours grid 09:00–19:00 with meetings as positioned blocks
- Day toggle: full hour-by-hour timeline

### 7.2 Time tracker view (`hifi-08-time.html`)

**Purpose:** timer + log + week chart + timesheet (4 features in 1 view).

Must include:
- Top: omni-bar + secondary toolbar
- **Running tracker block** (lime bg) — only when timer is active. Big mono clock 56-96px, vermillion pulse dot, "QUICKBOOKS · MATTER · BILLABLE" mono-caps label, Pause/Stop controls
- **Today's log** (ink-headed list) — mono time entries: `09:45 → 02:47 · Drafting · Acme · BILL`
- **Week bar-chart** — 7 columns Mon-Sun, today highlighted vermillion, hours as bar height
- **Capture-strip** (4-col) — `WEEK BILL 28:42 · RATE €85/h · PROJECTED €2,439 · VS LAST +12%`
- **Timesheet** (matrix matter × day) — sortable, weekly nav, CSV export

### 7.3 Invoices — list (`hifi-09-invoices-list.html`)

**Purpose:** list of all invoices with status filters.

Must include:
- Top: omni-bar + secondary toolbar with filter pills (All / Draft / Sent / Paid / Overdue) + view-toggle
- Each invoice = card with: number (`inv·042`), client, amount, status dot (draft=ink / sent=cobalt / paid=lime / overdue=vermillion), issued date, due date
- "+ New invoice" via omni-bar ("send invoice for april acme")

### 7.4 Invoice document (`hifi-10-invoice-document.html`)

**Purpose:** editorial single-invoice view (PDF-like).

Must include:
- Hero number `inv·042` 64px Inter Tight 800, plum digit suffix
- meta-grid 2×2: ISSUED · DUE · CURRENCY · STATUS
- FROM / BILL TO 2-column block
- Lines table — DESCRIPTION · HOURS · RATE · AMOUNT (ink-headed `<th>`)
- Mixed line types visible: subscription line (no hours/rate), fixed-milestone line, hourly-bundle line
- Total: subtotal + VAT + grand-amount in **plum block** (right side, 56px Inter Tight)
- Action bar (ink): AI-mark `generated from N entries` + Edit / PDF / Send

### 7.5 Matter detail — 3 variants (subscription, fixed, hourly)

Three separate files: `hifi-11-matter-sub.html`, `hifi-11-matter-fix.html`, `hifi-11-matter-hourly.html`.

Each shares:
- Top: omni-bar
- Hero: client name → matter name + status pill + billing-mode badge
- Tasks list (table-mode by default)
- Sidebar drilled state — current client active

Each differs:
- **Subscription:** scope-gauge (used / included with progress bar), period-fee, scope-warning banner if >80%, period history timeline
- **Fixed:** milestones checklist (with deadlines), deadline-countdown (days/hours), fixed-amount, "milestones delivered" stat
- **Hourly:** hourly-rate, accumulated billable-hours, "Pending invoice" amount, list of unbilled timelogs

### 7.6 Client detail (`hifi-12-client.html`)

**Purpose:** single client deep-dive.

Must include:
- Top: omni-bar
- Hero: client name + industry badge + contact (email/telegram)
- Stats strip: active matters · open tasks · scope used · projected revenue
- Companies list (legal entities owned by this client)
- Matters list (table or cards) — with billing-mode badges
- Recent activity (timelogs + meetings) timeline
- Notes free-form area

### 7.7 Settings (`hifi-13-settings.html`)

**Purpose:** all configuration in one place.

Sections:
- Anthropic API key (encrypted storage)
- Claude model picker (haiku/sonnet/opus)
- Encryption (passphrase setup)
- Google Sheets sync (OAuth)
- Theme (light/dark)
- Language (EN/UK/ES)
- Currency, VAT %, identity (used in invoice FROM block)
- Custom fields (Phase 2 placeholder)

---

## 8 · LAYOUT GRAMMAR (use consistently across all screens)

```
[OMNI-BAR — bg-1, 18px padding, ink glyph, plum focus]
[SECONDARY TOOLBAR — title-block + filter-pills + view-toggle + actions]
[MAIN CONTENT — table OR custom layout]
[FLOATING BULK-BAR — appears on selection, bottom-center]

Sidebar always visible (240px).
AI rail collapsed strip on right (56px, expandable to 360px).
```

For non-table views (calendar, invoice document, settings) — same omni-bar + toolbar shell, but main content is whatever the view demands.

---

## 9 · ICONS

Use inline SVG icons (no icon font). Stroke-based, 1.8 stroke-width, currentColor. 14–16px size.

Common icons used:
- ☀ ☾ — light/dark theme
- ✕ — close
- ⏎ — enter
- ⌘K · ⌘N · ⌘L — keyboard hints
- → — arrow (in preview)
- ▤ ⊞ ▦ — list / board / table view-toggles
- ⊕ + — add
- 🎤 — voice (use SVG, not emoji)
- ↓ ↑ — sort arrows
- ⏱ ⚠ — time / alarm

---

## 10 · WHAT GOOD LOOKS LIKE

- **Calm.** Reading should feel restful. The user is a lawyer with 30 active matters — they need clarity, not stimulation.
- **Editorial Neo-Swiss** — tempered. Sharp corners, hairlines, mono numerics, lowercase headlines. NOT an aggressive Swiss-poster.
- **Information density without noise** — many fields visible, but each visually low-weight unless active.
- **Status colors are functional** — vermillion = "you actually need to act", saffron = "soon", cobalt = "scheduled". Never decorative.
- **One primary action per screen** — usually the omni-bar. Secondary actions are quiet.

---

## 11 · DELIVERABLE FORMAT

For each screen:
1. Standalone HTML file
2. Inline `<style>` for view-specific styles, link to shared `tokens.css` and `styles.css`
3. Realistic seeded data (use the 4 clients above, 10–15 tasks, 2 meetings, 1–2 invoices)
4. Single state per file (don't show "active vs inactive" in same screen)
5. Annotation block at bottom (gets removed in production) explaining the 3-zone structure

Use the established pattern from `hifi-04-tasks-table.html` and `hifi-06-integrated.html`.

---

## 12 · PRIORITY ORDER

If time-bound, tackle in this order:

1. **hifi-08 Time tracker** — most feature-rich, most distinct visual treatment (lime block)
2. **hifi-10 Invoice document** — editorial pinnacle, plum AMOUNT DUE block
3. **hifi-11 Matter-subscription** — daily-use detail, scope gauge
4. **hifi-07 Calendar** — different paradigm (grid not list)
5. **hifi-09 Invoices list** — straightforward
6. **hifi-11 Matter-fixed**, **hifi-11 Matter-hourly** — variants of 11-sub
7. **hifi-12 Client detail** — uses all the above patterns
8. **hifi-13 Settings** — least visual, most form-heavy

---

## 13 · QUESTIONS WELCOME

If anything is ambiguous — ask before designing. Bad assumptions cost more than questions. Don't invent new visual patterns; lean on what's locked in §5.
