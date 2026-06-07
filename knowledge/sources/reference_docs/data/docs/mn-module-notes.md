# `mn` Module Notes For Agents

These notes capture session-level lessons for menu code. They are not a source
of truth for final names; use them to avoid known local maxima and to choose
better source-shape checks. Each section calls out known local maxima and
successful source shapes.

## `mnsnap`

Risk profile:

- Large state-machine and image/table code makes it easy to overfit register
  allocation before understanding resource flow.
- Thumbnail/image tables can look like pointer arithmetic when the source shape
  is a named table or aggregate.

Known local maxima:

- Repeating `PAD_STACK` after stack-slot drift without checking helper inlines.
- Treating relocation-only diffs as function-body problems.

Successful source shapes:

- Name image/table data and use direct array indexing where the code walks
  contiguous resources.
- Use the large-function checkpoint before editing thumbnail or report/assert
  heavy functions.

## `mnvibration`

Risk profile:

- Menu widgets often route through JObj/TObj and setter helpers.
- Repeated axis setter or text cleanup calls may be missing local/static inline
  shapes.

Known local maxima:

- Chasing direct field access for JObj child/next/parent when wrappers exist.
- Rewriting equivalent branch shapes instead of checking inline candidates.

Successful source shapes:

- Run `melee-agent patterns inlines src/melee/mn/<file>.c`.
- Compare nearby matched menu functions before inventing pointer arithmetic.

## `mnnamenew`

Risk profile:

- Name-entry code mixes glyph tables, text objects, and asset/layout data.
- Small changes to table declarations can move data and create false function
  mismatches.

Known local maxima:

- Declaring glyph or layout tables with the wrong visibility (`static` vs
  global) or wrong array/pointer shape.
- Leaving hidden strings/data as raw base-plus-offset math.

Successful source shapes:

- Inspect `symbols.txt` neighbors with `tools/symbol-layout-analyzer.py`.
- Model hidden bytes as named fields or file-local structs when they are part of
  adjacent data.
- Record blockers in `melee-agent attempts` before switching functions.
