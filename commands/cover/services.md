---
description: (node) Generate unit tests for every untested SDK-wrapping service in a package. Per-method files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:services — node service batch

Equivalent to `/devkit:cover <path> --batch services`. Skips the picker. Node platform only.

Set `CLASSIFICATION=service`, then read `commands/cover/node-batch.md` and follow
it verbatim with that classification.
