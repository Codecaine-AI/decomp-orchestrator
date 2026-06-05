# Melee Decomp Tips Library

Scope: pull requests in `doldecomp/melee` created on or after 2026-03-01.

This library is based on the local dump in `decomp-orchestrator/knowledge/past_prs/current`:

- 378 PRs
- 427 issue comments
- 104 inline review comments
- 107 review summaries
- 378 PR diffs
- 0 non-empty `.diff.err` files

The review signal is small but dense. Most of the high-value guidance comes from inline review comments, PR descriptions that explain why a match worked, and diffs where the same tactics recur across many files.

## Fast Takeaways

1. Start from `m2c`, Ghidra, objdiff, and the existing source style. LLM output is useful, but reviewers repeatedly push it toward real types, real macros, and existing conventions.
2. A byte-perfect match is not automatically a good contribution. Raw pointer arithmetic, fake statics, fake data ordering, unscoped pragmas, and awkward gotos are accepted only reluctantly, if at all.
3. Most matching work is code-shape work: local variable order, temporary lifetimes, loop shape, helper extraction, inlines, stack padding, and section/literal ordering.
4. Real struct work is one of the highest-leverage improvements. Prefer named fields and domain-specific unions over offsets. Use `M2C_FIELD` as a temporary bridge when the real struct is not known.
5. Verify both the touched function and the surrounding object/TU. Several PRs matched a function but shifted literals, pragmas, or data enough to regress neighbors.

## Common Workflow

### 1. Pick Good Targets

Good PRs often start from high-fuzzy, low-risk functions and move in small batches.

Useful selection signals:

- objdiff functions already near 100%
- files with many unmigrated asm stubs but stable surrounding source
- functions where only relocations, calls, literals, or branch shape differ
- large files that can be split by assert filenames, string clusters, extab/extabindex, or data-section boundaries

Observed examples:

