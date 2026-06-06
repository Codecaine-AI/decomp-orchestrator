# MWCC Pattern Book For Agents

This is a compact checklist of patterns observed in long decomp sessions. Use
it to choose the next source-shape experiment before spending time on register
allocation.

## Declaration Order

MWCC is sensitive to file-local declaration order for data and helpers. If the
assembly looks structurally right but data references move, inspect nearby
symbols with:

```bash
python tools/symbol-layout-analyzer.py <symbol-or-address>
```

Prefer modeling the original order over adding anonymous padding.

## `int` vs `s32`

Loop counters can compile differently as `int` versus `s32` because `s32` is a
typedef to `long`. If a simple loop has the right structure but wrong unrolling
or compare shape, try `int i` before rewriting the loop.

## Void Return Signatures

Wrong return types create durable mismatch noise in callers. Update headers
first, replace `UNK_RET`/`UNK_PARAMS`, then recompile callers before judging a
body mismatch.

## Pointer-Local Reuse

MWCC often preserves a natural source pointer reused across calls. Do not split
or inline every load from assembly. Try a single local pointer when repeated
loads target the same struct or object.

## Direct Global Access

For global or file-local data, source visibility affects placement and access
mode. Check `symbols.txt` scope and source `static`/`extern` declarations when
loads become SDA-relative or move across adjacent data.

## BSS-Relative Access

BSS ordering usually comes from declaration order and `static` choice. If BSS
adjacency is wrong, inspect neighboring symbols before adding `PAD_STACK` or
dummy fields.

## Varargs Stack Layout

`OSReport`, `OSPanic`, `__assert`, and `HSD_ASSERT` can perturb stack layout.
Prefer inline string literals and known assertion/report shapes. Repeated
varargs calls are flagged by:

```bash
melee-agent patterns inlines <source-file>
```

## By-Value `Vec3`

Multiple `Vec3` locals and by-value helper calls can change stack reservation.
Before padding, test declaration order and whether a small helper inline is
missing.

## Relocation-Only False Mismatches

If instruction bodies are identical and only labels/relocations differ, treat
that as a data/symbol layout problem. Use `tools/checkdiff.py` classification
and inspect symbol placement instead of rewriting equivalent C.
