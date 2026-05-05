# ordify.me — Specification (v2)

**Status:** scaffold
**Owner:** Сергій (international lawyer — UA, crypto/corporate/compliance)
**Stack:** vanilla JS SPA, no build step, static hosting (Netlify)
**Design language:** Neo-Swiss / Editorial Engineering — sourced 1:1 from `_design/project/` (white + ink + vermillion, sharp corners, Inter Tight + JetBrains Mono, editorial numbering)

---

## 1. Identity

**ordify.me** — AI-first task & matter manager for an international lawyer.

Brand wordmark: lowercase Inter Tight 800 — `ordif` + vermillion `y` + `.me` in mono caps.

Tone: direct, lowercase, imperative. Never apologises — adjusts.

---

## 2. User & jobs-to-be-done

The user is a Ukrainian lawyer running international practice (crypto, corporate, compliance). Daily workload:

- Receives 30–60 fragmented inputs/day: emails, calls, meetings, voice notes
- Must turn them into clean, hierarchical tasks tied to clients/matters
- Tracks billable time across many matters
- Issues invoices in EUR/USD (multi-currency)
- Has procedural deadlines (court, registrar, etc.) that are irreversible if missed
- Works in EN + UK
- Must comply with confidentiality — encryption at rest, no telemetry, no third-party ingest of client data

Key jobs:

1. **Capture fast.** Type or speak a sentence in any language; AI sorts it into client / matter / task with deadline + priority + tags.
2. **See today.** Open laptop → see "today, focused." view: morning/afternoon split, overdue at top, AI suggestions inline.
3. **Stop missing procedural deadlines.** Procedural = special badge, top of dashboard, calendar warnings.
4. **Track time without friction.** One-click timer per task; manual entries with billable toggle; weekly timesheet.
5. **Invoice in 30 sec.** Pick matter → pick range → AI rolls billable logs into editorial invoice → mark sent.
6. **Talk to ordify.** Right-rail AI panel (≥1400px) for "what should I do?" / "draft this" / "summarize matter X".

---

## 3. Domain model

```
Client  (person)
  ├─ companies: string[]              (legal entities owned/represented)
  ├─ email, telegram, notes
  └─ matters: Matter[]

Matter  (= project)                   (mapped to internal Store key `projects`)
  ├─ clientId
  ├─ company                          (which legal entity, if any)
  ├─ name, projectType, jurisdiction
  ├─ status: active | on_hold | completed
  ├─ deadline                         (matter-level)
  ├─ billing: { mode: 'hourly'|'fixed', rate?, fixedAmount?, currency }
  └─ tasks: Task[]

Task
  ├─ projectId? | clientId?           (or unassigned = inbox)
  ├─ title, notes
  ├─ priority: urgent | high | medium | low
  ├─ deadline (ISO date)
  ├─ isProcedural: boolean            (procedural-deadline marker)
  ├─ status: todo | in_progress | done
  ├─ tags: tagId[]
  ├─ recurrence?: { freq, interval, days?, until? }
  ├─ dependsOn: taskId[]              (blockers)
  ├─ subtasks: Task[]
  ├─ hoursLogged                      (rolled-up from timeLogs)
  └─ timeLogs: TimeLog[]

TimeLog
  ├─ taskId
  ├─ date, hours, description
  ├─ billable: boolean                (default: true)
  └─ invoiceId?                       (locked once invoiced)

Invoice
  ├─ number                           (INV-YYYY-NNNN, scoped per year)
  ├─ matterId
  ├─ logIds: timeLogId[]
  ├─ rate, currency, vatPct, amount
  ├─ status: draft | sent | paid
  ├─ issuedAt, dueAt
  └─ from, billTo                     (snapshot at issue time)

Tag
  └─ id, name, color
```

---

## 4. Core flows

### 4.1 Quick capture

Compact bar at top of every view (or `⌘N` opens centered window).

- Single text input + mic button + Enter.
- On submit: send to Claude API with system prompt embedding compact project context (clients/matters by name); model returns one of:
  - `create_task`
  - `create_project` (matter)
  - `create_client`
  - `log_hours`
  - `create_chain` — array of above (most common for meetings / multi-task input)
- Result rendered as **AI Preview modal** with editable items: change action type, rename, pick existing entity vs create-new, exclude items, save → execute.
- Preview shows fuzzy-match candidates for ambiguous references (e.g. "Acme" → 3 candidates with confidence scores).

### 4.2 Today view (P.01 SHELL pattern)

