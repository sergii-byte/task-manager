# ordify.me — Status → Colour mapping (locked 2026-04-29)

Each status has **one** palette colour. No custom shades, no off-palette inventions. The 8 approved hues (from `tokens.css`) cover everything.

## Mapping

| Status / state           | Palette token   | Hex       | Tint bg (50)  | Where it shows                                                     |
|--------------------------|-----------------|-----------|---------------|--------------------------------------------------------------------|
| **OVERDUE** (alarm)      | `--vermillion`  | `#e63312` | `#fff1ee`     | already bad — solid badge + row tint + countdown                   |
| **DUE SOON** (warning)   | `--saffron`     | `#f5b700` | `#fff8e0`     | becoming bad (next 24h) — solid badge + row tint                   |
| **DOING** (in progress)  | `--lime`        | `#c5f000` | `#f7ffd6`     | active task (timer running) — pulse dot, lime border on row        |
| **DONE**                 | `--ink`         | `#0a0a0a` | (no tint)     | closed — strike-through + ink-fill check                            |
| **TODO** (idle)          | `--ink` outline | `#0a0a0a` | (no tint)     | base state — empty checkbox, no special bg                          |
| **MEETING** (event)      | `--cobalt`      | `#1a3dd8` | `#ecefff`     | scheduled event — cobalt rule, badge, countdown                    |
| **AI-SUGGESTED**         | `--accent`      | `#6a1b9a` | (no tint)     | task came from AI — `AI ▸` mark in plum                            |
| **PERSONAL / SPECIAL**   | `--magenta`     | `#ff2e93` | (no tint)     | tag for non-work / personal / "fun" tasks                           |
| **INFO / READY**         | `--cyan`        | `#00e5ff` | (no tint)     | reserved — for future review / pending-input states                 |

## Rules

1. **One colour per state.** Never two reds, never «light overdue» vs «dark overdue».
2. **Badge colour follows the row's state**, not its content.
3. **Tint backgrounds** (the `-50` columns) used only for ON FIRE band rows where the row needs to telegraph state from a distance. Outside ON FIRE → no tint, just the badge.
4. **AI mark plum** is a *modifier*, not a state — overlays on top of any other state.

## Visual hierarchy in ON FIRE band

```
top → bottom in priority order:

   ▌▌▌  OVERDUE rows         vermillion  (already bad)
   ▌▌▌  DUE SOON rows         saffron     (becoming bad)
   ▌▌▌  MEETING (imminent)    cobalt      (event)
```

Within a single ON FIRE band: keep this order — alarm-first, warning-second, event-third.

## Cross-app uses (preview)

```
Sidebar            ─ swatch dot per client (rotation: accent / cobalt / saffron / ink / lime / magenta)
Calendar grid      ─ task dot vermillion (overdue) / saffron (due soon) / cobalt (meeting)
Time tracker NOW   ─ lime block (running)
Subscription gauge ─ saffron at 80%, vermillion at 100% scope
Invoice status     ─ ink (draft) / saffron (sent unpaid) / lime (paid)
Capture pad        ─ linen surface (not in palette — special-purpose)
AI panel           ─ ink head + plum glyph
```

This is the entire system. No more colours will be added without a STATUS-COLORS.md change first.
