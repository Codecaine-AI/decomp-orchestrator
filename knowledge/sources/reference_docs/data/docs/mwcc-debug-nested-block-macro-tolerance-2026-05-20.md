# Tree-sitter macro tolerance — 2026-05-20

Validated `ast_walker.walk_function` on 15 representative mn-module
functions across three translation units. Fallback rate target: < 10%.

## Results

| TU | Function | Outcome |
|----|----------|---------|
| mnvibration.c | lb_8001CE00 | OK (0 decls, 0 nested) |
| mnvibration.c | fn_80247510 | OK (15 decls, 2 nested) |
| mnvibration.c | fn_80248084 | OK (0 decls, 0 nested) |
| mnvibration.c | mnVibration_802480B4 | OK (4 decls, 0 nested) |
| mnvibration.c | mnVibration_8024829C | OK (9 decls, 0 nested) |
| mnname.c | fn_80249A1C | OK (0 decls, 0 nested) |
| mnname.c | CompareNameStrings | OK (4 decls, 1 nested) |
| mnname.c | fn_802377A4 | OK (0 decls, 0 nested) |
| mnname.c | DeleteName | OK (9 decls, 0 nested) |
| mnname.c | CreateNameAtIndex | OK (1 decls, 0 nested) |
| mnevent.c | mnEvent_8024CE74 | OK (2 decls, 0 nested) |
| mnevent.c | mnEvent_8024D15C | OK (18 decls, 0 nested) |
| mnevent.c | mnEvent_8024D4E0 | OK (0 decls, 0 nested) |
| mnevent.c | mnEvent_8024D5B0 | OK (8 decls, 0 nested) |
| mnevent.c | fn_8024E1B4 | OK (5 decls, 0 nested) |

Total: 15/15 succeeded.
Fallback rate: 0%.

## Conclusion

Pass rate is 100%, well above the 90% threshold. Ship as-is — no
tolerance loosening of `_has_decl_enclosing_error` is needed. The
tree-sitter parser handles all tested macro-heavy mn-module functions
without triggering `AstWalkError`.

## tier3-search seed-count snapshot (Phase 1)

Captured on current master (Phase 1 landed). Command used:
`python -m src.cli debug tier3-search -f <fn> --include-low-confidence --per-seed-time 0 --total-time 0`

| Function | Seed count | Notes |
|----------|------------|-------|
| fn_80248A78 | 5 | 3 insert-alias (jobj3, jobj4, jobj18, cursor_gobj), 1 type-change (cursor_row u8→u32) |
| mnVibration_80248644 | 5 | 2 insert-alias (data, child), 1 insert-alias (ptr2), 2 type-change (zero) |
| mnName_GetPageCount | 5 | all type-change seeds on count/i/extra (s32→u32/s8) |
| mnEvent_8024CE74 | 4 | all type-change seeds on count/i (int→long/short) |
| fn_802487A8 | 5 | all insert-alias seeds (sp44, var_r3_2, var_r25, temp_r31, var_r26) |

This snapshot is the baseline for future regression checks. Pre-Phase-1
seed count is recoverable by reverting to a tag before the Phase-1
merge. A change in seed count for any of these functions signals a
regression in `walk_function` output or the bridge's alias/type-change
candidate logic.