- [#2200](https://github.com/doldecomp/melee/pull/2200) used permuter runs on high-percent functions.
- [#2195](https://github.com/doldecomp/melee/pull/2195) mentions `tools/easy_funcs.py` for finding promising functions.
- [#2546](https://github.com/doldecomp/melee/pull/2546) used repeated floats/strings, assert filenames, and object names to infer item TU splits.
- [#2488](https://github.com/doldecomp/melee/pull/2488) used extab/extabindex and data-section separation to split sysdolphin baselib files.

### 2. Generate a Starting Point

The common toolchain is:

- `m2c`
- Ghidra
- objdiff / objdiff-cli
- decomp-permuter
- decomp.me scratches
- targeted scripts for literal, call, and frame-size mismatches
- LLMs for variant generation and cleanup, with human review

Reviewer preference is clear: begin with compiler-aware tooling, then use AI as an assistant. Do not let AI invent source structure without checking it.

Important `m2c` notes from [#2373](https://github.com/doldecomp/melee/pull/2373):

- Use `--valid-syntax --no-casts` to get cleaner `M2C_FIELD` output instead of raw offset casts.
- Use `--union-field` where the path strongly implies the active union, such as ground, fighter, and item vars.
- For ground code, `Ground_GObj` and `GET_GROUND` carry useful type information to both humans and m2c.

### 3. Iterate Against Exact Diffs

Common verification commands and reports:

- `python configure.py --require-protos`
- `ninja`
- `ninja build/.../file.o`
- `python tools/checkdiff.py <symbol>`
- `objdiff-cli diff -p . -u <object>`
- `ninja progress`
- full `main.dol: OK` checks

Do not trust a local 100% on one symbol alone. PR notes repeatedly mention adjacent fuzzy regressions, shifted data, and object-level layout changes.

[#2469](https://github.com/doldecomp/melee/pull/2469) is a useful caution: adding source in one TU can shift literals or local data and break neighboring matches even when those neighboring function bodies did not change.

### 4. Clean Before Review

The review standard is not just "does it match." Cleanups reviewers ask for repeatedly:

- replace raw pointer arithmetic with fields, `M2C_FIELD`, or temporary structs
- remove unused statics and fake ordering anchors
- use existing macros and include style
- scope pragmas with push/pop
- avoid inline assembly in normal game code
- name temporaries for what they represent
- avoid AI-written semantic comments unless verified
- explain known fake matches or remaining blockers in the PR body

## Matching Tactics

### Control Flow Shape

Changing control flow is often enough to close a match:

- rewrite `while` as `for`, or vice versa
- move allocations outside loops
- replace helper traversal with direct equivalent control flow
- turn awkward `goto next` into `continue` when natural
- flatten or unflatten branches to match original scheduling
- keep branch-local temporaries local so MWCC keeps registers close to the original

Examples:

- [#2571](https://github.com/doldecomp/melee/pull/2571) rewrote a loop and pulled allocations out.
- [#2570](https://github.com/doldecomp/melee/pull/2570) converted a loop shape.
- [#2236](https://github.com/doldecomp/melee/pull/2236) matched by replacing a near-match helper traversal with direct control flow.
- [#2257](https://github.com/doldecomp/melee/pull/2257) review pushed an unnatural loop `goto` toward `continue`.
- [#2491](https://github.com/doldecomp/melee/pull/2491) review suggested massaging control flow into a direct string reference instead of awkward flow.

Guideline: start with natural C. If the natural form does not match, change one structural feature at a time and keep the least strange version that matches.

### Local Variables and Register Allocation

MWCC register choices are sensitive to local declaration order, temporary lifetime, and branch scope.

Observed tactics:

- introduce a second local pointer to force a register copy
- declare locals in original address-materialization order
- keep temporaries inside the narrowest branch or block
- split a calculation into named local steps to change scheduling
- reorder squared-component computations to change load/multiply/add order
- use a volatile local only when needed to prevent the compiler from proving away an assert path
- cache constants such as `1.0f` or `1.0` in a local when the original keeps them in a callee-save FPR

Examples:

- [#2556](https://github.com/doldecomp/melee/pull/2556) used an extra `HSD_JObj*` local to fix allocation.
- [#2503](https://github.com/doldecomp/melee/pull/2503) discusses branch-local locals, component order, and volatile assert preservation.
- [#2507](https://github.com/doldecomp/melee/pull/2507) matched address materialization by changing local declaration order.
- [#2515](https://github.com/doldecomp/melee/pull/2515) explored FPR allocation around cached floating constants.
- [#2458](https://github.com/doldecomp/melee/pull/2458) was mostly about local lifetimes and ordering.

### Stack Layout and `PAD_STACK`

`PAD_STACK` is very common in added diff lines:

- 1,314 added lines matched `PAD_STACK`
- 205 PRs touched at least one added line with `PAD_STACK`

That frequency does not mean it is ideal. Reviewers treat it as tolerated technical debt, not a first-choice abstraction.

Use stack padding when:

- the source is otherwise natural
- the remaining mismatch is clearly stack-frame shape
- the padding is small and localized
- the PR body or surrounding code makes the tradeoff understandable

Avoid stack padding when it hides a more likely root cause:

- missing inline
- incorrect temporary lifetime
- wrong struct size or padding
- wrong array size
- wrong helper extraction
- pragma affecting too much code

Examples:

- [#2452](https://github.com/doldecomp/melee/pull/2452) fixed stack behavior with scoped temporaries and by removing an unnecessary `PAD_STACK`.
- [#2373](https://github.com/doldecomp/melee/pull/2373) review notes that repeated code with the same stack issue may indicate a missing inline.
- [#2349](https://github.com/doldecomp/melee/pull/2349) discussion treats `PAD_STACK` as acceptable for now but still fake in a strict sense.

### Inlines and Helper Extraction

Inlines are one of the strongest recurring matching tools:

- 615 added diff lines matched `inline`
- 476 added diff lines matched `static inline`
- 142 PRs added lines involving `inline`

Good inline tactics:

- restore small static wrappers that existed in the original source shape
- extract repeated local sequences into a helper when multiple functions share the same mismatch
- compare against existing files for idiomatic fighter/item/ground helper patterns
- be aware that a helper macro or inline may break a match if it changes call, load, or register behavior

Examples:

- [#2510](https://github.com/doldecomp/melee/pull/2510) restored a static inline wrapper to get MWCC to produce the right register copy.
- [#2509](https://github.com/doldecomp/melee/pull/2509) refactored a free-list pop into a static inline that mirrored an existing pattern.
- [#2380](https://github.com/doldecomp/melee/pull/2380) shows the countercase: a helper accessor can produce worse code than direct `HSD_GObjGetUserData`.
- [#2241](https://github.com/doldecomp/melee/pull/2241) review pointed toward existing `jobj.h` assert/inline behavior instead of reimplementing it.

### Structs, Unions, and Field Access

This is the biggest quality theme in review comments. Reviewers repeatedly prefer typed structure over offsets.

Preference order from review discussions:

1. Actual named field or real struct
2. Correct domain union field, such as `GroundVars`, `FighterVars`, or `ItemVars`
3. Temporary internal struct with a TODO
4. `M2C_FIELD` as a bridge
5. Raw pointer arithmetic only when no better type is known

Specific habits:

- use `GET_GROUND`, `GET_ITEM`, `GET_FIGHTER`, `GET_JOBJ`, and similar accessors
- keep domain-specific `GObj` typedefs when they communicate useful type information
- add padding to structs when byte offsets prove the field layout
- create a new union arm for each concrete item or stage variant instead of overloading a generic arm
- do not cast through `u8*` offsets when a named field is available

Examples:

- [#2373](https://github.com/doldecomp/melee/pull/2373) review repeatedly asks for `GET_GROUND`, temporary inner structs, and `M2C_FIELD` over raw offsets.
- [#2281](https://github.com/doldecomp/melee/pull/2281) review says to create new `ItemVars` union arms for distinct Pokemon types.
- [#2237](https://github.com/doldecomp/melee/pull/2237) PR notes that struct padding was the key fix for a hidden offset mismatch.
- [#2217](https://github.com/doldecomp/melee/pull/2217) review calls widespread raw pointer arithmetic future cleanup debt.

Red flags:

- `*(type*) ((u8*) ptr + offset)`
- `cmd->ptr[0] += 4` when the pointer element type makes that a 16-byte move instead of a 4-byte move
- writing past a local struct because a fake offset cast was used
- checking the address of array storage instead of the pointer stored there

### Data, Literals, and Section Ordering

Data ordering is a frequent blocker, especially `.sdata`, `.sdata2`, `.rodata`, `.sbss`, and local string/floating literal placement.

Common tactics:

- remove unused includes that introduce or reorder literals
- prefer implicit assert strings when the macro would have produced them
- use named externs when that better matches address materialization
- fix `symbols.txt` when symbol size or section placement is wrong
- delay local statics until the file is matched enough to know real ordering
- use relocation-aware diffing for wrong calls and wrong data values

Examples:

- [#2568](https://github.com/doldecomp/melee/pull/2568) matched local double constants without extra `.sdata2` statics and removed an unused include that affected layout.
- [#2469](https://github.com/doldecomp/melee/pull/2469) describes source additions shifting literal/data layout in neighboring functions.
- [#2358](https://github.com/doldecomp/melee/pull/2358) discusses hard string ordering and a fake helper used for `.sdata2` ordering.
- [#2247](https://github.com/doldecomp/melee/pull/2247) review says to fix symbol size metadata instead of inventing a static.
- [#2294](https://github.com/doldecomp/melee/pull/2294) notes wrong calls and float literals and points to `functionRelocDiffs=data_value`.

Anti-pattern: adding fake statics, explicit string literals, or helper functions only to force order without documenting that the result is fake or temporary.

### Assert and Report Macros

Use the established macros unless there is a specific reason not to:

- `HSD_ASSERT`
- `HSD_ASSERTMSG`
- `HSD_ASSERTREPORT`
- `OSReport`
- `__FILE__` where the original macro path would have supplied the filename

Reviewers objected to:

- redefining `HSD_ASSERT`
- declaring static assert strings manually when the macro should imply them
- replacing proper `OSReport` or `HSD_ASSERT` usage with raw string addresses
- passing a format string with missing varargs
- inventing assert helpers already present in headers

Examples:

- [#2433](https://github.com/doldecomp/melee/pull/2433) review says static literals do not need explicit declarations and asks for `HSD_ASSERT`.
- [#2510](https://github.com/doldecomp/melee/pull/2510) review rejects redefining `HSD_ASSERT` to force data placement.
- [#2349](https://github.com/doldecomp/melee/pull/2349) review asks not to undo proper `OSReport` and `HSD_ASSERT` usage.
- [#2241](https://github.com/doldecomp/melee/pull/2241) review points toward existing assertion behavior in headers.

### Pragmas

Pragmas are sometimes needed for matching, but they are dangerous because they can affect later functions.

Rules:

- wrap local pragma changes with `#pragma push` and `#pragma pop`
- avoid empty pragma ranges
- make sure every push has a pop
- remove copied pragmas that were only needed by an unrelated partial match
- verify adjacent functions after changing pragmas

Examples:

- [#2344](https://github.com/doldecomp/melee/pull/2344) review asks for `#pragma push`/`#pragma pop` around `dont_inline`.
- [#2231](https://github.com/doldecomp/melee/pull/2231) review flags empty ranges, missing pops, and unnecessary inline assembly.
- [#2404](https://github.com/doldecomp/melee/pull/2404) PR notes an adjacent 100% match regressed due to a stray `dont_inline` pragma and was fixed by removing it.

### Translation Unit Splits

TU boundaries are inferred from several clues:

- assert filenames
- unique string clusters
- repeated floats
- object names and struct names
- extab/extabindex ranges
- `.data`, `.sdata`, and `.sdata2` separation
- functions that must share strings or literals

Good split work verifies more than the new file:

- object-level match
- extab/extabindex placement
- data sections
- neighboring functions and sibling TUs

Examples:

- [#2546](https://github.com/doldecomp/melee/pull/2546) split item files using repeated floats, strings, and assert file names.
- [#2488](https://github.com/doldecomp/melee/pull/2488) split baselib source by extab/extabindex and data sections.
- [#2559](https://github.com/doldecomp/melee/pull/2559) comment notes that files sharing strings may need to be merged.
- [#2466](https://github.com/doldecomp/melee/pull/2466) is another resplit/linking example around fighter code.

### Constants, Macros, and Names

Reviewers prefer canonical names and existing style:

- `F32_MAX` instead of a raw max-float literal
- `ITEM_ANIM_UPDATE` over magic numeric state values
- `ABS`, `MIN`, `MAX`, `CLAMP` when those are established locally
- decimal gobj IDs where the rest of the code uses decimal
- meaningful local names such as `pos_copy` instead of `new_var`
- angle includes for existing baselib/MSL include conventions

Examples:

- [#2409](https://github.com/doldecomp/melee/pull/2409) review flags include style and generated cleanup issues.
- [#2373](https://github.com/doldecomp/melee/pull/2373) review asks for meaningful temporary names and typed accessor use.

## Review Anti-Patterns

These patterns drew reviewer pushback:

- raw pointer math over unknown structs when `M2C_FIELD`, a temporary struct, or a real field would work
- `NOT_IMPLEMENTED` stubs in submitted source
- C99 loop-variable declarations when the repo/compiler style rejects them
- fake helper functions solely for section ordering
- fake statics before a file is matched enough to know real ordering
- redefining project macros for one function
- unscoped pragmas
- inline assembly outside SDK-like code
- PR titles claiming a match when the diff does not support it
- AI-generated semantic comments that are not verified
- unsafe code that writes out of bounds or uses wrong pointer scaling just because it resembles asm
- zero-progress source bodies that do not improve objdiff

The most useful reviewer heuristic: if code matches but obviously creates future cleanup debt, either improve it now, label the tradeoff clearly, or keep iterating.

## AI-Assisted Decompilation Guidance

The recent corpus contains many AI-assisted PRs. The best pattern is human-in-the-loop:

1. Feed the model m2c/Ghidra output, current headers, relevant existing source, and objdiff/checkdiff feedback.
2. Force verifier gates before accepting writes.
3. Reject common generated slop: raw offset casts, `NOT_IMPLEMENTED`, C99 loop vars, template leaks, and no-progress bodies.
4. Ask for multiple source-shape variants rather than a single guessed semantic explanation.
5. Have a human clean names, struct fields, macros, includes, and PR notes before review.

Observed verifier ideas:

- check title-vs-diff symbol mismatch
- reject raw pointer arithmetic where project types are known
- reject stub markers
- require nonzero objdiff progress
- require `--require-protos`
- run relocation-aware diffs for wrong calls and float literals

Examples:

- [#2373](https://github.com/doldecomp/melee/pull/2373) explains an agentic pipeline using m2c, Ghidra, objdiff, and decomp-permuter.
- [#2409](https://github.com/doldecomp/melee/pull/2409) is candid that AI generated lots of cleanup work and the human remained in the loop.
- [#2495](https://github.com/doldecomp/melee/pull/2495) notes verifier gates for template leaks, zero-progress objdiff, and title mismatch.
- [#2294](https://github.com/doldecomp/melee/pull/2294) suspects bad matches came from not starting with m2c or not diffing relocations by data value.

## Practical Checklist

### Before Attempting a Function

- Check current objdiff percent and whether neighbors are stable.
- Search for similar functions in the same subsystem.
- Identify active unions and known struct fields.
- Look for assert filenames, OSReport strings, literals, and data references.
- Decide whether the target is a function match, fuzzy improvement, TU split, or type cleanup.

### While Matching

- Start from valid m2c/Ghidra output, then simplify toward local style.
- Change one dimension at a time: control flow, local order, helper extraction, pragma, data declaration.
- Watch register allocation after every local lifetime or declaration-order change.
- Treat stack padding as a last-mile tool, not proof that the source shape is right.
- If repeated functions share the same mismatch, suspect an inline or helper.
- If offsets are hard to explain, define a temporary struct instead of piling up casts.

### Before Opening a PR

- Run `python configure.py --require-protos`.
- Build at least the touched object and preferably the full project.
- Run `tools/checkdiff.py` or objdiff for every claimed symbol.
- Check adjacent functions and the object/TU for regressions.
- Confirm no `NOT_IMPLEMENTED`, raw AI template text, or fake comments remain.
- Explain remaining fake-match tradeoffs in the PR description.
- Include the exact match/fuzzy numbers and commands used.

### When Blocked

- Try a different loop form.
- Move a local into or out of a branch.
- Reorder declarations to affect address-materialization order.
- Split or combine temporaries.
- Try a small static inline that mirrors repeated code.
- Check whether the mismatch is actually data relocation, not instruction shape.
- Verify struct size and padding with raw bytes if objdiff display looks misleading.
- Ask whether TU boundaries or shared string/literal ownership are wrong.
- Use permuter for syntax variants once the source is semantically close.

## Frequency Notes From Added Diff Lines

These counts are not endorsements; they show which mechanisms appeared often in added lines:

- `GET_*` accessors: 2,690 added lines across 187 PRs
- pointer-math-like patterns: 2,566 added lines across 134 PRs
- `PAD_STACK`: 1,314 added lines across 205 PRs
- `extern`: 929 added lines across 140 PRs
- sdata/sdata2/order-related strings: 915 added lines across 69 PRs
- `inline`: 615 added lines across 142 PRs
- `HSD_ASSERT` / assert-like calls: 561 added lines across 122 PRs
- `M2C_FIELD`: 496 added lines across 11 PRs
- `goto`: 482 added lines across 75 PRs
- `#pragma`: 445 added lines across 65 PRs
- `OSReport`: 237 added lines across 67 PRs
- `ABS` / `MIN` / `MAX` / `CLAMP`: 270 added lines across 47 PRs
- `NOT_IMPLEMENTED`: 3 added lines across 2 PRs

Interpretation:

- Accessors, asserts, inlines, and stack padding are normal parts of this repo's matching vocabulary.
- Pointer math is common, but review comments consistently push it toward real types.
- `M2C_FIELD` appears in fewer PRs than raw pointer math, but reviewers often prefer it as an intermediate representation.
- `NOT_IMPLEMENTED` is rare in added source and should be rejected by automated gates.

## Open Research Areas

These are recurring hard problems worth documenting more deeply later:

- When exactly MWCC chooses one GPR/FPR allocation over another.
- A repo-specific guide for common `GroundVars`, `FighterVars`, and `ItemVars` union-field mappings.
- Practical recipes for `.sdata2` ordering without fake helper functions.
- When a fake match is acceptable and how it should be annotated.
- How to detect wrong calls and wrong float literals automatically in CI.
- Better rules for stack padding: when it is harmless, when it hides a missing inline, and when it should block review.
- A catalog of local include conventions and canonical macros by subsystem.