Default landing. Three columns on ≥1400px: sidebar | task list | AI rail. On narrower screens: sidebar + task list (AI accessible via keystroke).

Task list structure:
- Hero header: eyebrow `VIEW 02 · TODAY` + lowercase headline `today, focused.` + status pill `N ACTIVE` + List/Board/Filter/+New buttons.
- Time-block dividers: `MORNING · 04` (`09:00 — 12:00`), `AFTERNOON · 04` (`13:00 — 19:00`), `OVERDUE · N` (red, top), `LATER`.
- Each task as `.task-row`: `idx | × checkbox | title (+ meta line) | priority pill | tag | AI▸ | due` — actions on hover.
- AI footer (ink bg): `AI ▸ Defer 2 low-priority tasks to Wednesday?` + Apply / Dismiss.

### 4.3 Capture view (X.01 CAPTURE pattern)

**Surface: linen** — cream paper (`#f5f0e6`) with dark-brown ink (`#2a2520`) and **plum marks**. Chosen 2026-04-29 over saffron-sticky for daily-use comfort. See `capture-options.html` for the full rationale (option C).

- Linen pad on left (or full-width on narrow): raw note with `<mark>actionable phrases</mark>` rendered as plum-fill on white text.
- Capture-strip below: `CAPTURED 14 · PARSED 11 · QUEUED 03 · SOURCE VOICE·KEY·MAIL`.
- Right column: AI-suggested tasks with `N-014a/b/c` indices.
- "Convert to tasks" CTA commits.

### 4.4 Brief generator (X.02 BRIEF pattern)

Split panel — raw notes (left, paper-bg, with `<mark>` highlights and `<s>strikethroughs</s>`) → reformulated brief (right, ink-bg with massive `AI` letterform watermark).

Brief output: title + scope + feel + constraint + success + owners. Accept / Refine / Export PDF.

### 4.5 Time tracker (X.03 TIME pattern)

Two halves:
- **Lime tracker-now** — pulse + `RUNNING · STARTED 09:45` + `02:47:14` clock + "Q3 PROPOSAL · BILLABLE — Drafting product narrative" + Pause / Stop / +.
- **Ink-headed log** — `TODAY · 28.04.26` head + entries `09:45 → · description · 02:47` (vermillion if billable).

Below: 7-day bar-chart (today = vermillion bar) + capture-strip with `WEEK BILL 28:42 · RATE €85/h · PROJECTED €2,439 · VS LAST +12%`.

### 4.6 Invoice (X.04 INVOICE pattern)

Editorial document:
- Head: `inv·042` (vermillion accented suffix) + meta-grid (ISSUED / DUE / CURRENCY / STATUS).
- Parties: FROM / BILL TO with role/name/addr blocks.
- Table: DESCRIPTION · HOURS · RATE · AMOUNT (ink-bg `<th>`).
- Total: subtotal + VAT % + grand-amount in vermillion block.
- Actions ink bar: AI-mark `generated from N entries` + Edit / PDF / Send.

Generation: pick matter → pick range → confirms → status `draft` → can `mark sent` → can `mark paid`. Logs lock on `addInvoice`, unlock on `deleteInvoice`.

### 4.7 AI right rail

Visible on screens ≥ 1400px. Collapsible (preference persisted).

Header: ink bg, vermillion `o` glyph, `ordify · today`.
Body: bubbles (assistant left, user right) + chip suggestions row + thinking-dots when busy.
Input: `Ask ordify…` + `⏎` kbd hint.

Same model as quick-capture but conversational; can answer "what's overdue?" / "summarize matter Acme" / "draft an email to Sam".

---

## 5. Navigation

Sidebar (260px) with `proj`-pattern numbered rows + swatch dots:

```
01  Capture
02  Today                ← default
03  Tasks (inbox)
04  Calendar
05  Matters
06  Time
07  Invoices
─── CLIENTS · N ─────
08  Acme Ltd · 4
09    └ NDA Q3 · 8
10  Northwind Co · 2
…
```

Active row: ink-fill, bg becomes ink, text becomes white.

Bottom: settings · tags · theme toggle (sun/moon) · language (EN/UA).

---

## 6. Architecture

Single-page, no build, no framework.

