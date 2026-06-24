---
description: (node) Generate unit tests for every untested pure util/helper in a package. Per-function files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:util — node util batch

Equivalent to `/devkit:cover <path> --batch util`. Skips the picker. Node platform only.

Set `CLASSIFICATION=util`, then read `commands/cover/node-batch.md` and follow it
verbatim with that classification.
