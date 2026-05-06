# ordify.me — Functional & Element Inventory (v2 · 2026-04-29)

Updated to match locked DOMAIN.md (no engagement layer · matter has `billing.mode` · meetings first-class · log-call quick pattern · 3-mode invoices · companies as separate entity).

---

## 1. Functions (what the user does)

### 1.1 Capture (J-01 — top priority)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-01 | Type a single sentence describing a task / event / call | text input | AI-parsed structured action(s) |
| F-02 | Speak via mic | press-to-talk | transcription → F-01 |
| F-03 | Paste long meeting transcript / mail / call notes | textarea + paste | multiple AI-parsed actions |
| F-04 | Review AI's parse before commit | preview modal | accept / edit / reject |
| F-05 | Edit any field of a parsed action (action type, name, parent ref, deadline, priority, tags, billing-mode-of-new-matter) | inline form | updated parse |
| F-06 | Pick existing entity vs create-new (when AI is ambiguous about client / matter / company) | dropdown of fuzzy matches | resolved reference |
| F-07 | Exclude individual items from a chain before commit | per-row checkbox | reduced commit set |
| F-08 | Commit accepted items to store | "Accept" button | tasks/clients/matters/companies created |
| F-09 | AI infers industry from client name / context (auto-tag IT/Crypto/B2B-Trade) | parse | client.industry pre-filled |

### 1.2 Today / Inbox / Tasks (J-02 — morning triage)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-10 | View "ON FIRE" band first (overdue + procedural + meetings-in-next-2h) | nav `02 Today` | top of view |
| F-11 | View today's full schedule below the "ON FIRE" band | scroll down | grouped list |
| F-12 | View all open tasks across matters | nav `03 Tasks` | filterable list |
| F-13 | Filter (today / week / overdue / unassigned / by tag / by matter / by client / by industry / by billing-mode) | filter chips | filtered list |
| F-14 | Cycle task status (todo → doing → done → todo) | click checkbox | status change |
| F-15 | Open task editor (modal) | click title or pencil | editor |
| F-16 | Edit task fields (title, notes, priority, deadline, tags, recurrence, dependsOn, parent) | form | updated task |
| F-17 | Add subtasks | + within editor | child tasks |
| F-18 | Delete task | trash + confirm | removed |
| F-19 | (computed) `due_soon` = deadline within 24h, not done | auto | vermillion DUE SOON badge wherever the task renders |
| F-20 | Set recurrence | recurrence picker | next occurrence auto-generated |
| F-21 | Set blockers (dependsOn) | add-blocker picker | blocked indicator on row |
| F-22 | Reorder tasks within a group | drag handle | persisted order |
| F-23 | Bulk-defer P3 tasks per AI suggestion | AI footer | mass deadline shift |

### 1.3 Time tracking (J-03 — biggest $ leak)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-30 | Start timer on a task | play icon on row | running timer (one-at-a-time) |
| F-31 | Pause / stop timer | tracker controls | log entry |
| F-32 | Log time manually on a task | "Add hours" form on task | log entry |
| F-33 | **QUICK-LOG-CALL** — global keystroke `⌘L` | anywhere | tiny popover: client picker · 1-line description · duration (auto-suggest) · "log" |
| F-34 | Mark log billable / non-billable | switch on log row | flag |
| F-35 | View today's log | nav `06 Time` | running + entries |
| F-36 | View weekly timesheet (matters × days) | "Week" toggle | grid |
| F-37 | Navigate weeks (prev / next / today) | arrows | re-rendered grid |
| F-38 | Export timesheet CSV | button | download |

