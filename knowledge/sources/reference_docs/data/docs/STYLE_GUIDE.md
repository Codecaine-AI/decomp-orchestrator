# Melee Decompilation Style Guide

This guide documents style conventions and best practices for the doldecomp/melee project, derived from maintainer feedback on 236 PR review comments.

## Table of Contents

1. [Boolean Handling](#boolean-handling)
2. [Pointer Arithmetic](#pointer-arithmetic)
3. [Type Usage](#type-usage)
4. [Header Organization](#header-organization)
5. [Code Style](#code-style)
6. [Structs and Types](#structs-and-types)
7. [Item-Specific Conventions](#item-specific-conventions)
8. [Build and Workflow](#build-and-workflow)

---

## Boolean Handling

### Use lowercase `true`/`false`, not `TRUE`/`FALSE`

**Rule:** Always use lowercase `bool`, `true`, and `false` rather than the macro versions `BOOL`, `TRUE`, `FALSE`.

```c
// BAD
if (condition == TRUE) { ... }
return FALSE;

// GOOD
if (condition == true) { ... }
return false;
```

**Rationale:** The uppercase macros are legacy patterns that should be phased out.

---

## Pointer Arithmetic

### Avoid raw pointer arithmetic

**Rule:** Use proper struct field access or the `M2C_FIELD` macro instead of raw pointer arithmetic. Creating proper types is "arguably more useful than decompiling a given function."

```c
// BAD - unreadable pointer math
*(float*)((char*)obj + 0x84) = 1.0f;

// BETTER - use M2C_FIELD when struct fields aren't defined yet
M2C_FIELD(obj, float*, 0x84) = 1.0f;

// BEST - add the field to the struct
obj->some_float = 1.0f;
```

**Tip:** When using m2c locally, pass `--valid-syntax` and it will generate `M2C_FIELD` usages when it can't determine the proper field.

### Add struct fields instead of using offsets

**Rule:** When you see repeated access to an offset, add that field to the relevant struct rather than continuing to use pointer math.

---

## Type Usage

### Use `int` instead of `s32`

**Rule:** Use `int` (or `bool`) instead of `s32`. Use `UNK_T` instead of `M2C_UNK`.

```c
// BAD
s32 count = 0;
M2C_UNK some_value;

// GOOD
int count = 0;
UNK_T some_value;
```

### Use known SDK types

**Rule:** Use appropriate SDK types when applicable:
- `GXColor` for color data
- `Vec3` for 3D vectors
- etc.

### Avoid unnecessary casts

**Rule:** Remove unnecessary casts, especially `HSD_GObj` casts. Fix argument/parameter types instead.

```c
// BAD - casting indicates wrong types somewhere
it_8026B894((HSD_GObj*)gobj, (HSD_GObj*)ref_gobj);

// GOOD - fix the function signature
it_8026B894(gobj, ref_gobj);
```

**Tip:** m2c generates casts if you don't pass `--no-casts`.

### Return `bool` for boolean functions

**Rule:** If a function returns 0/1 or true/false, its return type should be `bool`.

---

## Header Organization

### Forward declarations vs types.h

**Rule:**
- Forward declarations go in `forward.h`
- Struct definitions go in `types.h`
- **Don't include `types.h` from headers** - use forward declarations instead

```c
// In header files - use forward declarations
#include <melee/gr/forward.h>

// In .c files - can include types.h
#include "melee/gr/types.h"
```

### Include path style

**Rule:**
- **Headers:** Use angle brackets with fully-qualified paths: `#include <melee/gr/forward.h>`
- **.c files:** Can use relative paths: `#include "ground.h"`

One quirk of the compiler is that relative includes are always relative to the .c file being compiled, not the header file containing the include.

### .static.h files

**Rule:** `.static.h` files should only be included from `.c` files because they contain static definitions.

### Include guards

**Rule:** All headers need include guards. Use `gen_header` tool to create them.

```c
#ifndef MELEE_GR_GROUND_H
#define MELEE_GR_GROUND_H

// ... content ...

#endif
```

### Local extern declarations

**Rule:** Avoid local `extern` declarations in `.c` files. Include the relevant header or create one if necessary.

```c
// BAD - local extern
extern void some_function(void);

// GOOD - include the header
#include <melee/some/header.h>
```

---

## Code Style

### Empty function style

**Rule:** Empty void functions should use `{}` not `{ return; }`.

```c
// BAD
void empty_func(void) { return; }

// GOOD
void empty_func(void) {}
```

### Stack padding

**Rule:** Use `PAD_STACK(n)` or `FORCE_PAD_STACK_n` instead of manual stack padding variables.

```c
// BAD
int _pad = 0;
(void)_pad;

// GOOD
PAD_STACK(4);
// or
FORCE_PAD_STACK_4;
```

### Array size

**Rule:** Use `ARRAY_SIZE(arr)` instead of hardcoded array sizes.

```c
// BAD
for (int i = 0; i < 25; i++) { arr[i] = 0; }

// GOOD
for (int i = 0; i < ARRAY_SIZE(arr); i++) { arr[i] = 0; }
```

### Combine declarations with initialization

**Rule:** Combine variable declarations with initialization when possible.

```c
// Acceptable but not preferred
Item* ip;
ip = gobj->user_data;

// Preferred
Item* ip = gobj->user_data;
```

### Doxygen comments

**Rule:** Use Doxygen-style comments for documentation:

```c
/// @brief Brief description
/// @param arg Description of argument
/// @returns Description of return value
int some_function(int arg);

// Or multiline:
/**
 * @brief Brief description
 * @param arg Description of argument
 */
```

---

## Structs and Types

### Struct naming

**Rule:** Don't prefix struct names with underscores.

```c
// BAD
typedef struct _MyStruct { ... } MyStruct;

// GOOD
typedef struct MyStruct MyStruct;  // in forward.h
struct MyStruct { ... };           // in types.h
```

### Don't remove placeholders

**Rule:** Don't remove stub/placeholder function declarations from headers. They maintain function order and satisfy `--require-protos`.

### GObj wrapper types

**Rule:** Don't create unnecessary GObj wrapper types - use `HSD_GObj` directly with proper `user_data` casting.

---

## Item-Specific Conventions

### ItemStateTable

**Rule:**
- Build from .data section
- Use `-1` instead of `0xFFFFFFFF`
- Infer function types from position in table

```c
// BAD
{ 0xFFFFFFFF, NULL, ... }

// GOOD
{ -1, NULL, ... }
```

### Item var structs

**Rule:** Create item-specific var structs in `itCommonItems.h` and add to `xDD4_itemVars` union. Don't reuse other items' structs.

```c
// In itCommonItems.h
typedef struct itMBall_ItemVars {
    // fields
} itMBall_ItemVars;

// Add to xDD4_itemVars union
```

---

## Build and Workflow

### Use m2c decompiler

**Rule:** Use m2c with `--valid-syntax` flag rather than writing decompiled code manually. Running through m2c often produces better results.

### Symbol renaming

**Rule:** When renaming symbols in `symbols.txt`, also rename the corresponding function definition to avoid regression reports.

### Assert filenames

**Rule:** Assert macro filenames should match the inline header source (e.g., `jobj.h`). This indicates where the inlined code comes from.

### Forbidden files

**Rule:**
- Never modify files in `/orig` directory
- Don't add files like `.build_validated`

---

## Maintainer Credits

This guide was compiled from feedback by:
- ribbanya
- r-burns
- PsiLupan
- sadkellz
- wyatt-avilla
