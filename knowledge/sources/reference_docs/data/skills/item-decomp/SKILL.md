---
name: item-decomp
description: Conventions and domain knowledge for item-related code in Melee. Use when decompiling item functions (it_* prefix).
---

# Decompiling Item-Related Functions

Domain-specific knowledge for item code in `src/melee/it/`.

## Common Patterns

### Function Signatures

Most item functions follow these patterns:
- First parameter: `Item_GObj* gobj`
- Return: `void` or `bool`
- Naming: `it_<address>` or `it<ItemName>_<Purpose>`

### Accessing Item Data

Item data is accessed via `gobj->user_data`:

```c
// Idiomatic pattern - use GET_ITEM macro
Item* ip = GET_ITEM(gobj);

// NOT this (m2c default output):
Item* temp_r6 = gobj->user_data;
```

## Key Structures

### Item Variables (`ItemVars`)

Each item type has associated variables in a union at `ip->xDD4_itemVar`.

**Location**: `src/melee/it/itCharItems.h`

**Structure**: `it<Name>_ItemVars` (e.g., `itLinkArrow_ItemVars`, `itBombHei_ItemVars`)

**Problem**: m2c guesses wrong union member (often defaults to `bombhei`)

**Fix**: Use `--union-field` flag with local decomp.py (see main `/decomp` skill for full workflow):
```bash
python tools/decomp.py --no-copy it_XXXXXXXX -- --union-field Item_ItemVars:linkarrow
```

In the final source, access the correct union member:
```c
// Access the correct union member
ip->xDD4_itemVar.linkarrow.x18 = ip->pos;
// NOT: ip->xDD4_itemVar.bombhei.xDEC (wrong member)
```

### Item Attributes

Item attributes are accessed via `ip->xC4_article_data->x4_specialAttributes`.

**Location**: `src/melee/it/itCommonItems.h`

**Structure**: `it<Name>Attributes` (e.g., `itLinkArrowAttributes`, `itLipstickAttributes`)

**Problem**: `x4_specialAttributes` is `void*`, m2c can't infer type

**Fix**: Use `--void-field-type` flag with local decomp.py:
```bash
python tools/decomp.py --no-copy it_XXXXXXXX -- \
  --union-field Item_ItemVars:linkarrow \
  --void-field-type Article.x4_specialAttributes:itLinkArrowAttributes
```

In the final source, cast explicitly:
```c
Item* ip = GET_ITEM(gobj);
itLinkArrowAttributes* attrs = ip->xC4_article_data->x4_specialAttributes;
ip->x40_vel.y -= ABS(attrs->x1C);
```

### Missing Attribute Structs

If an attribute struct doesn't exist, define it based on field accesses:

```c
// In itCommonItems.h
typedef struct {
    u8 _pad[0x4];
    Vec3 x4;        // Inferred from pos->x/y/z assignments
} itLipstickAttributes;
```

## Example Workflow

### Simple Item Function

```c
// Before (m2c output)
void it_802E1C4C(HSD_GObj* arg0)
{
    void* temp_r6;
    temp_r6 = arg0->user_data;
    temp_r6->unk44 = 0.0f;
    temp_r6->unk40 = 0.0f;
    Item_80268E5C(arg0, 1, ITEM_ANIM_UPDATE);
}

// After (idiomatic)
void it_802E1C4C(Item_GObj* gobj)
{
    Item* ip = GET_ITEM(gobj);
    ip->x40_vel.y = 0.0f;
    ip->x40_vel.x = 0.0f;
    Item_80268E5C(gobj, 1, ITEM_ANIM_UPDATE);
}
```

### Function with ItemVars and Attributes

```c
void itLinkarrow_UnkMotion1_Phys(Item_GObj* gobj)
{
    Item* ip = GET_ITEM(gobj);
    itLinkArrowAttributes* attrs = ip->xC4_article_data->x4_specialAttributes;

    ip->xDD4_itemVar.linkarrow.x18 = ip->pos;
    ip->x40_vel.y -= ABS(attrs->x1C);
}
```

## Header Updates

When decompiling item functions, often need to update declarations:

```diff
// In the item's header file (e.g., itklap.h)
-/* 2E1C4C */ UNK_RET it_802E1C4C(UNK_PARAMS);
+/* 2E1C4C */ void it_802E1C4C(Item_GObj* gobj);
```

This helps m2c generate better output for subsequent functions.

## Common Item Macros

```c
GET_ITEM(gobj)      // Access Item* from Item_GObj*
ABS(x)              // Absolute value (works for floats)
FABS(x)             // Float-specific absolute value
```

## File Organization

| Path | Contents |
|------|----------|
| `it/itCharItems.h` | Character-specific item variables (ItemVars unions) |
| `it/itCommonItems.h` | Common item attributes structs |
| `it/item.h` | Main Item struct definition |
| `it/forward.h` | Forward declarations, Item_GObj typedef |
| `it/items/*.c` | Individual item implementations |
