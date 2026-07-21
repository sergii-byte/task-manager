# Design source of record

Two design bundles were produced in Claude Design (claude.ai/design) and both
fed into ordify. They used to sit in untracked `_design*` folders at the repo
root — one disk failure from gone — so they live here now.

## What is where

| | Where | Status |
|---|---|---|
| **Hi-fi bundle** (HTML/CSS, `hifi-*.html`) | `taskmanager-v2/design/` | Committed with the app. Brief calls it *reference only, not built*. |
| **Component bundle** (JSX: tokens, foundations, patterns, components) | `jsx-bundle/` | Reference. Never wired into the app. |
| **Chat transcripts** | `chats/` | Where the intent lives — read these before reworking a screen. |

The transcripts matter more than the files: they carry the back-and-forth that
explains *why* a screen landed where it did. `chats/hifi-bundle.md` belongs to
the hi-fi set, `chats/jsx-bundle.md` to the JSX set.

## The direction that actually shipped

Per `taskmanager-v2/PRODUCT-BRIEF.md` §6: the **minimal** direction is primary
(`min-today`, `min-invoice`, `min-client`, `min-matter`, `min-capture`),
editorial and lowercase, plum accent `#6a1b9a`. The hi-fi direction was
explicitly *not* built. Neither bundle is a spec — the shipped app has moved on
from both, most recently with the client portal, which no bundle covers.

Treat everything here as reference, not as a target to match pixel for pixel.
