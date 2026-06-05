## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/lb/lbcardnew.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864310
Author: Copilot

This code can write past `alloc_mem`: the loop can accept up to 0x7F matching entries, but the allocation is a fixed 0x5F4 bytes (which likely holds far fewer than 127 `SaveEntry`s depending on padding/alignment). Additionally, `entry_list` points into `alloc_mem`, so freeing it immediately invalidates the built list (even if currently unused, it becomes a footgun if later logic is added). Fix by sizing the allocation as `max_entries * sizeof(struct SaveEntry)` (or allocating per-entry), and only freeing after all consumers are done; also enforce a hard capacity check before `current_entry += 1`.

Hunk:
```diff
@@ -617,6 +617,74 @@ int lb_8001B068(void)
 /// Stubbing it out for now
 int lb_8001B14C(void)
 {
+    struct SaveEntry {
+        struct SaveEntry* next;
+        s32 save_id;
+        s16 slot_idx;
+        u16 banner_type;
+    };
+
+    DVDDiskID* disk_id;
+    struct SaveEntry* alloc_mem;
+    struct SaveEntry* entry_list;
+    struct SaveEntry* current_entry;
+    struct SaveEntry** insert_ptr;
+    int slot_idx;
+    int entry_count;
+    int i;
+    CARDStat card_stat;
+
+    entry_list = NULL;
+    disk_id = DVDGetCurrentDiskID();
+    lb_80432A68.x8AC = 0;
+
+    if (lb_80432A68.unk_24 != NULL) {
+        *lb_80432A68.unk_24 = lb_80432A68.unused_bytes / 8192;
+    }
+
+    if (lb_80432A68.unk_28 != NULL) {
+        *lb_80432A68.unk_28 = lb_80432A68.unused_files;
+    }
+
+    alloc_mem = HSD_MemAlloc(0x5F4);
+    current_entry = alloc_mem;
+
+    entry_count = 0;
+
+    for (slot_idx = 0; slot_idx < 0x7F; slot_idx++) {
+        if (CARDGetStatus(lb_80432A68.chan, slot_idx, &card_stat) == 0) {
+            if (strncmp((char*) &card_stat.fileName[0x38 - 0x34],
+                        (char*) &disk_id->company[0], 2) == 0)
+            {
+                if (strncmp((char*) &card_stat.fileName[0x34 - 0x34],
+                            (char*) &disk_id->gameName[0], 4) == 0)
+                {
+                    if (__ctype_map[card_stat.fileName[0]] & 0x10) {
+                        current_entry->save_id =
+                            strtoul((char*) &card_stat.fileName[0], NULL, 10);
+                        current_entry->slot_idx = slot_idx;
+                        current_entry->banner_type =
+                            card_stat.bannerFormat >> 13;
+
+                        // Insert into sorted list
+                        insert_ptr = &entry_list;
+                        while (*insert_ptr != NULL &&
+                               (*insert_ptr)->save_id > current_entry->save_id)
+                        {
+                            insert_ptr = &(*insert_ptr)->next;
+                        }
+                        current_entry->next = *insert_ptr;
+                        *insert_ptr = current_entry;
+
+                        entry_count++;
+                        current_entry += 1;
+                    }
+                }
+            }
+        }
+    }
+
+    HSD_Free(alloc_mem);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/it/it_2725.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864352
Author: Copilot

`cmd->ptr[0] += 4` advances by 4 *elements* (16 bytes) because `ptr[0]` is a `u32*`. Based on the surrounding command parsing patterns (and the previous `cmd->x8 = cmd->x8 + 4` style), this should advance by 4 bytes (one `u32`) rather than 16 bytes. Fix by incrementing by 1 `u32` element or by advancing via a byte pointer cast.

Hunk:
```diff
@@ -8608,200 +8608,202 @@ void it_80278F2C(Item_GObj* item_gobj, CommandInfo* cmd)
 {
     Vec3 sp20;
     Vec3 sp14;
+    u16* data_ptr;
+    u32 temp_r5;
     u16 temp_r9;
-    // s32 temp_r5;
-    PAD_STACK(28);
+    s16 temp_r10;
 
-    ++cmd->u;
-    // temp_r5 = cmd->x8_bits->x0 & 0x3FF;
-    // temp_r9 = cmd->x8_bits->x0;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    ++cmd->u;
-    // sp20.x = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp20.x = 0.003906f * (((f32) cmd->x8_bits->x0 - it_804DC798) -
-    // it_804DC7A0);
-    // sp20.y = 0.003906f * (f32) cmd->x8_bits->x2;
-    ++cmd->u;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    // sp20.z = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp14.x = 0.003906f * (f32) cmd->x8_bits->x2;
-    ++cmd->u;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    // sp14.y = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp14.z = 0.003906f * (f32) cmd->x8_bits->x2;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    ++cmd->u;
+    data_ptr = (u16*) cmd->ptr[0];
+    temp_r5 = data_ptr[0] & 0x3FF;
+    temp_r9 = data_ptr[0];
+    cmd->ptr[0] = (u32*) (data_ptr + 2);
 
-    // void it_80278800(Item_GObj* item_gobj, s32 ef_id, s32 arg2, Vec3* arg3,
-    // Vec3* arg4, s32 arg5, f32 arg6)
-    //  it_80278800((Item_GObj*) temp_r9, temp_r6->x0 & 0x3FF, &sp20, &sp14, 0,
-    //  temp_r9, temp_r10_2, (f32) (s32) (f32) temp_r10->x2, 0.003906f);
-    // it_80278800(item_gobj, temp_r9, temp_r5, &sp20, &sp14, 0, 0.003906f);
+    temp_r10 = ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp20.x = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp20.y = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp20.z = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp14.x = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp14.y = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp14.z = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    it_80278800(item_gobj, temp_r9, temp_r5, &sp20, &sp14, 0, (f32) temp_r10);
 }
 
 void it_802790C0(Item_GObj* item_gobj, CommandInfo* cmd)
 {
-#if 0
-    HitCapsule* hitcapsule;
-    s32 temp_r31;
-    u32 temp_r28;
-    u32 temp_r5_2;
-    u32 var_r4;
     Item* item;
-    PAD_STACK(12);
+    u32* data;
+    u32 hitbox_id;
+    HitCapsule* hitbox;
+    u32 priority;
+    u32 bone_id;
+    void* hitbox_base;
 
-    item = GET_ITEM((HSD_GObj*) item_gobj);
-    // var_r4 = ((u16) cmd->x8_bits->x0 >> 7U) & 7;
-    hitcapsule = &item->x5D4_hitboxes[var_r4].hit;
-    temp_r28 = var_r4;
-    // temp_r5_2 = ((u8) cmd->x8_bits->x0 >> 4U) & 7;
-    if ((hitcapsule->state == HitCapsule_Disabled) ||
-        (hitcapsule->x4 != temp_r5_2))
-    {
-        hitcapsule->x4 = temp_r5_2;
-        hitcapsule->state = HitCapsule_Enabled;
+    data = cmd->ptr[0];
+    item = item_gobj->user_data;
+    hitbox_id = (*(u16*) data >> 7) & 7;
+    hitbox_base = &item->x5D4_hitboxes[hitbox_id];
+    hitbox = &item->x5D4_hitboxes[hitbox_id].hit;
+    priority = (*(u8*) ((u8*) data + 1) >> 4) & 7;
+
+    if (hitbox->state == 0 || hitbox->x4 != priority) {
+        hitbox->x4 = priority;
+        hitbox->state = 1;
         item->xDC8_word.flags.x16 = 1;
         item->xDAA_flag.b2 = 0;
-        it_8026FCF8(item, hitcapsule);
+        it_8026FCF8(item, hitbox);
     }
-    // temp_r31 = ((u32) cmd->x8_bits->x0 >> 0xDU) & S8_MAX;
-    if (temp_r31 != 0U) {
-        if (!item->xBBC_dynamicBoneTable) {
-            OSReport((char*) &it_803F22E8);
-            __assert((char*) &it_803F2300, 0x8BU, (char*) &it_804D51C0);
+
+    bone_id = (*(u32*) data >> 13) & 0x7F;
+    if (bone_id != 0) {
+        if (item->xBBC_dynamicBoneTable == NULL) {
+            OSReport("item can't set attack!\n");
+            __assert("itanimlist.c", 0x8B, "0");
         }
-        hitcapsule->jobj = item->xBBC_dynamicBoneTable->bones[temp_r31];
+        hitbox->jobj = item->xBBC_dynamicBoneTable->bones[bone_id];
     } else {
-        hitcapsule->jobj = item_gobj->hsd_obj;
+        hitbox->jobj = item_gobj->hsd_obj;
+    }
+
+    it_80272460(hitbox,
+                (u32) (item->xC3C *
+                       ((*(u16*) ((u8*) data + 2) & 0x1FFF) * item->xC40)),
+                item_gobj);
+
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->scale = 0.003906f * (f32) (*(u16*) cmd->ptr[0]);
+    item->x3C = hitbox->scale;
+    it_80275594(item_gobj, hitbox_id, 1.0f / item->scl);
+
+    hitbox->b_offset.x = 0.003906f * (f32) (*(s16*) ((u8*) cmd->ptr[0] + 2));
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->b_offset.y = 0.003906f * (f32) (*(s16*) cmd->ptr[0]);
+    hitbox->b_offset.z = 0.003906f * (f32) (*(s16*) ((u8*) cmd->ptr[0] + 2));
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->kb_angle = (*(u16*) cmd->ptr[0] >> 7) & 0x1FF;
+    hitbox->x24 = (*(u32*) cmd->ptr[0] >> 14) & 0x1FF;
+    hitbox->x28 = (*(u16*) ((u8*) cmd->ptr[0] + 2) >> 5) & 0x1FF;
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x40);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->x2C = (*(u16*) cmd->ptr[0] >> 7) & 0x1FF;
+    hitbox->element = (*(u8*) ((u8*) cmd->ptr[0] + 1) >> 2) & 0x1F;
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 6) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x40);
+
+    hitbox->x34 = (s32) ((*(u32*) cmd->ptr[0] << 15) & 0xFF800000) >> 24;
+    hitbox->sfx_severity = (*(u16*) ((u8*) cmd->ptr[0] + 2) >> 6) & 7;
+    hitbox->sfx_kind = (*(u8*) ((u8*) cmd->ptr[0] + 3) >> 2) & 0xF;
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x20) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 3) << 5) & 0x20);
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x10) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 3) << 3) & 0x10);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    *(u16*) ((u8*) hitbox_base + 0x40) =
+        (*(u16*) ((u8*) hitbox_base + 0x40) & ~0xFF0) |
+        ((*(u8*) cmd->ptr[0] << 4) & 0xFF0);
+
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~8) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 8);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~4) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 4);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~2) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 2);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~1) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 1);
+
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x40) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x40);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x20) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x20);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x10) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x10);
+
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~8) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 8);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~4) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 4);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~2) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 2);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~1) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 1);
+
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) << 4) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x138) =
+        (*(u8*) ((u8*) hitbox_base + 0x138) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) << 5) & 0x80);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x20);
+
+    if (HSD_GObj_804D7838 != NULL && (u8) HSD_GObj_804D7838->s_link > 11) {
+        it_8027129C(item_gobj, hitbox_id);
     }
