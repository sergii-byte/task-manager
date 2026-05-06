# ordify.me — User Flows (v2 · 2026-04-29)

7 critical paths. Match J-01..J-08 from JTBD. Updated for billing-mode-on-matter and meetings-as-first-class.

---

## Flow 01 — Capture (J-01, top priority)

> "Maria pinged in Telegram — wants the SAFT reviewed by Friday."

```
┌──────────────────────┐
│ TRIGGER              │
│ • global ⌘N          │
│ • sidebar 01 Capture │
│ • mic on phone       │
└─────────┬────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ CAPTURE SURFACE (linen pad)             │
│ ┌─────────────────────────────────────┐ │
│ │ [text · mic · submit]               │ │
│ │ "maria saft review by friday"       │ │
│ └─────────────────────────────────────┘ │
└─────────┬───────────────────────────────┘
          │ submit
          ▼
┌─────────────────────────────────────────┐
│ AI PARSE (1-3 sec, "thinking" dots)     │
│ — system prompt cached with project     │
│   graph (clients, matters, companies)   │
└─────────┬───────────────────────────────┘
          │
          ▼
       ┌──┴──┐
       │ AI  │  what kind of action did AI detect?
       └──┬──┘
   ┌──────┼──────┬─────────┬──────────┐
   ▼      ▼      ▼         ▼          ▼
 single  chain  ambiguous unknown   subscription
 task   (multi)            (parse   client Q
                            failed)  (J-04)
   │      │      │          │          │
   │      │      │          └─→ "save raw note?" → inbox
   │      │      │
   │      │      └─→ FUZZY-MATCH PICKER
   │      │           "did you mean Maria Soto · Acme Tech · create new?"
   │      │
   │      └─→ AI PREVIEW MODAL (chain mode — capture-strip showing counts)
   │
   ▼
AI PREVIEW MODAL (single)
┌──────────────────────────────────────────┐
│ DETECTED ▸ task                          │
│ ───                                      │
│ Client:  Maria Soto              ▼       │ ← editable
│ Matter:  Acme Tech · subscription ▼      │ ← billing-mode hint
│ Company: Acme Tech US LLC        ▼       │ ← multi-pick
│ Title:   Review SAFT                     │
│ Due:     Friday 02.05.26                 │
│ Priority: P1 high                        │
│ Tag:     [crypto] [contracts]            │ ← AI-suggested
└──────────────────────────────────────────┘
[cancel]              [accept → commit]

          ▼
COMMIT
• new task created under matter
• if matter is subscription → scope counter starts ticking
• toast: "Task created → Acme Tech (subscription)"
• if matter scope > 80% → AI rail nudge
• stay on capture (for next fragment) OR redirect Today
```

**Edge cases:**
- AI offline → save raw note in inbox, retry parse later
- New client (not in graph yet) → AI proposes `industry: 'Crypto'` based on language; user confirms or edits
- New matter → AI proposes `billing.mode` based on language ("retainer/subscription" → subscription, "fixed price/€X" → fixed, "hourly/€X/h" → hourly, default = hourly)

---

## Flow 02 — Start working a task & log time

```
┌─────────────────┐
│ Today / Inbox   │
└────────┬────────┘
         │ click ▶ play icon
         ▼
TIMER STARTS
• task.status = "in_progress"
• running clock (lime pill, top-rt)
• all other timers paused
• if matter is hourly → timelog will be billable
• if matter is subscription → timelog counts toward scope
• if matter is fixed → timelog tracked but not billed (effort metrics)

         │
         │ user works…
         ▼
DECISION
   ┌─────┼─────────────┐
   ▼     ▼             ▼
 pause  stop      switch task
                       │
                       └─→ confirm "stop X & start Y?"

STOP MODAL
┌──────────────────────────────┐
│ Time logged: 02:47           │
│ Task: Review SAFT            │
│ Description: ___________     │ ← optional
│ ☑ billable                   │ ← (hidden if matter is fixed)
└──────────────────────────────┘
[discard] [save]

         ▼
LOG ENTRY
• taskId · matterId · date · hours · billable · source='timer'
• task.hours_logged += hours
• if matter is subscription → scope_used += hours
  → if scope_used > 80% × hours_included → trigger banner + AI nudge
• appears in tracker-log + weekly timesheet
• locked once invoiced
```

---

## Flow 03 — Quick log-call (J-03 — biggest $ leak)

