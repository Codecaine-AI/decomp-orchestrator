# Pointer-Offset Reassociation Diagnose Plan

1. Add failing tests for `_detect_pointer_offset_reassociation_hint`.
   - Positive: source site, expected split `add`/`addi`, and current folded
     `addi`/`add` all agree on the same constant and consumer.
   - Negative: expected-only, current-only, adjacent-function asm, and byte
     store/displacement sites do not report.

2. Add diagnose CLI tests.
   - JSON exposes `pointer_offset_reassociation` for a fixture.
   - Text prints the hint block.
   - A verified cast win remains the primary recommendation path.

3. Implement a narrow detector in `tools/melee-agent/src/cli/debug.py`.
   - Extract only the target function from expected asm.
   - Extract only the target function chunk from pcdump text.
   - Parse source call-site constants for `memcpy`, `memset`, and
     `fn_803AC3F8`.
   - Match constants and consumers against expected/current evidence.

4. Wire the hint into `debug inspect diagnose`.
   - Add the JSON field.
   - Print text hint when present.
   - Prepend recommendations only for `NO FAST TRANSFORM FOUND`.

5. Verify with focused tests, full debug CLI tests, compileall, and real
   `fn_803ACFC0` diagnose smoke.
