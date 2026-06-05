# Source Standardizations

Use this reference before treating a mismatch as a last-mile MWCC trick. These
rules describe the source forms the project generally wants workers to recover:
loops instead of repeated hand-expanded blocks, typed fields instead of raw
offsets, existing header inlines instead of expanded assert paths, and project
macros instead of re-emitted `__assert` calls.

## Contents

- Operating stance
- Repeated code and loops
- Fields, accessors, and pointer arithmetic
- `jobj.h` and header inlines
- Assertions and reports
- Pragmas
- Canonical control-flow and expression forms
- Struct copies and contiguous fields
- Boundary with matching tricks

## Operating Stance

Treat these as source-standardization rules, not optional matching tricks:

- Prefer the code the original programmer likely wrote over m2c expansion.
- Prefer reviewable source even when a raw or fake form happens to match.
- Search local headers, inlines, structs, macros, and sibling functions before
  preserving generated code shape.
- Use objdiff to decide among plausible standard forms, but do not start from
  fake padding or raw offset math when a typed standard form is available.

## Repeated Code And Loops

Repeated blocks with a changing index, pointer, or counter are usually a loop.
Before preserving repeated generated blocks, try to recover the natural loop:

```c
for (i = 0; i < count; i++) {
    do_stuff(arg);
    if (cond) {
        do_thing2[i];
    }
}
```

Checklist:

- If the same block appears two or more times with `i++`, pointer advancement, or
  offset stride, test a counted `for` loop.
- If a fixed base pointer is used again after the loop, prefer indexing from the
  base over mutating the only pointer.
- Try `for`, `while`, and `do while` as codegen variants, but keep the most
  natural source form that matches.
- When testing MWCC loop unrolling behavior, use exactly `int` for the counter
  before trying typedefs such as `s32`; verify the result locally.
- If repeated semantic sequences occur in sibling functions, consider a small
  `static inline` or existing helper before copying the sequence repeatedly.

## Fields, Accessors, And Pointer Arithmetic

Raw offset arithmetic is cleanup debt when project types are known. Translate
unknown memory access in this order:

1. Named field on the actual struct.
2. Correct domain union arm such as `GroundVars`, `FighterVars`, or `ItemVars`.
3. Temporary internal struct that documents the offset hypothesis.
4. `M2C_FIELD` as a bridge when the type is still unknown.
5. Raw `u8*` offset arithmetic only when no better type is known.

Examples of preferred direction:

```c
obj->xOffset
obj->xOffset[index]
GET_ITEM(item_gobj)->xDD4_itemVar.some_item.field
```

Avoid preserving forms such as:

```c
((u8*) obj) + offset
((u8*) obj) + offset + offset2 * index
```

If the offset is known but the field is not, search nearby source, headers,
resource sheets, and past PRs. Add a temporary struct or `M2C_FIELD` rather than
teaching future workers that byte-pointer arithmetic is the desired endpoint.
When you are already touching code that contains `M2C_FIELD`, try to replace it
with a real field or field-array access before considering the cleanup done.

## `jobj.h` And Header Inlines

Expanded assertions with `"jobj.h"` often indicate an inline from
`src/sysdolphin/baselib/jobj.h`. Do not reimplement those asserts manually when
an existing inline expresses the operation.

Procedure:

1. When source or m2c output contains `__assert("jobj.h", line, ...)`, search
   `src/sysdolphin/baselib/jobj.h` for the same line number.
2. Identify the inline whose `HSD_ASSERT(line, ...)` matches.
3. Replace the expanded assert and field access with the inline call when it
   preserves semantics and matches or improves objdiff.

Example:

```c
state->translation_x[i] = HSD_JObjGetTranslationX(digit_jobj);
```

This corresponds to the `jobj.h` inline with `HSD_ASSERT(993, jobj)`.

If a header inline must be expanded for a verified codegen reason, record that as
a high-risk matching tactic with evidence. It should not be the default shape.

## Assertions And Reports

Use existing project macros before raw `__assert`:

- `HSD_ASSERT(line, cond)`
- `HSD_ASSERTMSG(line, cond, msg)`
- `HSD_ASSERTREPORT(line, cond, ...)`
- `OSReport(...)` when the original report side effect is present

Translate direct assertions into macros when the filename, line, and condition or
message match what the macro would produce:

```c
HSD_ASSERT(489, new);
```

instead of:

```c
if (!new) {
    __assert("aobj.c", 489, "new");
}
```

Do not redefine `HSD_ASSERT` or introduce standalone assert strings to force data
placement unless there is strong local evidence and the tradeoff is documented.

## Pragmas

Pragmas are a last resort, not a first-class source form. The original code was
usually written as normal C, not as a block wrapped in optimizer switches.

Before keeping pragmas such as `#pragma global_optimizer off`,
`#pragma dont_inline`, or similar codegen controls:

- Try natural source standardizations first: loops, typed fields, header inlines,
  canonical macros, local declaration order, and temp lifetime.
- Check sibling functions for a source-shape pattern that removes the need for
  the pragma.
- Verify that the pragma does not regress neighboring functions or data layout.
- Scope the pragma with `#pragma push` / `#pragma pop` when it is truly required.
- Document the objdiff evidence that made it necessary.

## Canonical Control-Flow And Expression Forms

Some generated control flow is a sign that a standard source construct was
expanded away:

- Two branches after a compact integer/range comparison may be a `switch`.
- A compare against another value followed by select-like assignment may be a
  ternary, `MIN`, `MAX`, or `CLAMP`.
- For float-zero tests, prefer the source form that expresses the real logic:
  `if (v != 0.0f)` for an explicit nonzero comparison, or `if (v)` only when
  local style and objdiff support that shorthand. These forms can swap `fcmpu`
  operand order, so verify before accepting either spelling.
- Empty branches, awkward gotos, and duplicated condition tails should be checked
  against sibling source before being accepted as final source.
- Splitting arithmetic into a named temporary is valid when it matches original
  source shape or clarifies the computation, but do not add temps only as
  unexplained register shapers unless it is documented as a matching tactic.

Use local macros such as `MIN`, `MAX`, and `CLAMP` when they are already the
subsystem style and objdiff supports the form.

## Struct Copies And Contiguous Fields

When contiguous fields are copied as a unit, first consider whether the original
source was a struct assignment:

```c
Vec3 v = src;
dst->pos = src_pos;
```

MWCC may emit different loads and stores for a struct assignment than for
individual float field assignments. Prefer struct assignment when it matches the
source meaning and local style. Expand into per-field stores only when evidence
shows the original source used separate assignments or when the struct layout is
not yet trustworthy.

## Boundary With Matching Tricks

These are not first-line source standards:

- `PAD_STACK`
- dead locals
- fake statics or data-order anchors
- broad pragmas or unscoped pragma ranges
- manual inline expansion solely to change stack size
- artificial temporaries solely to swap register order
- raw offset casts when fields or `M2C_FIELD` are available

Use those only after the standard source forms above have been checked, and
record the evidence that made the trick necessary.
