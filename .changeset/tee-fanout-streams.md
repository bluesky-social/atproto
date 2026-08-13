---
'@atproto/common': minor
---

Add `fanOut`, a pipeline-destination counterpart to `Tee` that owns its output sinks: an output that errors or ends early is dropped while the others (and the input) keep flowing, and the input is only torn down once every sink has died. Also harden `Tee` so a branch that dies mid-write (e.g. one created with `autoDestroy: false`, which errors without emitting `close`) can no longer stall the main stream.
