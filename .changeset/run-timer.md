---
"pi-hud": minor
---

Add a per-run timer that shows how long the current agent prompt has been running, mirroring the behaviour of [`pi-timer`](https://github.com/jojopirker/pi-timer). The footer context line now ends with `⏱ runs for X` while the agent is running and `⏱ ran for X` after the run ends (resets on the next `agent_start`). The expanded overlay gains a `Timer` section with the same wording, and the compact overlay shows a single `⏱` line. The new module is visible by default and can be toggled via `/hud-settings` → Modules visibility → `Run timer`.