-    // it_80272460(hitcapsule,
-    //             item->xC3C * ((cmd->x8_bits->x2 & 0x1FFF) * item->xC40),
-    //             item_gobj);
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->scale = 0.003906f * (f32) (u16) cmd->x8_bits->x0;
-    item->x3C = hitcapsule->scale;
-    // it_80275594(item_gobj, temp_r28, temp_r5, it_804DC7A8 / item->scl,
-    // 0.003906f); it_80275594(item_gobj, temp_r28, cmd->x8_bits, 1.0f /
-    // item->scl, 0.003906f);
-    it_80275594(item_gobj, temp_r28, 1.0f / item->scl);
-    // hitcapsule->b_offset.x = 0.003906f * (f32) (s16) cmd->x8_bits->x2;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->b_offset.y = 0.003906f * (f32) (s16) cmd->x8_bits->x0;
-    // hitcapsule->b_offset.z = 0.003906f * (f32) (s16) cmd->x8_bits->x2;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->kb_angle = ((u16) cmd->x8_bits->x0 >> 7U) & 0x1FF;
-    // hitcapsule->x24 = ((u32) cmd->x8_bits->x0 >> 14U) & 0x1FF;
-    hitcapsule->x24 = ((u32) cmd->x8_bits->x0 >> 14U) & 0x1FF;
-    // hitcapsule->x28 = ((u16) cmd->x8_bits->x2 >> 5U) & 0x1FF;
-    hitcapsule->x43_b1 = 1;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x2C = ((u16) cmd->x8_bits->x0 >> 7U) & 0x1FF;
-    hitcapsule->element = ((u8) cmd->x8_bits->x0 >> 2U) & 0x1F;
-    // hitcapsule->unk40 = (u8) ((hitcapsule->unk40 & ~0x80) |
-    // ((cmd->x8_bits->unk1 << 6) & 0x80));
-    hitcapsule->x40_b0 = cmd->x8_bits->unk6.unk1;
-    hitcapsule->x40_b1 = 0;
-    hitcapsule->x34 = (s32) ((cmd->x8_bits->x0 << 0xF) & 0xFF800000) >> 0x18;
-    // hitcapsule->sfx_severity = ((u16) cmd->x8_bits->x2 >> 6U) & 7;
-    // hitcapsule->sfx_kind = ((u8) cmd->x8[0]->unk3 >> 2U) & 0xF;
-    // hitcapsule->sfx_kind = ((u8) cmd->x8_bits->x2 >> 2U) & 0xF;
-    // hitcapsule->sfx_kind = cmd->x8_bits->x3_b5;
-    // hitcapsule->x40_b2 = (u8) ((hitcapsule->x40_b2 & ~0x20) |
-    // ((cmd->x8_bits->unk3 << 5) & 0x20));
-    // hitcapsule->x40_b2 = cmd->x8_bits->x3_b7;
-    // hitcapsule->x40_b3 = (u8) ((hitcapsule->x40_b3 & ~0x10) |
-    // ((cmd->x8_bits->unk3 << 3) & 0x10));
-    // hitcapsule->x40_b3 = cmd->x8_bits->x3_b6;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x40_b4 = ((u8) cmd->x8_bits->x0 << 4) & 0xFF0;
-    // hitcapsule->x41_b4 = cmd->x8_bits->x0_b7;
-    // hitcapsule->x41_b4 = (u8) ((hitcapsule->x41_b4 & ~8) | (((u8)
-    // cmd->x8_bits->unk1 >> 4U) & 8)); hitcapsule->x41_b4 = ((u8)
-    // cmd->x8_bits->x0 >> 4U) & 8;
-    // hitcapsule->x41_b4 = cmd->x8_bits->x1_b0;
-    // hitcapsule->x41_b5 = (u8) ((hitcapsule->x41_b5 & ~4) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 4)); hitcapsule->x41_b5 = ((u8)
-    // cmd->x8_bits->x0 >> 4U) & 4;
-    // hitcapsule->x41_b5 = cmd->x8_bits->x1_b1;
-    // hitcapsule->x41_b6 = (u8) ((hitcapsule->x41_b6 & ~2) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 2));
-    // hitcapsule->x41_b6 = cmd->x8_bits->x1_b2;
-    // hitcapsule->x41_b6 = cmd->x8_bits->x1_b6;
-    // hitcapsule->x41_b7 = (u8) ((hitcapsule->x41_b7 & ~1) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 1));
-    // hitcapsule->x41_b7 = cmd->x8_bits->x1_b3;
-    // hitcapsule->x41_b7 = cmd->x8_bits->x1_b7;
-    // hitcapsule->x42_b0 = (u8) ((hitcapsule->x42_b0 & ~0x80) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x80));
-    // hitcapsule->x42_b0 = cmd->x8_bits->x1_b4;
-    // hitcapsule->x42_b0 = cmd->x8_bits->x1_b0;
-    // hitcapsule->x42_b1 = (u8) ((hitcapsule->x42_b1 & ~0x40) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x40));
-    // hitcapsule->x42_b1 = cmd->x8_bits->x1_b5;
-    // hitcapsule->x42_b1 = cmd->x8_bits->x1_b1;
-    // hitcapsule->x42_b2 = (u8) ((hitcapsule->x42_b2 & ~0x20) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x20));
-    // hitcapsule->x42_b2 = cmd->x8_bits->x1_b6;
-    // hitcapsule->x42_b2 = cmd->x8_bits->x1_b2;
-    // hitcapsule->x42_b3 = (u8) ((hitcapsule->x42_b3 & ~0x10) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x10));
-    // hitcapsule->x42_b3 = cmd->x8_bits->x1_b7;
-    // hitcapsule->x42_b4 = cmd->x8_bits->x2_b0;
-    // hitcapsule->x42_b5 = cmd->x8_bits->x2_b1;
-    // hitcapsule->x42_b6 = cmd->x8_bits->x2_b2;
-    // hitcapsule->x42_b7 = cmd->x8_bits->x2_b3;
-    // hitcapsule->x43 = cmd->x8_bits->x2;
-    // hitcapsule->x43_b0 = cmd->x8_bits->x2_b4;
-    // hitcapsule->hit_grabbed_victim_only = (u8)
-    // ((hitcapsule->hit_grabbed_victim_only & ~0x80) | (((u8) cmd->x8_bits->x0
-    // << 5) & 0x80)); hitcapsule->hit_grabbed_victim_only = ((u8)
-    // cmd->x8_bits->x0 << 5) & 0x80; hitcapsule->hit_grabbed_victim_only =
-    // cmd->x8_bits->x2_b5;
-    // (&item->x5D4_hitboxes[var_r4])->x138 = cmd->x8_bits->x2_b5;
-    // item->x5D4_hitboxes[var_r4].x138 = (u8) cmd->x8_bits->x2;
-    // cmd->unk8 = (void* ) (cmd->unk8 + 4);
-    // cmd->x8[0] = cmd->x8[1];
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x43_b2 = 1;
-    if (HSD_GObj_804D7838 && ((u8) HSD_GObj_804D7838->s_link > 11U)) {
-        it_8027129C(item_gobj, temp_r28);
-    }
-#endif
 }
 
 void it_80279544(Item_GObj* item_gobj, CommandInfo* cmd)
 {
-    // struct it_278F_struct_1B* temp_r4;
-    Item* item;
-    // PAD_STACK(4);
+    Item* temp_r5;
+    u32* temp_r4;
 
-    // temp_r4 = &((struct it_278F_struct_1A*) cmd)->x8[0];
-    item = GET_ITEM((HSD_GObj*) item_gobj);
-    // item = item_gobj->user_data;
-    // it_80272460(
-    // &item->x5D4_hitboxes[(cmd->x8_bits->x0 >> 7U) & 7].hit,
-    // (s32) (u32) (item->xC3C *
-    // ((f32) ((u16) cmd->x8_bits->x2 & 0x1FFF) * item->xC40)),
-    // item_gobj);
-    // cmd->unk8 = (void* ) (cmd->unk8 + 4);
-    // ((struct it_278F_struct_1A*) cmd)->x8[0] = ((struct it_278F_struct_1A*)
-    // cmd)->x8[1];
-    // cmd->x8 = cmd->x8 + 4;
+    temp_r4 = cmd->ptr[0];
+    temp_r5 = item_gobj->user_data;
+    it_80272460(
+        &temp_r5->x5D4_hitboxes[((u16) temp_r4[0] >> 7U) & 7].hit,
+        (u32) (temp_r5->xC3C * ((f32) (temp_r4[1] & 0x1FFF) * temp_r5->xC40)),
+        item_gobj);
+    cmd->ptr[0] += 4;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/it/it_2725.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864375
Author: Copilot

`cmd->ptr[0] = cmd->ptr[0] + 4` has the same issue as above: it advances by 16 bytes, not 4 bytes. This will desynchronize command stream decoding and can cause out-of-bounds reads. Fix by advancing by one `u32`, or using a byte-pointer increment of 4.

Hunk:
```diff
@@ -8608,200 +8608,202 @@ void it_80278F2C(Item_GObj* item_gobj, CommandInfo* cmd)
 {
     Vec3 sp20;
     Vec3 sp14;
+    u16* data_ptr;
+    u32 temp_r5;
     u16 temp_r9;
-    // s32 temp_r5;
-    PAD_STACK(28);
+    s16 temp_r10;
 
-    ++cmd->u;
-    // temp_r5 = cmd->x8_bits->x0 & 0x3FF;
-    // temp_r9 = cmd->x8_bits->x0;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    ++cmd->u;
-    // sp20.x = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp20.x = 0.003906f * (((f32) cmd->x8_bits->x0 - it_804DC798) -
-    // it_804DC7A0);
-    // sp20.y = 0.003906f * (f32) cmd->x8_bits->x2;
-    ++cmd->u;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    // sp20.z = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp14.x = 0.003906f * (f32) cmd->x8_bits->x2;
-    ++cmd->u;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    // sp14.y = 0.003906f * (f32) cmd->x8_bits->x0;
-    // sp14.z = 0.003906f * (f32) cmd->x8_bits->x2;
-    // cmd->x8 = (char*) (&cmd->x8 + 4);
-    ++cmd->u;
+    data_ptr = (u16*) cmd->ptr[0];
+    temp_r5 = data_ptr[0] & 0x3FF;
+    temp_r9 = data_ptr[0];
+    cmd->ptr[0] = (u32*) (data_ptr + 2);
 
-    // void it_80278800(Item_GObj* item_gobj, s32 ef_id, s32 arg2, Vec3* arg3,
-    // Vec3* arg4, s32 arg5, f32 arg6)
-    //  it_80278800((Item_GObj*) temp_r9, temp_r6->x0 & 0x3FF, &sp20, &sp14, 0,
-    //  temp_r9, temp_r10_2, (f32) (s32) (f32) temp_r10->x2, 0.003906f);
-    // it_80278800(item_gobj, temp_r9, temp_r5, &sp20, &sp14, 0, 0.003906f);
+    temp_r10 = ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp20.x = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp20.y = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp20.z = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp14.x = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    sp14.y = 0.003906f * (f32) ((s16*) cmd->ptr[0])[0];
+    sp14.z = 0.003906f * (f32) ((s16*) cmd->ptr[0])[1];
+    cmd->ptr[0] = (u32*) ((s16*) cmd->ptr[0] + 2);
+
+    it_80278800(item_gobj, temp_r9, temp_r5, &sp20, &sp14, 0, (f32) temp_r10);
 }
 
 void it_802790C0(Item_GObj* item_gobj, CommandInfo* cmd)
 {
-#if 0
-    HitCapsule* hitcapsule;
-    s32 temp_r31;
-    u32 temp_r28;
-    u32 temp_r5_2;
-    u32 var_r4;
     Item* item;
-    PAD_STACK(12);
+    u32* data;
+    u32 hitbox_id;
+    HitCapsule* hitbox;
+    u32 priority;
+    u32 bone_id;
+    void* hitbox_base;
 
-    item = GET_ITEM((HSD_GObj*) item_gobj);
-    // var_r4 = ((u16) cmd->x8_bits->x0 >> 7U) & 7;
-    hitcapsule = &item->x5D4_hitboxes[var_r4].hit;
-    temp_r28 = var_r4;
-    // temp_r5_2 = ((u8) cmd->x8_bits->x0 >> 4U) & 7;
-    if ((hitcapsule->state == HitCapsule_Disabled) ||
-        (hitcapsule->x4 != temp_r5_2))
-    {
-        hitcapsule->x4 = temp_r5_2;
-        hitcapsule->state = HitCapsule_Enabled;
+    data = cmd->ptr[0];
+    item = item_gobj->user_data;
+    hitbox_id = (*(u16*) data >> 7) & 7;
+    hitbox_base = &item->x5D4_hitboxes[hitbox_id];
+    hitbox = &item->x5D4_hitboxes[hitbox_id].hit;
+    priority = (*(u8*) ((u8*) data + 1) >> 4) & 7;
+
+    if (hitbox->state == 0 || hitbox->x4 != priority) {
+        hitbox->x4 = priority;
+        hitbox->state = 1;
         item->xDC8_word.flags.x16 = 1;
         item->xDAA_flag.b2 = 0;
-        it_8026FCF8(item, hitcapsule);
+        it_8026FCF8(item, hitbox);
     }
-    // temp_r31 = ((u32) cmd->x8_bits->x0 >> 0xDU) & S8_MAX;
-    if (temp_r31 != 0U) {
-        if (!item->xBBC_dynamicBoneTable) {
-            OSReport((char*) &it_803F22E8);
-            __assert((char*) &it_803F2300, 0x8BU, (char*) &it_804D51C0);
+
+    bone_id = (*(u32*) data >> 13) & 0x7F;
+    if (bone_id != 0) {
+        if (item->xBBC_dynamicBoneTable == NULL) {
+            OSReport("item can't set attack!\n");
+            __assert("itanimlist.c", 0x8B, "0");
         }
-        hitcapsule->jobj = item->xBBC_dynamicBoneTable->bones[temp_r31];
+        hitbox->jobj = item->xBBC_dynamicBoneTable->bones[bone_id];
     } else {
-        hitcapsule->jobj = item_gobj->hsd_obj;
+        hitbox->jobj = item_gobj->hsd_obj;
+    }
+
+    it_80272460(hitbox,
+                (u32) (item->xC3C *
+                       ((*(u16*) ((u8*) data + 2) & 0x1FFF) * item->xC40)),
+                item_gobj);
+
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->scale = 0.003906f * (f32) (*(u16*) cmd->ptr[0]);
+    item->x3C = hitbox->scale;
+    it_80275594(item_gobj, hitbox_id, 1.0f / item->scl);
+
+    hitbox->b_offset.x = 0.003906f * (f32) (*(s16*) ((u8*) cmd->ptr[0] + 2));
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->b_offset.y = 0.003906f * (f32) (*(s16*) cmd->ptr[0]);
+    hitbox->b_offset.z = 0.003906f * (f32) (*(s16*) ((u8*) cmd->ptr[0] + 2));
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->kb_angle = (*(u16*) cmd->ptr[0] >> 7) & 0x1FF;
+    hitbox->x24 = (*(u32*) cmd->ptr[0] >> 14) & 0x1FF;
+    hitbox->x28 = (*(u16*) ((u8*) cmd->ptr[0] + 2) >> 5) & 0x1FF;
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x40);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    hitbox->x2C = (*(u16*) cmd->ptr[0] >> 7) & 0x1FF;
+    hitbox->element = (*(u8*) ((u8*) cmd->ptr[0] + 1) >> 2) & 0x1F;
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 6) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x40);
+
+    hitbox->x34 = (s32) ((*(u32*) cmd->ptr[0] << 15) & 0xFF800000) >> 24;
+    hitbox->sfx_severity = (*(u16*) ((u8*) cmd->ptr[0] + 2) >> 6) & 7;
+    hitbox->sfx_kind = (*(u8*) ((u8*) cmd->ptr[0] + 3) >> 2) & 0xF;
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x20) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 3) << 5) & 0x20);
+    *(u8*) ((u8*) hitbox_base + 0x40) =
+        (*(u8*) ((u8*) hitbox_base + 0x40) & ~0x10) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 3) << 3) & 0x10);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    *(u16*) ((u8*) hitbox_base + 0x40) =
+        (*(u16*) ((u8*) hitbox_base + 0x40) & ~0xFF0) |
+        ((*(u8*) cmd->ptr[0] << 4) & 0xFF0);
+
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~8) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 8);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~4) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 4);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~2) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 2);
+    *(u8*) ((u8*) hitbox_base + 0x41) =
+        (*(u8*) ((u8*) hitbox_base + 0x41) & ~1) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) >> 4) & 1);
+
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x40) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x40);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x20) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x20);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~0x10) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 1) << 4) & 0x10);
+
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~8) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 8);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~4) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 4);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~2) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 2);
+    *(u8*) ((u8*) hitbox_base + 0x42) =
+        (*(u8*) ((u8*) hitbox_base + 0x42) & ~1) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) >> 4) & 1);
+
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) << 4) & 0x80);
+    *(u8*) ((u8*) hitbox_base + 0x138) =
+        (*(u8*) ((u8*) hitbox_base + 0x138) & ~0x80) |
+        ((*(u8*) ((u8*) cmd->ptr[0] + 2) << 5) & 0x80);
+    cmd->ptr[0] = (u32*) ((u8*) cmd->ptr[0] + 4);
+
+    *(u8*) ((u8*) hitbox_base + 0x43) =
+        (*(u8*) ((u8*) hitbox_base + 0x43) & ~0x20);
+
+    if (HSD_GObj_804D7838 != NULL && (u8) HSD_GObj_804D7838->s_link > 11) {
+        it_8027129C(item_gobj, hitbox_id);
     }
-    // it_80272460(hitcapsule,
-    //             item->xC3C * ((cmd->x8_bits->x2 & 0x1FFF) * item->xC40),
-    //             item_gobj);
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->scale = 0.003906f * (f32) (u16) cmd->x8_bits->x0;
-    item->x3C = hitcapsule->scale;
-    // it_80275594(item_gobj, temp_r28, temp_r5, it_804DC7A8 / item->scl,
-    // 0.003906f); it_80275594(item_gobj, temp_r28, cmd->x8_bits, 1.0f /
-    // item->scl, 0.003906f);
-    it_80275594(item_gobj, temp_r28, 1.0f / item->scl);
-    // hitcapsule->b_offset.x = 0.003906f * (f32) (s16) cmd->x8_bits->x2;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->b_offset.y = 0.003906f * (f32) (s16) cmd->x8_bits->x0;
-    // hitcapsule->b_offset.z = 0.003906f * (f32) (s16) cmd->x8_bits->x2;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->kb_angle = ((u16) cmd->x8_bits->x0 >> 7U) & 0x1FF;
-    // hitcapsule->x24 = ((u32) cmd->x8_bits->x0 >> 14U) & 0x1FF;
-    hitcapsule->x24 = ((u32) cmd->x8_bits->x0 >> 14U) & 0x1FF;
-    // hitcapsule->x28 = ((u16) cmd->x8_bits->x2 >> 5U) & 0x1FF;
-    hitcapsule->x43_b1 = 1;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x2C = ((u16) cmd->x8_bits->x0 >> 7U) & 0x1FF;
-    hitcapsule->element = ((u8) cmd->x8_bits->x0 >> 2U) & 0x1F;
-    // hitcapsule->unk40 = (u8) ((hitcapsule->unk40 & ~0x80) |
-    // ((cmd->x8_bits->unk1 << 6) & 0x80));
-    hitcapsule->x40_b0 = cmd->x8_bits->unk6.unk1;
-    hitcapsule->x40_b1 = 0;
-    hitcapsule->x34 = (s32) ((cmd->x8_bits->x0 << 0xF) & 0xFF800000) >> 0x18;
-    // hitcapsule->sfx_severity = ((u16) cmd->x8_bits->x2 >> 6U) & 7;
-    // hitcapsule->sfx_kind = ((u8) cmd->x8[0]->unk3 >> 2U) & 0xF;
-    // hitcapsule->sfx_kind = ((u8) cmd->x8_bits->x2 >> 2U) & 0xF;
-    // hitcapsule->sfx_kind = cmd->x8_bits->x3_b5;
-    // hitcapsule->x40_b2 = (u8) ((hitcapsule->x40_b2 & ~0x20) |
-    // ((cmd->x8_bits->unk3 << 5) & 0x20));
-    // hitcapsule->x40_b2 = cmd->x8_bits->x3_b7;
-    // hitcapsule->x40_b3 = (u8) ((hitcapsule->x40_b3 & ~0x10) |
-    // ((cmd->x8_bits->unk3 << 3) & 0x10));
-    // hitcapsule->x40_b3 = cmd->x8_bits->x3_b6;
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x40_b4 = ((u8) cmd->x8_bits->x0 << 4) & 0xFF0;
-    // hitcapsule->x41_b4 = cmd->x8_bits->x0_b7;
-    // hitcapsule->x41_b4 = (u8) ((hitcapsule->x41_b4 & ~8) | (((u8)
-    // cmd->x8_bits->unk1 >> 4U) & 8)); hitcapsule->x41_b4 = ((u8)
-    // cmd->x8_bits->x0 >> 4U) & 8;
-    // hitcapsule->x41_b4 = cmd->x8_bits->x1_b0;
-    // hitcapsule->x41_b5 = (u8) ((hitcapsule->x41_b5 & ~4) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 4)); hitcapsule->x41_b5 = ((u8)
-    // cmd->x8_bits->x0 >> 4U) & 4;
-    // hitcapsule->x41_b5 = cmd->x8_bits->x1_b1;
-    // hitcapsule->x41_b6 = (u8) ((hitcapsule->x41_b6 & ~2) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 2));
-    // hitcapsule->x41_b6 = cmd->x8_bits->x1_b2;
-    // hitcapsule->x41_b6 = cmd->x8_bits->x1_b6;
-    // hitcapsule->x41_b7 = (u8) ((hitcapsule->x41_b7 & ~1) | (((u8)
-    // cmd->x8[0]->unk1 >> 4U) & 1));
-    // hitcapsule->x41_b7 = cmd->x8_bits->x1_b3;
-    // hitcapsule->x41_b7 = cmd->x8_bits->x1_b7;
-    // hitcapsule->x42_b0 = (u8) ((hitcapsule->x42_b0 & ~0x80) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x80));
-    // hitcapsule->x42_b0 = cmd->x8_bits->x1_b4;
-    // hitcapsule->x42_b0 = cmd->x8_bits->x1_b0;
-    // hitcapsule->x42_b1 = (u8) ((hitcapsule->x42_b1 & ~0x40) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x40));
-    // hitcapsule->x42_b1 = cmd->x8_bits->x1_b5;
-    // hitcapsule->x42_b1 = cmd->x8_bits->x1_b1;
-    // hitcapsule->x42_b2 = (u8) ((hitcapsule->x42_b2 & ~0x20) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x20));
-    // hitcapsule->x42_b2 = cmd->x8_bits->x1_b6;
-    // hitcapsule->x42_b2 = cmd->x8_bits->x1_b2;
-    // hitcapsule->x42_b3 = (u8) ((hitcapsule->x42_b3 & ~0x10) |
-    // ((cmd->x8[0]->unk1 << 4) & 0x10));
-    // hitcapsule->x42_b3 = cmd->x8_bits->x1_b7;
-    // hitcapsule->x42_b4 = cmd->x8_bits->x2_b0;
-    // hitcapsule->x42_b5 = cmd->x8_bits->x2_b1;
-    // hitcapsule->x42_b6 = cmd->x8_bits->x2_b2;
-    // hitcapsule->x42_b7 = cmd->x8_bits->x2_b3;
-    // hitcapsule->x43 = cmd->x8_bits->x2;
-    // hitcapsule->x43_b0 = cmd->x8_bits->x2_b4;
-    // hitcapsule->hit_grabbed_victim_only = (u8)
-    // ((hitcapsule->hit_grabbed_victim_only & ~0x80) | (((u8) cmd->x8_bits->x0
-    // << 5) & 0x80)); hitcapsule->hit_grabbed_victim_only = ((u8)
-    // cmd->x8_bits->x0 << 5) & 0x80; hitcapsule->hit_grabbed_victim_only =
-    // cmd->x8_bits->x2_b5;
-    // (&item->x5D4_hitboxes[var_r4])->x138 = cmd->x8_bits->x2_b5;
-    // item->x5D4_hitboxes[var_r4].x138 = (u8) cmd->x8_bits->x2;
-    // cmd->unk8 = (void* ) (cmd->unk8 + 4);
-    // cmd->x8[0] = cmd->x8[1];
-    cmd->x8 = cmd->x8 + 4;
-    hitcapsule->x43_b2 = 1;
-    if (HSD_GObj_804D7838 && ((u8) HSD_GObj_804D7838->s_link > 11U)) {
-        it_8027129C(item_gobj, temp_r28);
-    }
-#endif
 }
 
 void it_80279544(Item_GObj* item_gobj, CommandInfo* cmd)
 {
-    // struct it_278F_struct_1B* temp_r4;
-    Item* item;
-    // PAD_STACK(4);
+    Item* temp_r5;
+    u32* temp_r4;
 
-    // temp_r4 = &((struct it_278F_struct_1A*) cmd)->x8[0];
-    item = GET_ITEM((HSD_GObj*) item_gobj);
-    // item = item_gobj->user_data;
-    // it_80272460(
-    // &item->x5D4_hitboxes[(cmd->x8_bits->x0 >> 7U) & 7].hit,
-    // (s32) (u32) (item->xC3C *
-    // ((f32) ((u16) cmd->x8_bits->x2 & 0x1FFF) * item->xC40)),
-    // item_gobj);
-    // cmd->unk8 = (void* ) (cmd->unk8 + 4);
-    // ((struct it_278F_struct_1A*) cmd)->x8[0] = ((struct it_278F_struct_1A*)
-    // cmd)->x8[1];
-    // cmd->x8 = cmd->x8 + 4;
+    temp_r4 = cmd->ptr[0];
+    temp_r5 = item_gobj->user_data;
+    it_80272460(
+        &temp_r5->x5D4_hitboxes[((u16) temp_r4[0] >> 7U) & 7].hit,
+        (u32) (temp_r5->xC3C * ((f32) (temp_r4[1] & 0x1FFF) * temp_r5->xC40)),
+        item_gobj);
+    cmd->ptr[0] += 4;
 }
 
 void it_802795EC(Item_GObj* item_gobj, CommandInfo* cmd)
 {
-    // s32 temp_r4_2;
-    HitCapsule* hitcapsule;
     Item* item;
+    s32 hitbox_idx;
+    HitCapsule* hitcapsule;
+    u32 data_val;
 
-    // temp_r4_2 = ((u16) cmd->x8_bits->x0 >> 7U) & 7;
-    item = GET_ITEM((HSD_GObj*) item_gobj);
-    // hitcapsule = &item->x5D4_hitboxes[temp_r4_2].hit;
-    // hitcapsule->scale = 0.003906f * (cmd->x8_bits->x0 & 0x7FFFFF);
-    // item->x3C = hitcapsule->scale;
-    // it_80275594(item_gobj, temp_r4_2, 1.0f / item->scl);
-    // cmd->x8 = cmd->x8 + 4;
+    data_val = *cmd->ptr[0];
+    hitbox_idx = ((u16) data_val >> 7U) & 7;
+    item = item_gobj->user_data;
+    hitcapsule = &item->x5D4_hitboxes[hitbox_idx].hit;
+    hitcapsule->scale = 0.003906f * (f32) (data_val & 0x7FFFFF);
+    item->x3C = hitcapsule->scale;
+    it_80275594(item_gobj, hitbox_idx, 1.0f / item->scl);
+    cmd->ptr[0] = cmd->ptr[0] + 4;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/if/ifstatus.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864407
Author: Copilot

`hud_data` is explicitly set to NULL and then dereferenced at offset `+4`, which is an immediate null-pointer dereference if this function executes. If this is still a work-in-progress, it should not touch `hud_data` until it is assigned to the real HUD structure (or the function should remain a stub/early-return before any dereference).
```suggestion
    NOT_IMPLEMENTED;
    return;
```

Hunk:
```diff
@@ -625,6 +787,44 @@ HSD_GObj* ifStatus_802F6194(HSD_GObj* node, s32 n)
 
 void ifStatus_802F61FC(void)
 {
+    void* hud_data;
+    u8 player_slot;
+    u8 character_id;
+    HSD_GObj* status_gobj;
+    HSD_JObj* root_joint;
+
+    PAD_STACK(16);
+
+    player_slot = 0;
+    hud_data = NULL;
+
+    character_id = Player_GetPlayerCharacter(player_slot);
+
+    if (((HSD_GObj**) ((u8*) hud_data + 4))[0] == NULL) {
+        ifAll_802F3690();
+
+        status_gobj = GObj_Create(0xE, 0xF, 0);
+        if (status_gobj == NULL) {
+            OSReport("ifStatus_802F61FC: couldn't make gobj\n");
+            __assert("ifstatus.c", 0x30A, "result");
+        }
+
+        // Access field at offset 0x268 of ifStatus_HudInfo
+        root_joint =
+            HSD_JObjLoadJoint(*(void**) ((u8*) &ifStatus_HudInfo + 0x268));
+        if (root_joint == NULL) {
+            OSReport("ifStatus_802F61FC: couldn't load joint\n");
+            __assert("ifstatus.c", 0x30E, "result");
+        }
+
+        HSD_GObjObject_80390A70(status_gobj, HSD_GObj_804D7849, root_joint);
+        GObj_SetupGXLink(status_gobj, ifStatus_802F5E50, 0xB, 0);
+        ((HSD_GObj**) ((u8*) hud_data + 4))[0] = status_gobj;
+    } else {
+        status_gobj = ((HSD_GObj**) ((u8*) hud_data + 4))[0];
+        root_joint = *(HSD_JObj**) ((u8*) status_gobj + 0x28);
+    }
+
     NOT_IMPLEMENTED;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/ft/ftmaterial.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864433
Author: Copilot

`tev_desc` is only 0x78 bytes, but this writes at offset 0x84, which is a definite stack out-of-bounds write (memory corruption). Fix by making `tev_desc` large enough for all written offsets, or by writing into the correct field within the `HSD_TevDesc` structure rather than using raw offsets.
```suggestion
    u8 tev_desc[0x88];
```

Hunk:
```diff
@@ -131,12 +131,98 @@ void ftMaterial_800BF2B8(HSD_MObj* mobj, u32 rendermode)
 HSD_TExp* ftMaterial_800BF534(Fighter* fp, HSD_MObj* mobj, HSD_TExp* texp,
                               u32 rendermode)
 {
-    NOT_IMPLEMENTED;
+    ColorOverlay* overlay;
+    s32 color_reg;
+    char* ftmobj_ptr = (char*) &ftMObj;
+    u8 tev_desc[0x78];
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/ft/ftmaterial.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864461
Author: Copilot

`tev_desc` is only 0x78 bytes, but this writes at offset 0x84, which is a definite stack out-of-bounds write (memory corruption). Fix by making `tev_desc` large enough for all written offsets, or by writing into the correct field within the `HSD_TevDesc` structure rather than using raw offsets.

Hunk:
```diff
@@ -131,12 +131,98 @@ void ftMaterial_800BF2B8(HSD_MObj* mobj, u32 rendermode)
 HSD_TExp* ftMaterial_800BF534(Fighter* fp, HSD_MObj* mobj, HSD_TExp* texp,
                               u32 rendermode)
 {
-    NOT_IMPLEMENTED;
+    ColorOverlay* overlay;
+    s32 color_reg;
+    char* ftmobj_ptr = (char*) &ftMObj;
+    u8 tev_desc[0x78];
+    s32 i;
+    u32* dst;
+    u32* src;
+
+    overlay = (ColorOverlay*) ftCo_800C0658(fp);
+
+    if (overlay->x7C_color_enable && overlay->x7C_light_enable) {
+        if (!(rendermode & 0x40000000) && !fp->x2223_b2) {
+            // Copy data from ftMObj
+            *(u32*) texp = *(u32*) (ftmobj_ptr + 0xC4);
+            *((u32*) texp + 1) = *(u32*) (ftmobj_ptr + 0xC8);
+            *((u32*) texp + 2) = *(u32*) (ftmobj_ptr + 0xCC);
+            *((u32*) texp + 3) = *(u32*) (ftmobj_ptr + 0xD0);
+            *((u32*) texp + 4) = *(u32*) (ftmobj_ptr + 0xD4);
+            *((u32*) texp + 5) = *(u32*) (ftmobj_ptr + 0xD8);
+
+            color_reg = lbGetFreeColorRegister(0, mobj, 0);
+
+            if (color_reg == -1) {
+                OSReport(ftmobj_ptr + 0xF4);
+                __assert(ftmobj_ptr + 0x118, 0xF0, (char*) &ftCo_804D3C08);
+            }
+
+            *((u8*) texp + 0x14) = (u8) color_reg;
+            *((u32*) texp + 2) = (u32) &overlay->x50_light_color;
+            HSD_TExpSetReg(texp);
+
+            // Copy TEV setup data using the loop pattern from assembly
+            i = 14;
+            dst = (u32*) (tev_desc + 0x10);
+            src = (u32*) (ftmobj_ptr + 0x48);
+            do {
+                src += 2;
+                dst += 2;
+                dst[0] = src[0];
+                dst[1] = src[1];
+                i--;
+            } while (i != 0);
+            dst[2] = src[2];
+
+            *(u32*) (tev_desc + 0x20) = HSD_StateAssignTev();
+            *(u32*) (tev_desc + 0x2C) = 2;
+            *(u32*) (tev_desc + 0x34) = 0xF;
+            *(u32*) (tev_desc + 0x38) = lb_8000CC8C(color_reg);
+            *(u32*) (tev_desc + 0x3C) = 0xB;
+            *(u32*) (tev_desc + 0x40) = 0;
+
+            if (color_reg < 4) {
+                *(u32*) (tev_desc + 0x84) = lb_8000CCA4(color_reg);
+            }
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/ft/ftcoll.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864488
Author: Copilot

Both `OSReport` calls use a format string with two `%d` placeholders but pass no arguments, which is undefined behavior (varargs mismatch) and can crash or print garbage. Fix by either supplying the expected integer arguments (current count and max) or by removing the placeholders from the format string.
```suggestion
        OSReport("Too many hurt capsules: %d (max: %d)\n",
                 *(s32*) hurt_data, 0xF);
```

Hunk:
```diff
@@ -1424,12 +2100,138 @@ void ftColl_CreateAbsorbHit(Fighter_GObj* gobj, AbsorbDesc* absorb)
 
 void ftColl_8007B320(Fighter_GObj* gobj)
 {
-    NOT_IMPLEMENTED;
+    Fighter* fp;
+    ftData* ft_data;
+    void* hurt_data;
+    void* hit_data;
+    Fighter* fp_iter;
+    u32 i;
+    s32 offset;
+    s32* entry;
+
+    fp = gobj->user_data;
+    ft_data = fp->ft_data;
+    hurt_data = ft_data->x30;
+    hit_data = ft_data->x2C;
+
+    if (*(s32*) hurt_data > 0xF) {
+        OSReport("Too many hurt capsules: %d (max: %d)\n");
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/ft/ftcoll.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864514
Author: Copilot

Both `OSReport` calls use a format string with two `%d` placeholders but pass no arguments, which is undefined behavior (varargs mismatch) and can crash or print garbage. Fix by either supplying the expected integer arguments (current count and max) or by removing the placeholders from the format string.

Hunk:
```diff
@@ -1424,12 +2100,138 @@ void ftColl_CreateAbsorbHit(Fighter_GObj* gobj, AbsorbDesc* absorb)
 
 void ftColl_8007B320(Fighter_GObj* gobj)
 {
-    NOT_IMPLEMENTED;
+    Fighter* fp;
+    ftData* ft_data;
+    void* hurt_data;
+    void* hit_data;
+    Fighter* fp_iter;
+    u32 i;
+    s32 offset;
+    s32* entry;
+
+    fp = gobj->user_data;
+    ft_data = fp->ft_data;
+    hurt_data = ft_data->x30;
+    hit_data = ft_data->x2C;
+
+    if (*(s32*) hurt_data > 0xF) {
+        OSReport("Too many hurt capsules: %d (max: %d)\n");
+        __assert("ftcoll.c", 0x8C9, "0");
+    }
+
+    *(u8*) ((u8*) fp + 0x119E) = *(u8*) hurt_data;
+
+    fp_iter = fp;
+    i = 0;
+    offset = 0;
+
+    goto check_loop1;
+
+loop1:
+    entry = (s32*) ((u8*) *(s32*) ((u8*) hurt_data + 4) + offset);
+    i++;
+    *(s32*) ((u8*) fp_iter + 0x11E0) = entry[0];
+    offset += 0x28;
+    *(s32*) ((u8*) fp_iter + 0x11E4) = entry[1];
+    *(s32*) ((u8*) fp_iter + 0x11E8) = entry[2];
+    *(s32*) ((u8*) fp_iter + 0x11A0) = 0;
+    *(s32*) ((u8*) fp_iter + 0x11C0) =
+        *(s32*) (*(s32**) ((u8*) fp + 0x5E8) + (entry[0] << 4));
+    *(s32*) ((u8*) fp_iter + 0x11A4) = entry[3];
+    *(s32*) ((u8*) fp_iter + 0x11A8) = entry[4];
+    *(s32*) ((u8*) fp_iter + 0x11AC) = entry[5];
+    *(s32*) ((u8*) fp_iter + 0x11B0) = entry[6];
+    *(s32*) ((u8*) fp_iter + 0x11B4) = entry[7];
+    *(s32*) ((u8*) fp_iter + 0x11B8) = entry[8];
+    *(f32*) ((u8*) fp_iter + 0x11BC) = *(f32*) &entry[9];
+    fp_iter = (Fighter*) ((u8*) fp_iter + 0x4C);
+
+check_loop1:
+    if (i < *(u32*) hurt_data) {
+        goto loop1;
+    }
+
+    if (*(s32*) ((u8*) hit_data + 8) > 0xB) {
+        OSReport("Too many hit capsules: %d (max: %d)\n");
+        __assert("ftcoll.c", 0x8DF, "0");
+    }
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: extern/dolphin/src/dolphin/thp/THPDec.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864529
Author: Copilot

The parameter `b` is declared as `int` but is used as a pointer (`(u8*) b`), which is undefined behavior and will fail on most builds/platforms. The function should take a pointer type (e.g., `const u8*`) for the Huffman bits/counts buffer and operate on that pointer without casting an integer.

Hunk:
```diff
@@ -519,72 +597,189 @@ static u8 __THPReadHuffmanTableSpecification(THPFileInfo* info)
 
 static u8 __THPReadScaneHeader(THPFileInfo* info)
 {
-    u8 i, utmp8;
-    info->file += 2;
+    extern s32 THPDec_803310CC(u8*);
+    u8 count;
+    u8* ptr;
+    u8 i;
 
-    utmp8 = (*(info->file)++);
+    info->file += 2;
+    count = *(info->file++);
 
-    if (utmp8 != 3) {
-        return 12;
+    if (count != info->validHuffmanTabs) {
+        return 0xC;
     }
 
-    for (i = 0; i < 3; i++) {
-        utmp8 = (*(info->file)++);
+    ptr = (u8*) info;
+    i = 0;
+
+    goto loop_check;
+
+loop_body: {
+    u8 byte_val;
+    s32 high_bits;
+    s8 low_bits;
+    u8 valid_tabs;
+    u16 mcus_per_row;
+    u16 mcu_height;
+    u32 comp_data;
+    s32 odd_flag = 1;
+    s32 blocks_per_mcu;
+    s32 total_blocks;
+    s32 remainder;
+    u16 comp_mask;
+    u16 blocks_mask;
+    u8 dc_bits;
+    u8 ac_bits;
+    u32 data_ptr;
+    u16 shift_count;
+    u32 data_ptr2;
+    s32 shift_val;
+    u16 final_mask;
+    s32 final_mult;
+
+    info->file++;
+    byte_val = *(info->file++);
+    high_bits = (s32) byte_val >> 4;
+    ptr[0x83C] = (s8) high_bits;
+    low_bits = byte_val & 0xF;
+    ptr[0x83D] = low_bits;
+    valid_tabs = info->validHuffmanTabs;
+
+    if (!(valid_tabs & (1 << high_bits))) {
+        return 0xF;
+    }
+    if (!(valid_tabs & (1 << (low_bits + 1)))) {
+        return 0xF;
+    }
 
-        utmp8 = (*(info->file)++);
-        info->components[i].DCTableSelector = (u8) (utmp8 >> 4);
-        info->components[i].ACTableSelector = (u8) (utmp8 & 15);
+    *(u16*) (ptr + 0x74) = *(u16*) (ptr + 0x50);
+    *(u16*) (ptr + 0x76) = *(u16*) (ptr + 0x52);
+    mcus_per_row = *(u16*) (ptr + 0x8D4);
+    mcu_height = *(u16*) (ptr + 0x76);
+    comp_data = *(u32*) (ptr + 0x840);
+    blocks_per_mcu = mcu_height / mcus_per_row;
+    total_blocks = mcus_per_row + mcu_height;
+    total_blocks = total_blocks - 1;
+    total_blocks = total_blocks / mcus_per_row;
+    blocks_per_mcu = blocks_per_mcu * mcus_per_row;
+    remainder = mcu_height - blocks_per_mcu;
+    comp_mask = comp_data & 0xFFFF;
+    blocks_mask = total_blocks & 0xFFFF;
+
+    if (remainder != 0) {
+        // odd_flag stays 1
+    } else {
+        odd_flag = 0;
+    }
 
-        if ((info->validHuffmanTabs & (1 << ((utmp8 >> 4)))) == 0) {
-            return 15;
-        }
+    blocks_mask = blocks_mask + odd_flag;
+    dc_bits = ptr[0x83A];
+    blocks_mask = blocks_mask * mcus_per_row;
+    ac_bits = *(u8*) (ptr + 0x7B);
+    data_ptr = *(u32*) (ptr + 0x904);
+    *(u32*) (ptr + 0x848) = data_ptr;
+    shift_count = blocks_mask & 0xFFFF;
+    shift_val = ac_bits - dc_bits;
+    data_ptr2 = *(u32*) (ptr + 0x904);
+    shift_val = shift_count >> shift_val;
+    final_mask = shift_val & 0xFFFF;
+    final_mult = comp_mask * final_mask;
+    final_mult = data_ptr2 + final_mult;
+    *(u32*) (ptr + 0x904) = final_mult;
+
+    ptr += 0x2C;
+    i++;
+}
 
-        if ((info->validHuffmanTabs & (1 << ((utmp8 & 15) + 1))) == 0) {
-            return 15;
-        }
+loop_check: {
+    u8 i_masked = i & 0xFF;
+    if (i_masked < count) {
+        goto loop_body;
     }
+}
 
     info->file += 3;
-    info->MCUsPerRow = (u16) THPROUNDUP(info->xPixelSize, 16);
-    info->components[0].predDC = 0;
-    info->components[1].predDC = 0;
-    info->components[2].predDC = 0;
-    return 0;
+    return THPDec_803310CC(info->file - 3);
 }
 
 static u8 __THPHuffGenerateSizeTable(THPFileInfo* info, u8 a, int b)
 {
-    s32 p, l, i;
-    p = 0;
+    s32 sum = 0;
+    s32 offset, i, count, j;
+    u8* size_table;
+    s32 index = 0;
+
+    // Sum first 16 bytes
+    for (i = 0; i < 16; i++) {
+        sum += ((u8*) b)[i];
+    }
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/if/ifstock.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864539
Author: Copilot

Line 68 indexes `x204` with `arg0`, while the surrounding state updates consistently use `arg1` as the player index. This looks like an accidental index swap and can corrupt another player's HUD state (or go out of bounds if `arg0` is not a valid player index). Fix by using the same index variable (`arg1`) consistently for the per-player `x204` updates.
```suggestion
    ifStock_804A1378.x204[arg1].x0[2] = 0;
```

Hunk:
```diff
@@ -37,59 +37,127 @@
 
 int ifStock_802F7EFC(int arg0, int arg1)
 {
-    Vec3 pos;
-    int i, j;
+    f32 pos[3];
+    int stocks, temp_stocks;
+    int i, j, k;
+    HSD_JObj *jobj, *jobj2, *jobj3;
+    int* stocks_ptr;
+
     if (Player_GetStocks(arg1) == 0) {
         return 1;
     }
+
     ifStock_804A1378.player[arg1].stocks = Player_GetStocks(arg1);
-    if (ifStock_804A1378.player[arg1].stocks < 0) {
-        ifStock_804A1378.player[arg1].stocks = 1;
+    stocks_ptr = &ifStock_804A1378.player[arg1].stocks;
+    temp_stocks = *stocks_ptr;
+    if (temp_stocks < 0) {
+        *stocks_ptr = 1;
     }
-    if (ifStock_804A1378.x204[arg1].x0[10] == 0) {
+
+    if (ifStock_804A1378.x204[arg1].x0[0xA] == 0) {
         i = 5;
-    } else if (ifStock_804A1378.x204[arg1].x0[11] == 0) {
-        i = 6;
     } else {
-        return 2;
+        if (ifStock_804A1378.x204[arg1].x0[0xB] == 0) {
+            i = 6;
+        } else {
+            return 2;
+        }
     }
+
     ifStock_804A1378.x204[arg1].x0[i + 5] = 1;
-    ifStock_804A1378.x204[arg1].x0[2] = 0;
-    ifStock_804A1378.x204[arg1].x0[i - 2] = arg0;
-    if (ifStock_804A1378.player[arg1].stocks <= 5 &&
-        ifStock_804A1378.player[arg1].stocks > 0)
-    {
-        ifStock_804A1378.x204[arg1].x0[ifStock_804A1378.player[arg1].stocks] =
-            10;
+    ifStock_804A1378.x204[arg0].x0[2] = 0;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/if/ifstock.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864558
Author: Copilot

This NULL check is ineffective: taking the address of an array element (`&...`) can never be NULL, so the assert is dead code. If the intent was to validate a pointer stored *in* `x0[...]`, the code should check the stored pointer/value instead of the address of the storage.
```suggestion

```

Hunk:
```diff
@@ -37,59 +37,127 @@
 
 int ifStock_802F7EFC(int arg0, int arg1)
 {
-    Vec3 pos;
-    int i, j;
+    f32 pos[3];
+    int stocks, temp_stocks;
+    int i, j, k;
+    HSD_JObj *jobj, *jobj2, *jobj3;
+    int* stocks_ptr;
+
     if (Player_GetStocks(arg1) == 0) {
         return 1;
     }
+
     ifStock_804A1378.player[arg1].stocks = Player_GetStocks(arg1);
-    if (ifStock_804A1378.player[arg1].stocks < 0) {
-        ifStock_804A1378.player[arg1].stocks = 1;
+    stocks_ptr = &ifStock_804A1378.player[arg1].stocks;
+    temp_stocks = *stocks_ptr;
+    if (temp_stocks < 0) {
+        *stocks_ptr = 1;
     }
-    if (ifStock_804A1378.x204[arg1].x0[10] == 0) {
+
+    if (ifStock_804A1378.x204[arg1].x0[0xA] == 0) {
         i = 5;
-    } else if (ifStock_804A1378.x204[arg1].x0[11] == 0) {
-        i = 6;
     } else {
-        return 2;
+        if (ifStock_804A1378.x204[arg1].x0[0xB] == 0) {
+            i = 6;
+        } else {
+            return 2;
+        }
     }
+
     ifStock_804A1378.x204[arg1].x0[i + 5] = 1;
-    ifStock_804A1378.x204[arg1].x0[2] = 0;
-    ifStock_804A1378.x204[arg1].x0[i - 2] = arg0;
-    if (ifStock_804A1378.player[arg1].stocks <= 5 &&
-        ifStock_804A1378.player[arg1].stocks > 0)
-    {
-        ifStock_804A1378.x204[arg1].x0[ifStock_804A1378.player[arg1].stocks] =
-            10;
+    ifStock_804A1378.x204[arg0].x0[2] = 0;
+    ifStock_804A1378.x204[arg1].x0[i - 2] = (s8) arg0;
+
+    stocks = *stocks_ptr;
+    if (stocks > 0 && stocks <= 5) {
+        ifStock_804A1378.x204[arg1].x0[stocks + 4] = 0xA;
     }
-    i = 0;
-    if (ifStock_804A1378.player[arg1].stocks <= 5 &&
-        ifStock_804A1378.player[arg1].stocks > 0)
-    {
-        i = 1;
+
+    k = 0;
+    if (stocks > 0 && stocks <= 5) {
+        k = 1;
     }
-    if (i != 0) {
-        j = ifStock_804A1378.player[arg1].stocks;
+    if (k != 0) {
+        j = stocks;
     } else {
         j = 1;
     }
-    HSD_JObjGetTranslation(ifStock_804A1378.player[arg1].x4[0], &pos);
+
+    jobj = ifStock_804A1378.player[arg1].x4[0];
+    if (jobj == NULL) {
+        __assert("jobj.h", 0x3D3U, "jobj");
+    }
+
+    pos[0] = jobj->translate.x;
+    pos[1] = jobj->translate.y;
+    pos[2] = jobj->translate.z;
+
     HSD_JObjReqAnimAll(ifStock_804A1378.player[arg1].x4[j], 0.0f);
     HSD_JObjAnimAll(ifStock_804A1378.player[arg1].x4[j]);
-    HSD_JObjGetTranslation(ifStock_804A1378.player[arg1].x4[j], 0);
-    i = 0;
-    if (Player_GetStocks(arg0) < 5 && Player_GetStocks(arg0) > 0) {
-        i = 1;
+
+    jobj2 = ifStock_804A1378.player[arg1].x4[j];
+    if (jobj2 == NULL) {
+        __assert("jobj.h", 0x3D3U, "jobj");
     }
-    if (i != 0) {
+
+    if (&ifStock_804A1378.x204[arg1].x0[(i - 5) * 0x24 + 0xC] == NULL) {
+        __assert("jobj.h", 0x3D4U, "translate");
+    }
+
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3023864581
Author: Copilot

At function exit `current` is always NULL (the loop terminates when `current` becomes NULL), so this will always return `-1` regardless of `count`. If the goal is to return the number of traversed nodes, return `count` directly; if the goal is to signal an error, the error condition needs to be something other than `current == NULL` at normal loop termination.
```suggestion
    return count;
```

Hunk:
```diff
@@ -1157,22 +1281,90 @@ int fn_801FA4CC(int num)
 
 int grIceMt_801FA500(HSD_GObj* param1)
 {
-    int iVar1 = NULL;
-    int iVar2;
-    int iVar3;
-    iVar3 = 0;
-    if (param1->hsd_obj == NULL) {
+    int count = 0;
+    HSD_JObj* current;
+    HSD_JObj* child;
+    HSD_JObj* sibling;
+    HSD_JObj* parent;
+    HSD_JObj* parent_sibling;
+
+    PAD_STACK(8);
+
+    current = param1->hsd_obj;
+
+    if (current == NULL) {
         __assert("gricemt.c", 2993, "jobj");
-        iVar1 = 0;
-        //} else {
-        //	ivar1 = param1->hsd_obj
     }
-    do {
-        if (iVar1 == 0) {
-            return iVar3;
+
+    if (current != NULL) {
+        current = current->child;
+    } else {
+        current = NULL;
+    }
+
+    if (current == NULL) {
+        __assert("gricemt.c", 2994, "jobj");
+    }
+
+    // Main tree traversal loop
+    while (current != NULL) {
+        // Check the flags for traversal control
+        if (!(current->flags & 0x1000)) {
+            // Can traverse to child
+            if (current != NULL) {
+                child = current->child;
+            } else {
+                child = NULL;
+            }
+            if (child != NULL) {
+                current = child;
+                count++;
+                continue;
+            }
+        }
+
+        // Try sibling
+        if (current != NULL) {
+            sibling = current->next;
+        } else {
+            sibling = NULL;
+        }
+        if (sibling != NULL) {
+            current = sibling;
+            count++;
+            continue;
+        }
+
+        // Go up to parent and look for its sibling
+        if (current != NULL) {
+            parent = current->parent;
+        } else {
+            parent = NULL;
         }
-        iVar3++;
-    } while (true);
+
+        while (parent != NULL) {
+            if (parent != NULL) {
+                parent_sibling = parent->next;
+            } else {
+                parent_sibling = NULL;
+            }
+            if (parent_sibling != NULL) {
+                current = parent_sibling;
+                count++;
+                goto next_iteration;
+            }
+            if (parent != NULL) {
+                parent = parent->parent;
+            } else {
+                parent = NULL;
+            }
+        }
+        current = parent; // NULL
+
+    next_iteration:;
+    }
+
+    return (current != NULL) ? count : -1;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024780963
Author: BR-

Most GObj types have an associated getter macro, which we try to use everywhere. `GET_GROUND`

Hunk:
```diff
@@ -576,15 +576,20 @@ void grIceMt_801F7EE8(Ground_GObj* arg0)
 }
 
 /// #grIceMt_801F7F1C
-void grIceMt_801F7F1C(Ground_GObj* arg0)
+void grIceMt_801F7F1C(HSD_GObj* gobj)
 {
-    int i = 0;
-    Ground* gp = GET_GROUND(arg0);
+    u8 _[8];
+    void* ptr;
+    s32 i;
+
+    i = 0;
+    ptr = gobj->user_data;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024784878
Author: BR-

Ground_GObj is a typedef for HSD_GObj, but leaving it as a Ground_GObj gives more information to readers (and [m2c](https://github.com/matt-kempster/m2c), our decompiler).

Hunk:
```diff
@@ -576,15 +576,20 @@ void grIceMt_801F7EE8(Ground_GObj* arg0)
 }
 
 /// #grIceMt_801F7F1C
-void grIceMt_801F7F1C(Ground_GObj* arg0)
+void grIceMt_801F7F1C(HSD_GObj* gobj)
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024802261
Author: BR-

ptr should be a Ground*, not a void*
Offset 0xF8 is inside the GroundVars union, which holds different data for every Ground. We should use icemt, icemt2, or maybe create an icemt3. One stage can have multiple Grounds, and I don't know which one this callback is expecting.
icemt looks like it has an HSD_GObj array at 0xF8 so it's probably that one.
`gp->gv.icemt.xF8[0]`

Hunk:
```diff
@@ -576,15 +576,20 @@ void grIceMt_801F7EE8(Ground_GObj* arg0)
 }
 
 /// #grIceMt_801F7F1C
-void grIceMt_801F7F1C(Ground_GObj* arg0)
+void grIceMt_801F7F1C(HSD_GObj* gobj)
 {
-    int i = 0;
-    Ground* gp = GET_GROUND(arg0);
+    u8 _[8];
+    void* ptr;
+    s32 i;
+
+    i = 0;
+    ptr = gobj->user_data;
     do {
-        if (42 != 0) {
-            grMaterial_801C8CDC(arg0);
+        if (*(void**)((u8*)ptr + 0xF8) != NULL) {
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024816831
Author: BR-

This looks like a compiler optimization.
```c
for (int i = 0; i < 2; i++) {
  foo(arr[i]);
}
// can compile to:
for (int i = 0; i < 2; i++) {
  foo(arr++);
}
```

Hunk:
```diff
@@ -576,15 +576,20 @@ void grIceMt_801F7EE8(Ground_GObj* arg0)
 }
 
 /// #grIceMt_801F7F1C
-void grIceMt_801F7F1C(Ground_GObj* arg0)
+void grIceMt_801F7F1C(HSD_GObj* gobj)
 {
-    int i = 0;
-    Ground* gp = GET_GROUND(arg0);
+    u8 _[8];
+    void* ptr;
+    s32 i;
+
+    i = 0;
+    ptr = gobj->user_data;
     do {
-        if (42 != 0) {
-            grMaterial_801C8CDC(arg0);
+        if (*(void**)((u8*)ptr + 0xF8) != NULL) {
+            grMaterial_801C8CDC(*(void**)((u8*)ptr + 0xF8));
         }
-        i++;
+        i += 1;
+        ptr = (void*)((u8*)ptr + 4);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024823609
Author: BR-

This function looks like a copypaste of `grIceMt_801F7F1C` (which is fine, but same comments apply).
There's a chance one inlines the other, or both inline a third function - if the stack is wrong after cleanup that might be a thing to try.

Hunk:
```diff
@@ -631,13 +636,19 @@ void grIceMt_801F815C(Ground_GObj* param1)
 /// #grIceMt_801F81B4
 void grIceMt_801F81B4(Ground_GObj* arg0)
 {
-    int i = 0;
-    Ground* gp = GET_GROUND(arg0);
+    Ground* gp;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024859982
Author: BR-

There is a lot of pointer math here. Need to use `M2C_FIELD(arg1, s16*, 0)` or figure out the type of arg1.
The callsites are passing a pointer to inside of the GroundVars struct, making me think there should be an inner struct.
It might be easier to make a new temporary struct and unify it later:
```c
struct grIceMt_801F929C_arg1 { /// @todo this should be an internal struct within grIceMt_GroundVars
    s16 x0;
    s16 x2;
    // ...
}* p = arg1;
```
I'd prefer: actual struct > m2c_field = temporary struct > pointer math.

Hunk:
```diff
@@ -1007,28 +1018,73 @@ void grIceMt_801F91EC(HSD_GObj* param_1, s16* param_2, int param_3,
 /// #grIceMt_801F929C
 void grIceMt_801F929C(HSD_GObj* arg0, void* arg1)
 {
-    mpLib_80057BC0(2);
-    mpJointListAdd(2);
-    grAnime_801C83D0(arg0, 2, 7);
+    s16 temp_r3;
+
+    if (*(s16*)((u8*)arg1 + 0x0) != 0) {
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024880887
Author: BR-

More pointer math. 0x100 is a HSD_GObj* in icemt, which doesn't seem right for this usage. Perhaps this shares a struct with 801F929C above? icemt3 might be the way to go until we can figure out what's going on.
I think a struct is more likely than an array.

Hunk:
```diff
@@ -1007,28 +1018,73 @@ void grIceMt_801F91EC(HSD_GObj* param_1, s16* param_2, int param_3,
 /// #grIceMt_801F929C
 void grIceMt_801F929C(HSD_GObj* arg0, void* arg1)
 {
-    mpLib_80057BC0(2);
-    mpJointListAdd(2);
-    grAnime_801C83D0(arg0, 2, 7);
+    s16 temp_r3;
+
+    if (*(s16*)((u8*)arg1 + 0x0) != 0) {
+        *(s16*)((u8*)arg1 + 0x2) = (s16) (*(s16*)((u8*)arg1 + 0x2) + 1);
+        temp_r3 = *(s16*)((u8*)arg1 + 0x2);
+        if (temp_r3 == *(s16*)((u8*)arg1 + 0xA)) {
+            mpLib_80057BC0(*(s16*)((u8*)arg1 + 0x8));
+        } else if (temp_r3 == *(s16*)((u8*)arg1 + 0xC)) {
+            mpJointListAdd(*(s16*)((u8*)arg1 + 0x8));
+        }
+        if (grAnime_801C83D0(arg0, *(s16*)((u8*)arg1 + 0x4), 7) != 0) {
+            *(s16*)((u8*)arg1 + 0x0) = 0;
+        }
+    }
 }
 
 /// #fn_801F9338
 void fn_801F9338(Ground* gp, int arg1, CollData* arg2, s32 arg3,
                  mpLib_GroundEnum arg4, float arg8)
 {
-    // mpLib_80057BC0(2);
-    // mpJointListAdd(2);
-    // grAnime_801C83D0(arg0,2,7);
+    HSD_GObj* temp_r3;
+    s16* temp_r30;
+    s16 temp_r4;
+    u8 flag_byte;
+
+    temp_r30 = (s16*)((u8*)gp + 0x100);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024889703
Author: BR-

Prefer struct access by name: `arg2->x34_flags`
Since it's a bitfield, the shifting and masking below is unnecessary too.
This variable probably shouldn't exist, just inline `arg2->x34_flags.b1234` in the if statement.

Hunk:
```diff
@@ -1007,28 +1018,73 @@ void grIceMt_801F91EC(HSD_GObj* param_1, s16* param_2, int param_3,
 /// #grIceMt_801F929C
 void grIceMt_801F929C(HSD_GObj* arg0, void* arg1)
 {
-    mpLib_80057BC0(2);
-    mpJointListAdd(2);
-    grAnime_801C83D0(arg0, 2, 7);
+    s16 temp_r3;
+
+    if (*(s16*)((u8*)arg1 + 0x0) != 0) {
+        *(s16*)((u8*)arg1 + 0x2) = (s16) (*(s16*)((u8*)arg1 + 0x2) + 1);
+        temp_r3 = *(s16*)((u8*)arg1 + 0x2);
+        if (temp_r3 == *(s16*)((u8*)arg1 + 0xA)) {
+            mpLib_80057BC0(*(s16*)((u8*)arg1 + 0x8));
+        } else if (temp_r3 == *(s16*)((u8*)arg1 + 0xC)) {
+            mpJointListAdd(*(s16*)((u8*)arg1 + 0x8));
+        }
+        if (grAnime_801C83D0(arg0, *(s16*)((u8*)arg1 + 0x4), 7) != 0) {
+            *(s16*)((u8*)arg1 + 0x0) = 0;
+        }
+    }
 }
 
 /// #fn_801F9338
 void fn_801F9338(Ground* gp, int arg1, CollData* arg2, s32 arg3,
                  mpLib_GroundEnum arg4, float arg8)
 {
-    // mpLib_80057BC0(2);
-    // mpJointListAdd(2);
-    // grAnime_801C83D0(arg0,2,7);
+    HSD_GObj* temp_r3;
+    s16* temp_r30;
+    s16 temp_r4;
+    u8 flag_byte;
+
+    temp_r30 = (s16*)((u8*)gp + 0x100);
+    flag_byte = *(u8*)((u8*)arg2 + 0x34);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024903697
Author: BR-

There could be some inlines afoot here, this looks very similar to `fn_801F9338`, but don't sweat it.
Same comments apply.

Hunk:
```diff
@@ -1007,28 +1018,73 @@ void grIceMt_801F91EC(HSD_GObj* param_1, s16* param_2, int param_3,
 /// #grIceMt_801F929C
 void grIceMt_801F929C(HSD_GObj* arg0, void* arg1)
 {
-    mpLib_80057BC0(2);
-    mpJointListAdd(2);
-    grAnime_801C83D0(arg0, 2, 7);
+    s16 temp_r3;
+
+    if (*(s16*)((u8*)arg1 + 0x0) != 0) {
+        *(s16*)((u8*)arg1 + 0x2) = (s16) (*(s16*)((u8*)arg1 + 0x2) + 1);
+        temp_r3 = *(s16*)((u8*)arg1 + 0x2);
+        if (temp_r3 == *(s16*)((u8*)arg1 + 0xA)) {
+            mpLib_80057BC0(*(s16*)((u8*)arg1 + 0x8));
+        } else if (temp_r3 == *(s16*)((u8*)arg1 + 0xC)) {
+            mpJointListAdd(*(s16*)((u8*)arg1 + 0x8));
+        }
+        if (grAnime_801C83D0(arg0, *(s16*)((u8*)arg1 + 0x4), 7) != 0) {
+            *(s16*)((u8*)arg1 + 0x0) = 0;
+        }
+    }
 }
 
 /// #fn_801F9338
 void fn_801F9338(Ground* gp, int arg1, CollData* arg2, s32 arg3,
                  mpLib_GroundEnum arg4, float arg8)
 {
-    // mpLib_80057BC0(2);
-    // mpJointListAdd(2);
-    // grAnime_801C83D0(arg0,2,7);
+    HSD_GObj* temp_r3;
+    s16* temp_r30;
+    s16 temp_r4;
+    u8 flag_byte;
+
+    temp_r30 = (s16*)((u8*)gp + 0x100);
+    flag_byte = *(u8*)((u8*)arg2 + 0x34);
+    if (((flag_byte >> 3) & 0xF) == 1 && *temp_r30 == 0) {
+        temp_r3 = Ground_801C2BA4(2);
+        *temp_r30 = 1;
+        temp_r30[1] = 0;
+        grAnime_801C7A04(temp_r3, temp_r30[2], 7, 1.0f);
+        grAnime_801C7B24(temp_r3, temp_r30[2], 7, 0.0f);
+        grAnime_801C78FC(temp_r3, temp_r30[2], 7);
+        temp_r4 = temp_r30[3];
+        if (temp_r4 != -1) {
+            grAnime_801C7A04(temp_r3, temp_r4, 7, 1.0f);
+            grAnime_801C7B24(temp_r3, temp_r30[3], 7, 0.0f);
+            grAnime_801C78FC(temp_r3, temp_r30[3], 7);
+        }
+    }
     grIceMt_801FA7F0(gp, arg1, arg2, arg3, arg4, arg8);
 }
 
 /// #fn_801F9448
 void fn_801F9448(Ground* gp, int arg1, CollData* arg2, s32 arg3,
                  mpLib_GroundEnum arg4, float arg8)
 {
-    // mpLib_80057BC0(2);
-    // mpJointListAdd(2);
-    // grAnime_801C83D0(arg0,2,7);
+    HSD_GObj* gobj;
+    s16* icemt_ptr = &gp->gv.icemt.x10E;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/grpura.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024905584
Author: BR-

GET_GROUND (we are pretty sure they used it everywhere, and not having it can affect codegen in strange ways. this time it didn't but good to stay consistent)

Hunk:
```diff
@@ -239,14 +239,18 @@ void grPura_8021228C(Ground_GObj* arg0) {}
 /// #grPura_80212290
 void grPura_80212290(Ground_GObj* arg0)
 {
-    Ground* gp = GET_GROUND(arg0);
-    HSD_JObj* jobj = arg0->hsd_obj;
-    HSD_ImageDesc* image = grPu_803E6E20;
-    HSD_MObjSetToonTextureImage(image);
-    lb_80011C18(jobj, 0x1000);
-    grPura_80213250(jobj);
-    HSD_MObjSetToonTextureImage(0);
-    grAnime_801C8138(arg0, gp->map_id, 0);
+    Ground* temp_r31;
+    HSD_JObj* temp_r30;
+    PAD_STACK(8);
+
+    temp_r31 = arg0->user_data;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/grpura.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024913833
Author: BR-

`arg0->render_cb`

Hunk:
```diff
@@ -239,14 +239,18 @@ void grPura_8021228C(Ground_GObj* arg0) {}
 /// #grPura_80212290
 void grPura_80212290(Ground_GObj* arg0)
 {
-    Ground* gp = GET_GROUND(arg0);
-    HSD_JObj* jobj = arg0->hsd_obj;
-    HSD_ImageDesc* image = grPu_803E6E20;
-    HSD_MObjSetToonTextureImage(image);
-    lb_80011C18(jobj, 0x1000);
-    grPura_80213250(jobj);
-    HSD_MObjSetToonTextureImage(0);
-    grAnime_801C8138(arg0, gp->map_id, 0);
+    Ground* temp_r31;
+    HSD_JObj* temp_r30;
+    PAD_STACK(8);
+
+    temp_r31 = arg0->user_data;
+    temp_r30 = arg0->hsd_obj;
+    *(void (**)(HSD_GObj*, int))((u8*)arg0 + 0x1C) = fn_802130D0;
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/gr/grpura.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024919855
Author: BR-

no cast required between HSD_GObj and Ground_GObj, they're the same type

Hunk:
```diff
@@ -239,14 +239,18 @@ void grPura_8021228C(Ground_GObj* arg0) {}
 /// #grPura_80212290
 void grPura_80212290(Ground_GObj* arg0)
 {
-    Ground* gp = GET_GROUND(arg0);
-    HSD_JObj* jobj = arg0->hsd_obj;
-    HSD_ImageDesc* image = grPu_803E6E20;
-    HSD_MObjSetToonTextureImage(image);
-    lb_80011C18(jobj, 0x1000);
-    grPura_80213250(jobj);
-    HSD_MObjSetToonTextureImage(0);
-    grAnime_801C8138(arg0, gp->map_id, 0);
+    Ground* temp_r31;
+    HSD_JObj* temp_r30;
+    PAD_STACK(8);
+
+    temp_r31 = arg0->user_data;
+    temp_r30 = arg0->hsd_obj;
+    *(void (**)(HSD_GObj*, int))((u8*)arg0 + 0x1C) = fn_802130D0;
+    HSD_MObjSetToonTextureImage(&grPu_803E7620);
+    lb_80011C18(temp_r30, 0x1000U);
+    grPura_80213250(temp_r30);
+    HSD_MObjSetToonTextureImage(NULL);
+    grAnime_801C8138((HSD_GObj* ) arg0, temp_r31->map_id, 0);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/it/items/itoldkuri.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024926769
Author: BR-

2 = ITEM_ANIM_UPDATE

Hunk:
```diff
@@ -38,7 +38,14 @@ void it_802D73F0(Item_GObj* gobj)
     it_802D747C(gobj);
 }
 
-void it_802D747C(Item_GObj* gobj) {}
+void it_802D747C(Item_GObj* gobj)
+{
+    u8 _[8];
+    it_8027CAD8(gobj);
+    it_8027C0A8(gobj, 0.0f, 5.0f);
+    it_802756E0(gobj);
+    it_802D848C(gobj, 0, 2);
```

## PR #2373: AI-assisted decompilation: 8 new 100% matches
Path: src/melee/it/items/itoldkuri.c
URL: https://github.com/doldecomp/melee/pull/2373#discussion_r3024928218
Author: BR-

`PAD_STACK(8);` preferred. Makes me think this might be an inline, because the same code (and padding) is present in `itOldkuri_UnkMotion9_Anim`.

Hunk:
```diff
@@ -38,7 +38,14 @@ void it_802D73F0(Item_GObj* gobj)
     it_802D747C(gobj);
 }
 
-void it_802D747C(Item_GObj* gobj) {}
+void it_802D747C(Item_GObj* gobj)
+{
+    u8 _[8];
```
