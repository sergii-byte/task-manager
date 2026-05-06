# ordify.me — Low-fi Wireframes (top-3 screens)

ASCII boxes only. **No colour, no typography, no visual treatment.** Pure structure + proportions + content priority.

For each screen: 2 variants. Pick one (or describe a third). After all three are locked → §⑨ Hi-fi mockups.

Legend:
```
┌─┐    rigid container
│ │
└─┘
╭─╮    soft / suggestive container
│ │
╰─╯
══     primary boundary (heavy rule)
──     secondary boundary (hairline)
░░     low visual weight (muted / collapsed / placeholder)
██     high visual weight (alarm / primary)
[..]   button
{..}   input
<..>   data shown as text
``..`` mono / ID / metadata label
```

---

## SCREEN 01 — CAPTURE

### Variant A — single-input dominant (linen pad centred)

```
╔════════════════════════════════════════════════════════════════════╗
║ SIDEBAR │ ── HERO HEAD ───────────────────────────────────────────  ║
║ ─────── │  `VIEW 01 · CAPTURE`                                      ║
║         │  «catch the thought.»                                     ║
║         │ ──────────────────────────────────────────────────────────║
║         │                                                           ║
║         │      ┌───────────────────────────────────────────┐        ║
║         │      │ `NOTE 0014 · 14:32`        `SCRATCHPAD`   │        ║
║         │      │                                           │        ║
║         │      │   { large multiline text input          } │        ║
║         │      │   {                                     } │        ║
║         │      │   {                                     } │        ║
║         │      │   {                                     } │        ║
║         │      │   { ──── 6 lines tall ─────             } │        ║
║         │      │                                           │        ║
║         │      │   ──────────────────────────────────      │        ║
║         │      │  ░3 RECENT CAPTURES (collapsed)░          │        ║
║         │      │   ──────────────────────────────────      │        ║
║         │      │   [🎤] [✨ AI parse →]    [submit ⏎]     │        ║
║         │      └───────────────────────────────────────────┘        ║
║         │                                                           ║
║         │      ░ try: "maria saft review by friday"      ░          ║
║         │      ░ try: "log 12 min call · acme"           ░          ║
║         │      ░ try: "register US LLC by 15.05"         ░          ║
║         │                                                           ║
║         │     [ quick mode ]  [ meeting mode ]                     ║
║         │                                                           ║
║─────────│                                                           ║
║         │                                                           ║
║         │                                                           ║
╚════════════════════════════════════════════════════════════════════╝
```

**Pros:** classic capture. Pad is centred, dominant, single-purpose. Hero head signals where you are.
**Cons:** static — you see your input, but not what AI thinks. Modal opens AFTER you submit.

---

### Variant B — split: input left, live AI parse right

```
╔════════════════════════════════════════════════════════════════════╗
║ SIDEBAR │ ── HERO HEAD ──────────────────────────────────────────  ║
║         │  `VIEW 01 · CAPTURE`                                      ║
║         │  «catch the thought.»                                     ║
║         │ ──────────────────────────────────────────────────────────║
║         │                                                           ║
║         │  ┌─────────── INPUT (50%) ────┬─── LIVE PARSE (50%) ───┐ ║
║         │  │ `RAW · 14:32`              │ `AI ▸ DETECTING…`      │ ║
║         │  │                            │                         │ ║
║         │  │ {                       }  │ ┌── as you type ──────┐│ ║
║         │  │ {                       }  │ │ Type:    task       ││ ║
║         │  │ {                       }  │ │ Client:  Maria Soto ││ ║
║         │  │ {                       }  │ │ Matter:  Acme · sub ││ ║
║         │  │ {                       }  │ │ Title:   Review SAFT││ ║
║         │  │ {                       }  │ │ Due:     Friday     ││ ║
║         │  │                            │ │ Priority: P1        ││ ║
║         │  │  [🎤]  [submit ⏎]          │ │ Tags:    [crypto]   ││ ║
║         │  │                            │ └─────────────────────┘│ ║
║         │  │                            │                         │ ║
║         │  │                            │  [accept ▸ commit]      │ ║
║         │  └────────────────────────────┴─────────────────────────┘ ║
║─────────│                                                           ║
╚════════════════════════════════════════════════════════════════════╝
```

