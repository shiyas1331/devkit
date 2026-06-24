---
description: (node) Generate unit tests for every untested mapper in a package. Pure transforms, per-method files under tests/unit/. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:mappers — node mapper batch

Equivalent to `/devkit:cover <path> --batch mappers`. Skips the picker. Node platform only.

Set `CLASSIFICATION=mapper`, then read `commands/cover/node-batch.md` and follow
it verbatim with that classification.
