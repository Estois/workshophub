---
name: tdd
description: Red-green loop for the Adversarial Test-Agent / Double-Loop pattern, delegating to the project's test-writer and implementer agents. Locked to ONE acceptance criterion (or one Operation) per invocation — never a whole-story test suite, never more than one slice. Use when the navigator wants to implement a single AC or Operation test-first with isolated agents.
---

Locked to ONE acceptance criterion (or one Operation) per invocation.

1. Ask the navigator which ONE slice is being implemented — a pasted story AC, or an Operation / canvas excerpt, whatever they provide.
2. Build a packet for the agents from what the navigator gives you. May include: AC / Operation text, Requirements, Entities, Approach, Structure, Norms, Safeguards, out-of-scope do-nots, intended module paths. Pass through what the navigator provides as-is — do not strip Approach or Operations, and do not invent a whole-story suite.
3. Delegate to the `test-writer` agent with that packet. The test-writer agent must not read `api/src`.
4. Run `make test` yourself and show the failure output. Then PAUSE and ask the navigator to confirm this is RED for the right reason (the behaviour is missing, not a setup mistake). Do not implement yet.
5. Only after the navigator confirms RED, delegate to the `implementer` agent with the same packet plus the failing-tests context.
6. Run `make test` again and confirm it is green.
7. STOP. Do not start the next slice.

Hard rules:
- One slice per skill run, then stop.
- This skill must not call `/spdd-generate` — orchestration calls this skill, not the other way around.
