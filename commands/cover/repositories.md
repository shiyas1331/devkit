---
description: (node|android) Generate unit tests for every untested repository in a package/module. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:repositories — repository batch

Equivalent to `/devkit:cover <path> --batch repositories`. Skips the picker.

Set `CLASSIFICATION=repository`, detect the platform (Phase 0 of the batch
bodies), then:

- `PLATFORM==node` → read `commands/cover/node-batch.md` and follow it verbatim
  (Mongoose repositories, one test file per public method under `tests/unit/`).
- `PLATFORM==android` → read `commands/cover/android-batch.md` and follow it
  verbatim (Retrofit-wrapping repositories, one test file per source file under
  `src/test/java/`).
- Anything else → STOP; this batch exists only for node and android.