```
taskmanager-v2/
├── index.html              # shell, loads tokens.css + styles.css + JS modules
├── css/
│   ├── tokens.css          # design tokens (colors, type, spacing, radius=0)
│   └── styles.css          # all components (proj, task-row, ai-panel, invoice…)
├── js/
│   ├── icons.js            # inline-SVG icon set
│   ├── dom.js              # esc, safeColor, etc.
│   ├── dates.js            # local-time date helpers (DST-safe)
│   ├── recurrence.js       # next-occurrence calc
│   ├── crypto.js           # WebCrypto wrappers
│   ├── i18n.js             # EN + UK strings
│   ├── store.js            # localStorage CRUD + encryption + invoice logic
│   ├── ai.js               # Claude API wrapper with prompt caching
│   ├── sheets.js           # Google Sheets sync (optional)
│   └── app.js              # views, render, event wiring
└── SPEC.md                 # this doc
```

JS modules are loaded as separate `<script>` tags in dependency order — no bundler, no transpile.

### Storage

`localStorage['ordify-data']` — JSON blob containing `{ clients, projects, tasks, timeLogs, invoices, tags, settings }`.

Optional encryption: AES-GCM via WebCrypto, key derived from passphrase via PBKDF2 (200k iter); ciphertext stored same key. Passphrase prompted at boot.

Optional sync: Google Sheets via OAuth2 PKCE; one row per entity, sheet-per-type; bidirectional with last-write-wins on `updated`.

### AI

`js/ai.js` exports `aiCapture(text, mode)` and `aiAsk(message, history)`.

System prompt is **prompt-cached** (Anthropic prompt caching ≥ 1024 tokens):

```
Block 1 (cacheable, ~stable):
  - Role + tone instructions
  - Output schema (create_task / create_chain / etc.)
  - Few-shot examples
  - Format rules

Block 2 (cacheable, regenerated when project graph changes):
  - Compact list of clients (id + name + companies)
  - Compact list of matters (id + name + clientId + jurisdiction)
  - Compact list of tags

Block 3 (per-message, never cached):
  - User input
  - Current view context (which matter is open, etc.)
```

Cache hit refreshes on every send when client/matter list hasn't changed; full re-send only when graph mutated.

Model: default `claude-sonnet-4-5`, switchable in Settings to `claude-haiku-*` (cheaper) or `claude-opus-*` (better).

---

## 7. Privacy & security

- All data stays local by default; no telemetry, no analytics.
- Optional at-rest encryption — passphrase never leaves device.
- Optional Google Sheets sync — OAuth scope minimal (single sheet); user-controlled.
- AI calls go to Anthropic API directly with user's own API key (stored encrypted in localStorage).
- No third-party ingest of client names without user click.

---

## 8. Internationalisation

Two languages: **EN** + **UK**. Toggle in sidebar footer.

All UI strings keyed in `i18n.js`; AI is language-agnostic (replies in same language as input). Months / weekdays use `Intl.DateTimeFormat` with locale.

---

## 9. Theme

Light (default) + Dark, both Neo-Swiss. Token-driven.

Light: `--bg #fff` `--text #0a0a0a` `--accent #e63312`
Dark:  `--bg #0a0a0a` `--text #fafafa` `--accent #ff5a3a`

Toggle in sidebar footer; persisted to localStorage.

---

## 10. Build phases

| Phase | Scope | Status |
|-------|-------|--------|
| **0 — Scaffold** | empty index.html + tokens + styles + app boot, sidebar with numbered nav, brand | ← starting now |
| **1 — Today view** | task-row pattern, time-block dividers, hero header, AI footer | next |
| **2 — Capture + AI preview** | quick-capture bar + chain-mode preview modal | |
| **3 — Inbox / Tasks** | inbox view with filters | |
| **4 — Matters + single Matter view** | matters list + matter detail with kanban toggle | |
| **5 — Calendar** | full calendar (.cal grid) with deadlines | |
| **6 — Time tracker** | running clock + log + bar chart + manual entry | |
| **7 — Reports / timesheet** | weekly grid by matter + CSV export | |
| **8 — Invoices** | generate from unbilled time + editorial document + lifecycle (draft → sent → paid) | |
| **9 — AI right rail** | conversational ordify panel | |
| **10 — Settings** | API key, encryption, sync, theme, language | |
| **11 — Brief generator** | raw → formulated split (X.02) | |
| **12 — Polish** | empty states, mobile, accessibility, voice input, recurring tasks, dependencies | |

Each phase is shippable on its own.

---

## 11. Migration from v1

Old `taskmanager/` keeps running independently. Once v2 is at parity, point Netlify subtree at `taskmanager-v2/`.

Data import from v1: if v1 localStorage exists on same origin, on first boot v2 offers "Import 47 clients / 132 matters / 891 tasks from previous version → ✓". One-shot migration; no continuous sync between v1 and v2.