**Pros:** see AI's understanding while typing. No modal-on-submit needed. Tighter feedback loop.
**Cons:** more visual chrome. AI parsing on every keystroke is API-cost heavy unless throttled.

---

## SCREEN 02 — TODAY

### Variant A — vertical stack (ON FIRE → schedule → AI footer)

```
╔════════════════════════════════════════════════════════════════════╗
║ SIDEBAR │ ── HERO HEAD ──────────────────────────────────────────  ║
║ ─────── │  `VIEW 02 · TODAY · WED 29.04`        [⊞ board] [+ new] ║
║         │  «today, focused.»                       `10 ACTIVE`     ║
║         │═══════════════════════════════════════════════════════════║
║         │                                                           ║
║         │ ████ ON FIRE · 03 ███████████████████████████████████████ ║
║         │ ████                                                  ███ ║
║         │ ████ █ T-0142 · OFAC memo · OVERDUE 20H            ████  ║
║         │ ████ █ T-0146 · Shareholder consent · 14:00 PROC   ████  ║
║         │ ████ █ M-0015 · Maria call · 11:00 (in 28 min)     ████  ║
║         │ ████                                                  ███ ║
║         │ ████████████████████████████████████████████████████████ ║
║         │                                                           ║
║         │ ─── MORNING · 03 ─────────── 09:00 — 12:00 ────────────── ║
║         │ T-0143 ☐ Review NDA red-lines · Acme    [P1] 10:30        ║
║         │ T-0144 ☐ Mira call (BVI/Cayman)         [P1] 11:00        ║
║         │ T-0145 ☐ Engagement letter · Northwind  [P2] 11:45        ║
║         │                                                           ║
║         │ ─── AFTERNOON · 04 ──────── 13:00 — 18:00 ─────────────── ║
║         │ T-0147 ☐ Send INV-0042 · Acme · €2,927  [P1] 15:30        ║
║         │ T-0148 ☐ MiCA research                  [P2] 16:00        ║
║         │ T-0149 ☐ Pick up PoA · Vasylenko        [P3] 17:30        ║
║         │                                                           ║
║         │ ░── DONE · 02 (collapsed) ──────────────────────────────░ ║
║         │                                                           ║
║─────────│═══════════════════════════════════════════════════════════║
║         │ ██ AI ▸ Defer 2 P3 to Wed?  [Apply] [Dismiss]          ██ ║
║         │═══════════════════════════════════════════════════════════║
╚════════════════════════════════════════════════════════════════════╝
```

**Pros:** linear scan. Top is alarm, middle is schedule, bottom is help. Familiar mental model.
**Cons:** ON FIRE band always takes vertical space even when empty (could collapse).

---

### Variant B — two-column (ON FIRE sticky-left, schedule-right)