> "Just hung up with Maria — 12 min, wanted to know about EU stablecoin reg." This is what currently goes unlogged.

```
┌──────────────────────┐
│ TRIGGER              │
│ • global ⌘L          │
│ • toolbar mic-down   │
│ • iOS Shortcut       │
└─────────┬────────────┘
          │
          ▼
QUICK-LOG-CALL POPOVER (200×260px, top-right)
┌──────────────────────────────────────────┐
│ ⌘L  LOG CALL                          ✕  │
│ ─────────────────────────────────────────│
│ Client:  Maria Soto              ▼       │ ← auto last-active
│ Matter:  Acme Tech · subscription ▼      │ ← auto last-active
│ Topic:   "EU stablecoin reg"             │ ← 1-line, optional
│ Duration: ⊟ 12 min ⊞                     │ ← suggestion: time since last keypress
│ ☑ billable / counts toward subscription  │
└──────────────────────────────────────────┘
[esc] [✓ log]  ← Enter logs immediately

          ▼
COMMIT (no modal, no review, no task creation)
• creates timelog with source='quick-call'
• if no current task on matter → auto-create task "Call · EU stablecoin reg" (12 min)
• subscription scope updated
• toast: "12 min logged · Acme · 7.4h / 10h"
```

**Why this matters**: 5-second flow. The whole leak (J-03) is sealed if this works.

---

## Flow 04 — Procedural deadline (J-07 — irreversible-risk)

```
ENTRY — task editor with ☑ procedural
         │
         ▼
TASK rendered with PROCEDURAL badge
(vermillion fill, mono caps)

Privileged rendering everywhere:
  • Today view "ON FIRE" band (top)
  • Calendar (vermillion dot, not plum)
  • Sidebar matter row (badge)
  • AI rail morning briefing
  • Procedural-alert banner on dashboard

         │
         │ time passes…
         ▼
NOTIFICATION TRIGGERS (per setting)
  T-24h: persistent banner
  T-2h:  toast + banner pulses + AI bubble
  T-30m: AI rail interrupts (modal-style attention)

         ▼
DONE / MISS
  • mark done before T → green delta
  • crosses T un-done → permanent "MISSED" indicator
    + AI auto-creates "draft post-mortem memo" task
```

---

## Flow 05 — Generate invoice (J-06 — REVISED for 3-mode mixing)

```
┌──────────────────────────┐
│ TRIGGER                  │
│ • Invoices view → + New  │
│ • OR period-end auto     │
│ • OR fixed milestone done│
└────────┬─────────────────┘
         │
         ▼
STEP 1 — pick client + period
┌──────────────────────────────────────────┐
│ Client:  Acme Tech                ▼      │
│ Period:  ⌘ April 2026 (01.04 — 30.04)    │
└──────────────────────────────────────────┘
         │ AI auto-fetches all eligible items for THIS client THIS period
         ▼
STEP 2 — review pre-filled lines (3 types mixed)
┌──────────────────────────────────────────┐
│ ☑ SUBSCRIPTION                           │
│   April retainer · Acme Tech · €1500     │
│   (scope used 7.4h / 10h)                │
│                                          │
│ ☑ FIXED-PRICE MILESTONES (1)             │
│   US LLC delivered 14.04 · €2400         │
│                                          │
│ ☑ HOURLY (none this period)              │
│                                          │
│ ─────                                    │
│ Subtotal:        €3,900.00               │
│ VAT 21%:           €819.00               │
│ TOTAL DUE:       €4,719.00               │
└──────────────────────────────────────────┘
[‹ back] [next ›]
         │
         ▼
STEP 3 — confirm & commit
┌──────────────────────────────────────────┐
│ Issue date: 30.04.2026                   │
│ Due date:   14.05.2026 (net 14)          │
│ Currency:   EUR                          │
│ VAT %:      21                           │
│ FROM block: [your snapshot]              │
│ BILL TO:    [client snapshot]            │
└──────────────────────────────────────────┘
[‹ back] [save draft ›]

         ▼
INVOICE DRAFT created
• status='draft'
• number = INV-2026-0042
• all referenced logIds locked
• subscription line: matterId + period_start + period_end
• fixed lines: matterId + milestoneId
• hourly lines: matterId + logIds[] (if any)
• redirect: invoice document view

         │
         │ user reviews → [▸ send]
         ▼
status = 'sent' · sentAt · mailto: prefilled with PDF attached
         │
         │ payment received → user [mark paid]
         ▼
status = 'paid' · paidAt · logs remain locked (audit)
```