### 1.4 Matters / Clients / Companies
| # | Function | Trigger | Output |
|---|---|---|---|
| F-40 | View all matters across all clients | nav `05 Matters` | grid / list |
| F-41 | Filter matters by status (active / on-hold / completed) and by billing-mode (subscription / fixed / hourly) | filter chips | filtered |
| F-42 | Open matter detail | click matter row | detail page (varies by billing-mode) |
| F-43 | View matter info — common: client, companies (multi), jurisdiction, industry, status, deadline | matter detail header | data block |
| F-44 | View matter tasks (open + done) | matter detail | task list |
| F-45 | Toggle matter view: list ↔ kanban | toggle | re-laid-out tasks |
| F-46 | Edit matter (name, status, jurisdiction, billing.mode, billing-mode-specific fields, attached companies, deadline) | pencil | updated |
| F-47 | Add matter to client | + in client detail | new matter wizard (pick mode) |
| F-48 | Open client detail | sidebar click on client | client view |
| F-49 | View client info (name, email, telegram, industry, primary currency, notes, companies, matters, recent meetings) | client header | data block |
| F-50 | Edit client | pencil | updated |
| F-51 | Manage client's companies — add / edit / dissolve | + in client view | company entity created/updated |
| F-52 | Attach companies to a matter (multi-select from client's companies) | matter editor | matter.companyIds updated |
| F-53 | View company detail (registration, jurisdiction, VAT, related matters) | click company chip | company drawer |
| F-54 | Delete client / matter / company (cascade-confirms) | trash | confirm modal → delete |
| F-55 | Free-form note on client (history, prefs, key contacts) | client detail | note created |

### 1.5 Subscription-mode matters (NEW)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-60 | Set subscription parameters (period, period_fee, hours_included, overage_rate, auto_invoice) | matter editor when mode='subscription' | subscription config |
| F-61 | View scope-used vs scope-budget gauge for subscription | matter detail | progress bar (e.g. "7.2h / 10h · 72%") |
| F-62 | Get notified when 80% scope used | auto | banner on matter + AI rail nudge |
| F-63 | Auto-invoice on period end (if enabled) | scheduled | draft invoice created |
| F-64 | View subscription history (which periods invoiced, paid, scope used per period) | matter detail tab | timeline |

### 1.6 Fixed-price-mode matters (NEW)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-70 | Set fixed amount + delivery deadline | matter editor when mode='fixed' | matter.billing.fixed_amount, deadline |
| F-71 | Add milestones (name, due date, partial amount, status) | matter editor | matter.billing.milestones[] |
| F-72 | Mark milestone delivered | checkbox on milestone | milestone.status = 'done', triggers invoice line eligibility |
| F-73 | View deadline countdown (days/hours till delivery) | matter detail | live countdown |
| F-74 | View milestone progress (3/5 done) | matter detail | checklist |

### 1.7 Hourly-mode matters
| # | Function | Trigger | Output |
|---|---|---|---|
| F-80 | Set hourly rate | matter editor when mode='hourly' | matter.billing.hourly_rate |
| F-81 | View accumulated billable hours not yet invoiced | matter detail | "23.5h pending invoice" |

### 1.8 Meetings (NEW — first-class)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-90 | Connect Google Calendar (OAuth) | settings → calendar | tokens stored |
| F-91 | Connect iCloud Calendar (CalDAV credentials) | settings → calendar | tokens stored |
| F-92 | Pull meetings from external calendar (background sync) | scheduled | meetings imported |
| F-93 | Create meeting in ordify (push to external) | + in calendar / matter | meeting + external event |
| F-94 | Edit meeting (title, time, attendees, location, video URL, attached matter, attached client) | meeting editor | updated both sides |
| F-95 | Attach a meeting to a matter | dropdown in meeting editor | meeting.matterId |
| F-96 | Auto-create "prep" task X minutes before meeting | meeting setting | task generated |
| F-97 | Auto-log meeting duration as timelog after end | meeting setting | timelog created (source='meeting') |
| F-98 | View meetings on calendar grid | nav `04 Calendar` | day/week/month |
| F-99 | View today's meetings on Today view | always | meetings interleaved with tasks |
| F-100 | Resolve calendar conflicts (last-write-wins by default, manual on collision) | sync engine | reconciled state |

### 1.9 Calendar
| # | Function | Trigger | Output |
|---|---|---|---|
| F-110 | View month grid with deadline-dots + meeting-dots | nav `04 Calendar` | calendar grid |
| F-111 | Click a day to filter its tasks + meetings | day cell | day detail |
| F-112 | Navigate months/weeks | arrows / picker | re-render |
| F-113 | Procedural deadlines highlighted differently | - | vermillion privileged rendering |
| F-114 | Toggle between month / week / day views | view toggle | re-laid-out |

### 1.10 Invoices (3-mode mixing — REVISED)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-120 | View list of invoices | nav `07 Invoices` | list |
| F-121 | Filter invoices by status (draft / sent / paid) and by client | chips | filtered |
| F-122 | Generate invoice for a client and period | "+ New invoice" | wizard: pick client → pick period |
| F-123 | Wizard pre-fills lines automatically: subscription period fee + delivered fixed-milestones + unbilled hourly logs (all for that client, that period) | wizard step 2 | mixed line list |
| F-124 | Add / remove / edit individual invoice lines | wizard | curated lines |
| F-125 | Apply VAT and currency | wizard | totals computed |
| F-126 | Save as draft | wizard final | invoice created with status='draft', logs locked |
| F-127 | View invoice document (FROM/BILL TO/lines/AMOUNT DUE) | click invoice | editorial document view |
| F-128 | Edit invoice (rate, vat%, lines) — only while draft | edit button | updated |
| F-129 | Mark sent | dropdown | status='sent' + sentAt |
| F-130 | Mark paid | dropdown | status='paid' + paidAt |
| F-131 | Delete invoice (drafts only) | trash + confirm | unlocks logs |
| F-132 | Export invoice as PDF | PDF button | download |
| F-133 | Send invoice (mailto: prefilled with PDF) | Send button | email composed |

### 1.11 AI conversation (right rail)
| # | Function | Trigger | Output |
|---|---|---|---|
| F-140 | Ask ordify open question | input + Enter | response bubble |
| F-141 | Click suggestion chip | chip | pre-filled message |
| F-142 | Reset conversation | menu | empty body |
| F-143 | Hide / show rail | × button / settings | persisted preference |
| F-144 | "Thinking" indicator while waiting | - | dots |
| F-145 | Morning briefing on first open of day | auto | bubble: counts, overdue, procedural, meetings |

### 1.12 Tags
| # | Function | Trigger | Output |
|---|---|---|---|
| F-150 | View all tags | settings → tags | list |
| F-151 | Add custom tag (name + color from palette) | + button | new tag |
| F-152 | Rename / recolor tag | pencil | updated everywhere |
| F-153 | Delete tag | trash | removed from all tasks |
| F-154 | System industry tags (IT / Crypto / B2B-Trade) — auto-inherited from client.industry, can override per matter | auto | tag applied |

### 1.13 Settings & system
| # | Function | Trigger | Output |
|---|---|---|---|
| F-160 | Set Anthropic API key | settings → AI | encrypted in localStorage |
| F-161 | Pick Claude model (haiku/sonnet/opus) | settings | persisted |
| F-162 | Enable at-rest encryption (passphrase) | settings → security | data re-saved encrypted |
| F-163 | Connect Google Sheets sync (OAuth) | settings → sync | linked sheet |
| F-164 | Manual upload / download via Sheets | settings buttons | sync run |
| F-165 | Toggle theme (light/dark) | sidebar footer | persisted |
| F-166 | Toggle language (EN/UK/ES) | sidebar footer | persisted |
| F-167 | Import data from v1 (one-time) | first-boot prompt | clients/matters/tasks migrated |
| F-168 | Search across clients / matters / tasks / companies / meetings | top search bar `⌘K` | results dropdown |
| F-169 | Configure currency, VAT, address (used in invoice FROM block) | settings → identity | snapshot for invoices |

---

## 2. Elements (atoms that render the functions)

### 2.1 Inputs
| ID | Element | Purpose |
|---|---|---|
| E-01 | Text input | name, search |
| E-02 | Textarea | notes, capture body, transcript paste |
| E-03 | Select / dropdown | priority, status, tag colour, model picker, billing-mode |
| E-04 | Date picker | deadline |
| E-05 | Time picker | meeting time, manual log |
| E-06 | Number input | hours, rate, fee, vat % |
| E-07 | Checkbox | task-status cycle, milestone done, include/exclude |
| E-08 | Switch | billable, procedural, encryption-on, auto-invoice |
| E-09 | Radio group | recurrence frequency, billing-mode picker |
| E-10 | Mic / press-to-talk | voice capture |
| E-11 | Drag handle | reorder |
| E-12 | Multi-select chip-picker | matter.companyIds, attendees |
| E-13 | Currency picker | invoice / matter currency |

### 2.2 Buttons
| ID | Element | Purpose |
|---|---|---|
| E-20 | Primary CTA | Capture, Send, Apply |
| E-21 | Accent CTA | Generate invoice, Confirm AI |
| E-22 | Secondary | Cancel, Edit, Filter |
| E-23 | Ghost / icon-only | trash, edit, play, more-menu |
| E-24 | Toggle group | theme, language, list/board, day/week/month |
| E-25 | Filter chip | today/week/overdue, status filters, billing-mode filters, industry filters |

### 2.3 Pills / badges
| ID | Element | Purpose |
|---|---|---|
| E-30 | Priority pill (P0/P1/P2/P3) | task priority |
| E-31 | Tag pill (with dot) | domain (Corporate/Crypto/Compliance/Contracts/Personal) |
| E-32 | Status pill (todo/doing/review/done/overdue) | task status |
| E-33 | DUE SOON badge | computed when deadline < 24h (vermillion outline); OVERDUE badge (vermillion solid) when past |
| E-34 | Billable / non-billable indicator | on time logs |
| E-35 | Invoice status dot (draft/sent/paid) | invoice list |
| E-36 | AI mark `AI ▸` | AI-suggested or AI-touched |
| E-37 | Industry tag (IT / Crypto / B2B-Trade) | system tag, auto from client |
| E-38 | Billing-mode badge (SUB / FIX / HRLY) | matter list/cards |

### 2.4 Data blocks
| ID | Element | Purpose |
|---|---|---|
| E-40 | Task row (idx · checkbox · title · meta · pills · due · actions) | list views |
| E-41 | Task card | kanban |
| E-42 | Matter card / row | matters list, client detail |
| E-43 | Client row in sidebar (num · industry-swatch · name · count) | sidebar |
| E-44 | Time log entry (time · what · meta · duration · billable) | tracker log |
| E-45 | Invoice card (in list — number · client · status · amount) | invoices list |
| E-46 | Invoice document (head · parties · multi-type lines · totals · actions) | invoice detail |
| E-47 | Stat card (label · value · delta) | dashboard / briefing |
| E-48 | Calendar day cell (number · task-dot · meeting-dot · today-fill · procedural-dot) | calendar |
| E-49 | Capture pad (linen surface with marks) | capture view |
| E-50 | Tracker-now block (lime, when running) | time view |
| E-51 | Brief output panel | brief generator (deferred) |
| E-52 | AI bubble (assistant / user / chip row / thinking dots) | AI rail |
| E-53 | **Subscription scope gauge** (used h / budget h with progress bar) | subscription matter detail |
| E-54 | **Milestone checklist row** (name · due · amount · status) | fixed matter detail |
| E-55 | **Deadline countdown** (days/hours/min remaining, vermillion if <24h) | fixed matter detail |
| E-56 | **Meeting card** (date · time · attendees · video link · matter chip) | calendar, today |
| E-57 | **Quick-log-call popover** (client picker · 1-liner · duration · log btn) | global `⌘L` |
| E-58 | **Company chip** (name · jurisdiction · type) | matter editor, client view |
| E-59 | **Multi-line invoice line block** (subscription / fixed / hourly variants) | invoice document |

### 2.5 Structural / containers
| ID | Element | Purpose |
|---|---|---|
| E-60 | Hero head (eyebrow · lowercase headline · actions) | every view top |
| E-61 | Section head (`80px num · title · 38ch desc`) | within views |
| E-62 | Time-block divider (`MORNING · 04 — 09:00–12:00`) | today view |
| E-63 | "ON FIRE" band (overdue + procedural + imminent meetings) | today view top |
| E-64 | Sidebar (`brand · nav · clients · footer`) | always |
| E-65 | AI rail (head · body · input) | wide screens |
| E-66 | Modal overlay + dialog | editors, AI preview, settings |
| E-67 | Toast | confirmation, undo, errors |
| E-68 | Empty state | new views with no data |
| E-69 | Loading / thinking indicator | async |
| E-70 | Avatar (square mono initials) | participants |
| E-71 | Search bar with results dropdown | sidebar top |
| E-72 | Footer banner (`AI ▸ suggestion + Apply/Dismiss`) | today view |
| E-73 | Day-stats strip (4-column metrics) | dashboard / briefing |
| E-74 | Bar chart (7-day weekly hours) | time view |
| E-75 | Capture-strip (4-column parsed-counts) | after-capture |
| E-76 | Procedural alert banner | dashboard top when near |
| E-77 | **Scope-warning banner** (subscription matter > 80% used) | matter detail |
| E-78 | **Wizard frame** (3-step header · body · prev/next) | invoice generation, matter creation |

### 2.6 Navigation
| ID | Element | Purpose |
|---|---|---|
| E-80 | Sidebar nav row (proj-pattern: num · icon · label · count) | views + clients |
| E-81 | Tabs (within views: list ↔ kanban ↔ calendar) | matter detail |
| E-82 | Breadcrumb | client → matter → task |
| E-83 | Command palette `⌘K` | global search/jump |
| E-84 | **Quick keystrokes**: `⌘N` capture · `⌘L` log-call · `⌘K` search · `⌘,` settings | global |

---

## 3. Coverage check

Mapping J-01..J-09 → which functions/elements implement each:

| Job | Functions | Elements |
|---|---|---|
| J-01 Capture | F-01..F-09 | E-01,02,10,49,52,57,75 |
| J-02 Morning triage | F-10,11,F-145 | E-63,67,73,76 |
| J-03 Log a short call | F-33 | E-57 (popover) |
| J-04 Subscription Q | F-01..F-09, F-60..F-64 | E-53,77 |
| J-05 Fixed-price | F-70..F-74 | E-54,55 |
| J-06 Invoice | F-122..F-133 | E-45,46,59,78 |
| J-07 Procedural | F-19, ubiquitous | E-33,76 |
| J-08 Meeting | F-90..F-100 | E-56,48 |
| J-09 Practice review | future | future |

If a job has no element/function — that job won't ship. Coverage looks complete except J-09 which is post-Phase-1.

---

**Status:** locked. Next: §⑤ — revise FLOWS.md.