```
╔════════════════════════════════════════════════════════════════════╗
║ SIDEBAR │ ── HERO HEAD ──────────────────────────────────────────  ║
║         │  `VIEW 02 · TODAY · WED 29.04`        [⊞ board] [+ new] ║
║         │  «today, focused.»                       `10 ACTIVE`     ║
║         │═══════════════════════════════════════════════════════════║
║         │                                                           ║
║         │ ┌─ ON FIRE · 03 ───┐ ┌─ SCHEDULE ──────────────────────┐ ║
║         │ │ ████████████████ │ │ MORNING · 03   09:00 — 12:00    │ ║
║         │ │ ██ OFAC memo  ██ │ │ T-0143 ☐ Review NDA      10:30  │ ║
║         │ │ ██ OVERDUE 20H██ │ │ T-0144 ☐ Mira call       11:00  │ ║
║         │ │ ██████████████   │ │ T-0145 ☐ Eng. letter     11:45  │ ║
║         │ │ ──────────────── │ │                                 │ ║
║         │ │ ██ Acme cons. ██ │ │ AFTERNOON · 04 13:00 — 18:00    │ ║
║         │ │ ██ 14:00 PROC ██ │ │ T-0147 ☐ INV-0042        15:30  │ ║
║         │ │ ██████████████   │ │ T-0148 ☐ MiCA            16:00  │ ║
║         │ │ ──────────────── │ │ T-0149 ☐ PoA             17:30  │ ║
║         │ │ ██ Maria call ██ │ │                                 │ ║
║         │ │ ██ in 28 min  ██ │ │ ░ DONE · 02 (collapsed) ░       │ ║
║         │ │ ██████████████   │ │                                 │ ║
║         │ │                  │ │                                 │ ║
║         │ │ 30% width        │ │ 70% width                       │ ║
║         │ └──────────────────┘ └─────────────────────────────────┘ ║
║─────────│═══════════════════════════════════════════════════════════║
║         │ ██ AI ▸ Defer 2 P3 to Wed?  [Apply] [Dismiss]          ██ ║
╚════════════════════════════════════════════════════════════════════╝
```

**Pros:** ON FIRE stays in peripheral vision while you scan the schedule. Two-track attention.
**Cons:** narrower schedule column. On 1280px screen with sidebar+AI rail, this gets cramped.

---

## SCREEN 03 — QUICK-LOG-CALL POPOVER

### Variant A — compact form (200×260, 4 fields)

```
                              ┌───────────────────────────┐
                              │ ⌘L  LOG CALL          ✕   │
                              │ ──────────────────────────│
                              │                           │
                              │ Client                    │
                              │ { Maria Soto         ▼ }  │
                              │                           │
                              │ Matter                    │
                              │ { Acme · subscription ▼ } │
                              │                           │
                              │ Topic (optional)          │
                              │ { EU stablecoin reg    }  │
                              │                           │
                              │ Duration                  │
                              │  [⊟]   12 min   [⊞]       │
                              │                           │
                              │ ☑ counts toward subscription │
                              │ ──────────────────────────│
                              │            [esc] [✓ log ⏎]│
                              └───────────────────────────┘
                                            anchored top-right
                                            of viewport
```

**Pros:** all fields visible at once. Defaults pre-filled. Two clicks max.
**Cons:** 5 visible inputs feels heavy for a 5-second flow.

---

### Variant B — single-line natural-language ("spotlight")

```
                ┌─────────────────────────────────────────────────┐
                │ ⌘L  { maria 12min EU stablecoin                }│
                │     ──────────────────────────────────────────  │
                │     ░ AI parses: ░                              │
                │     ░ • Maria Soto · Acme (sub)         ░       │
                │     ░ • 12 min                          ░       │
                │     ░ • topic: EU stablecoin reg        ░       │
                │     ░ • billable, counts to scope        ░       │
                │                                                  │
                │                              [esc] [✓ log ⏎]   │
                └─────────────────────────────────────────────────┘
                                centred modal, ~580×220
```

**Pros:** 1 input. Type-and-fly. Closer to the "5-second" target.
**Cons:** AI must parse correctly every time — if it gets client wrong you scroll back to fix. Failure mode worse than form.

---

## What I recommend

| Screen | Recommended variant | Rationale |
|---|---|---|
| 01 Capture | **A** (single input, modal on commit) | Cleaner, simpler. Variant B's keystroke-AI pattern is expensive. We can revisit if AI cost drops. |
| 02 Today | **A** (vertical stack) | Linear is what your brain expects in the morning. Two-column adds chrome without payoff at typical screen widths. |
| 03 Quick-log | **B** (single-line spotlight) | 5-second target wins only if there's 1 input. Form-style A is "almost there" but not 5 sec. Failure mode (AI misparse) is recoverable — Esc + retype. |

---

## Decision points

For each screen, pick **A**, **B**, or "describe variant C". After the 3 picks → I write WIREFRAMES-LOCKED.md and we proceed to §⑨ Hi-Fi mockups (drawing the chosen wireframes with type, colour, real spacing).

— end —
