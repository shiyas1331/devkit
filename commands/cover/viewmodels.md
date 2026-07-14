---
description: (android) Generate unit tests for every untested ViewModel in a module. One test file per source file under src/test/java/. Skips the picker.
argument-hint: <module-path>
model: opus
---

# /devkit:cover:viewmodels — android ViewModel batch

Equivalent to `/devkit:cover <path> --batch viewmodels`. Skips the picker. Android platform only.

Set `CLASSIFICATION=viewmodel`, then read `commands/cover/android-batch.md` and
follow it verbatim with that classification.