**Auto-trigger variant (J-04 subscription period-end):**
- Cron at month-end: matter.billing.auto_invoice_on_period_end === true → draft generated automatically, AI rail notifies "1 draft invoice ready for review · Acme · €4719"

---

## Flow 06 — Meeting (J-08 — first-class entity)

```
┌──────────────────────────┐
│ ENTRY                    │
│ a) external sync (auto)  │
│ b) manual create in app  │
└────────┬─────────────────┘
         │
   ┌─────┼─────┐
   ▼           ▼
 EXTERNAL    MANUAL
 sync from   "+ meeting" in calendar/matter
 google/iCloud
   │           │
   ▼           ▼
MEETING entity created
{
  external_id?, source: 'google'/'icloud'/'manual',
  matterId, clientId,
  title, starts_at, ends_at,
  attendees, video_url,
  pre_task_minutes: 15  ← user default
  auto_log_minutes: true
}
   │
   ▼
PRE-MEETING (T - 15min, configurable)
• auto-create task "Prep · {meeting title}"
  → priority high, deadline = meeting.starts_at
• AI rail: "Maria meeting in 15 min · prep open"

   │
   │ meeting happens…
   ▼
POST-MEETING (T + meeting.ends_at)
• if auto_log_minutes → create timelog
  source='meeting', hours=duration, billable per matter mode
• if matter.subscription → scope_used += duration

   │
   ▼
RECONCILIATION (sync)
• edit in ordify → push to external (google/iCloud)
• edit in external → pull on next sync
• conflict → last-write-wins (or manual-resolve modal if both edited within sync window)
```

---

## Flow 07 — Morning open (J-02)

```
open laptop
   │
   ▼
ORDIFY BOOTS
• passphrase prompt (if encryption on)
• default landing: Today

   │
   ▼
TODAY VIEW
┌──────────────────────────────────────────┐
│ "ON FIRE" BAND (top, max visual weight)  │
│ ──────────────────────────────────────── │
│ ▶ T-0142 · OFAC memo · OVERDUE 20H       │ vermillion fill
│ ▶ T-0146 · Shareholder consent · 14:00   │ procedural
│ ▶ M-0015 · Maria call · 11:00 (45 min)   │ meeting
└──────────────────────────────────────────┘

below the fold:
  • Today's task list (grouped by hour blocks)
  • Today's meetings interleaved with tasks
  • Done-earlier (collapsed)

   │
   ▼
AI MORNING BRIEFING (auto, in rail)
"10 tasks today, 1 overdue (OFAC), 1 procedural at 14:00,
 3 meetings (10:00 / 13:00 / 16:00). Acme subscription
 scope at 7.4h / 10h — 74%. Want me to reshape morning
 around the OFAC + 14:00 cut-off?"
[▸ reshape] [defer P3] [block focus]
```

---

## Screens needed (consolidated)

| Flow | Screens |
|---|---|
| 01 Capture | capture-surface · ai-preview-modal · fuzzy-picker · toast |
| 02 Time    | task-row · running-timer-pill · stop-modal · tracker-log |
| 03 Log-call| **quick-log-popover** (NEW) · toast |
| 04 Proc.   | task-editor · every list/calendar · dashboard banner · AI rail |
| 05 Invoice | invoices-list · invoice-wizard (3 steps with mixed lines) · invoice-document |
| 06 Meeting | meeting-editor · calendar-grid · today-meeting-card · sync-conflict-modal |
| 07 Morning | passphrase-gate · today (ON FIRE band) · AI rail |

**Distinct screens for Phase 1:**

1. capture-surface
2. ai-preview-modal
3. quick-log-popover ← NEW
4. today-view (with ON FIRE band)
5. running-timer-pill
6. stop-timer-modal
7. tracker-log + weekly-timesheet
8. matter-list
9. matter-detail (3 variants: subscription / fixed / hourly)
10. client-detail
11. company-drawer
12. calendar (with meetings + procedural dots)
13. meeting-editor
14. invoice-list
15. invoice-wizard
16. invoice-document
17. AI rail
18. settings (api · encryption · sync · identity · calendar)

That's 18 distinct screens. About 12 are Phase-1 critical (1-7, 9, 12-14, 17). Rest can come in 1.5/2.

---

**Status:** locked. Next: §⑥ — Information Architecture.
