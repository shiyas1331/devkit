---
description: (node|android) Generate unit tests for every untested pure util/helper in a package/module. Skips the picker.
argument-hint: <package-path>
model: opus
---

# /devkit:cover:util — util batch

Equivalent to `/devkit:cover <path> --batch util`. Skips the picker.

Set `CLASSIFICATION=util`, detect the platform (Phase 0 of the batch bodies),
then:

- `PLATFORM==node` → read `commands/cover/node-batch.md` and follow it verbatim
  (per-function files under `tests/unit/`).
- `PLATFORM==android` → read `commands/cover/android-batch.md` and follow it
  verbatim (one `<Name>Test.kt` per source file under `src/test/java/`; pure
  JVM only — Android-framework-touching helpers are `robolectric`, not `util`).
- Anything else → STOP; this batch exists only for node and android.
