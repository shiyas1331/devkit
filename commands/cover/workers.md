---
description: (node) Generate unit tests for every untested worker processor/handler in a package. Per-method files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:workers — node worker batch

Equivalent to `/devkit:cover <path> --batch workers`. Skips the picker. Node platform only.

Set `CLASSIFICATION=worker`, then read `commands/cover/node-batch.md` and follow
it verbatim with that classification. Phase 1 also scans `<PLATFORM_ROOT>/workers/**`.
