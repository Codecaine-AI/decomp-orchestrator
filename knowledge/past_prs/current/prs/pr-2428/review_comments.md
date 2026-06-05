## PR #2428: Jj/grbigblue
Path: src/melee/gr/grbigblue.c
URL: https://github.com/doldecomp/melee/pull/2428#discussion_r3117959116
Author: PsiLupan

This is F32_MAX.

Hunk:
```diff
@@ -519,21 +532,644 @@ bool grBigBlue_801E6C58(Ground_GObj* arg)
     return false;
 }
 
-/// #grBigBlue_801E6C60
+void grBigBlue_801E6C60(Ground_GObj* gobj)
+{
+    s32 i;
+    Ground* gp;
+    Ground* base;
+    i = 0;
+    gp = gobj->user_data;
+    base = gp;
+
+    do {
+        u8 idx = gp->gv.bigblue.data[0].index;
+        u8 state = gp->gv.bigblue.data[0].x1;
+        HSD_JObj* jobj = gp->gv.bigblue.xD4[idx];
+
+        switch ((s8) state) {
+        case 0:
+        {
+            if ((int) grBigBlue_801E89DC(0) != 0) {
+                s32 range = grBb_804D69C8->x8C;
+                s32 rand_val;
+                Vec3 pos;
+
+                if (range != 0) {
+                    rand_val = HSD_Randi(range);
+                } else {
+                    rand_val = 0;
+                }
+                gp->gv.bigblue.data[i].x8 = grBb_804D69C8->x88 + rand_val;
+
+                HSD_JObjGetTranslation(jobj, &pos);
+
+                gp->gv.bigblue.data[i].x38 = pos;
+                gp->gv.bigblue.data[i].x44.z = 0.0f;
+                gp->gv.bigblue.data[i].x44.y = 0.0f;
+                gp->gv.bigblue.data[i].x44.x = 0.0f;
+                gp->gv.bigblue.data[i].x18.z = 0.0f;
+                gp->gv.bigblue.data[i].x18.y = 0.0f;
+                gp->gv.bigblue.data[i].x18.x = 0.0f;
+                gp->gv.bigblue.data[i].x1 = 1;
+            }
+            break;
+        }
+        case 1:
+            if ((int) grBigBlue_801E89DC(0) == 0) {
+                gp->gv.bigblue.data[i].x1 = 0;
+            } else {
+            case 2:
+                if (gp->gv.bigblue.data[i].x8 <= 0) {
+                    Vec3 pos;
+                    Vec3 neg_pos;
+                    f32 right_y, left_y;
+                    s32 found;
+                    s32 retries;
+
+                    memzero(&pos, 0xC);
+                    memzero(&neg_pos, 0xC);
+                    pos.x = 10.0f + Stage_GetBlastZoneRightOffset();
+                    neg_pos.x =
+                        -(10.0f + Stage_GetBlastZoneRightOffset());
+
+                    right_y =
+                        grBigBlue_801EC58C(&pos, NULL, 500.0f);
+                    left_y =
+                        grBigBlue_801EC58C(&neg_pos, NULL, 500.0f);
+
+                    if (right_y != -3.4028235e38f ||
+                        left_y != -3.4028235e38f)
+                    {
+                        f32 height_range;
+                        s32 height_rand;
+
+                        gp->gv.bigblue.data[i].x8 = grBb_804D69C8->x90;
+                        height_range =
+                            grBb_804D69C8->x94 - grBb_804D69C8->x90;
+                        if (height_range < 0.0f) {
+                            height_range = -height_range;
+                        }
+                        if ((s32) height_range != 0) {
+                            height_rand =
+                                HSD_Randi((s32) height_range);
+                        } else {
+                            height_rand = 0;
+                        }
+                        gp->gv.bigblue.data[i].x8 += (f32) height_rand;
+                        pos.y = right_y + gp->gv.bigblue.data[i].x8;
+                        neg_pos.y = left_y + gp->gv.bigblue.data[i].x8;
+
+                        if (left_y == -3.4028235e38f) {
```

## PR #2428: Jj/grbigblue
Path: src/melee/gr/grbigblue.c
URL: https://github.com/doldecomp/melee/pull/2428#discussion_r3117993639
Author: PsiLupan

Nitpick: This is a gobj_id, we should represent it with decimal, not hex.

Hunk:
```diff
@@ -847,74 +1443,661 @@ bool grBigBlue_801E93D0(Ground_GObj* arg)
     return false;
 }
 
-/// #grBigBlue_801E93D8
-
-void grBigBlue_801E9F38(Ground_GObj* arg) {}
-
-void grBigBlue_801E9F3C(Ground_GObj* gobj)
+void grBigBlue_801E93D8(Ground_GObj* gobj)
 {
-    HSD_JObj* jobj = GET_JOBJ(gobj);
+    Vec3 pos;
+    Vec3 fwd;
+    Vec3 back;
+    Vec3 normal;
+    Vec3 euler;
+    s32 _pad_9C;
+    Vec3 check_pos;
     Ground* gp = gobj->user_data;
-    Vec3 v;
-    PAD_STACK(8);
-
-    Ground_801C2ED0(jobj, gp->map_id);
-    gp->x10_flags.b5 = 1;
-
-    v.x = v.y = v.z = Ground_801C0498();
-
-    HSD_JObjSetScale(jobj, &v);
-
-    ((u8*) gp)[0xC4] = 0;
-    *(s32*) ((u8*) GET_GROUND(Ground_801C2BA4(0x20)) + 0xD0) = 0;
-    grAnime_801C8138(gobj, gp->map_id, 0);
-}
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    u8* bp = (u8*) gp;
+    PAD_STACK(76);
 
-bool grBigBlue_801EA054(Ground_GObj* arg)
-{
-    return false;
-}
+    HSD_JObjGetTranslation2(jobj, &pos);
 
-/// #grBigBlue_801EA05C
+    if (grBigBlue_801EC58C(&pos, &normal, 500.0f) == -3.4028235e38f) {
+        normal.z = 0.0f;
+        normal.x = 0.0f;
+        normal.y = 1.0f;
+    }
 
-void grBigBlue_801EAB4C(Ground_GObj* arg) {}
+    euler.y = 0.0f;
+    euler.x = 0.0f;
+    euler.z = atan2f(-normal.x, normal.y);
 
-bool grBigBlue_801EAB50(Vec3* pos, s32 flag, f32 rangeX, f32 rangeY)
-{
-    HSD_GObj* gobj = Ground_801C2BA4(0x20);
-    u8* gp = (u8*) gobj->user_data;
-    HSD_JObj* jobj = GET_JOBJ(gobj);
-    s32 result = false;
-    f32 dist;
-    PAD_STACK(32);
+    fwd.x = 50.0f;
+    fwd.z = 0.0f;
+    fwd.y = 0.0f;
+    lbVector_ApplyEulerRotation(&fwd, &euler);
+    lbVector_Add(&fwd, &pos);
 
-    if ((int) gp[0xC4] == 2) {
-        dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        if (dist < 0.0F) {
-            dist = -(HSD_JObjGetTranslationX(jobj) - pos->x);
-        } else {
-            dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        }
+    back.x = -50.0f;
+    back.z = 0.0f;
+    back.y = 0.0f;
+    lbVector_ApplyEulerRotation(&back, &euler);
+    lbVector_Add(&back, &pos);
 
-        if (dist < rangeX) {
-            dist = HSD_JObjGetTranslationY(jobj) - pos->y;
-            if (dist < 0.0F) {
-                dist = -(HSD_JObjGetTranslationY(jobj) - pos->y);
-            } else {
-                dist = HSD_JObjGetTranslationY(jobj) - pos->y;
+    switch ((s8) bp[0xC4]) {
+    case 0:
+    {
+        if (*(s32*)((u8*) Ground_801C2BA4(0x20)->user_data + 0xCC) != 0) {
+            u32 cars_avail = 0;
+            u8* mgp = (u8*) Ground_801C2BA4(0x20)->user_data;
```

## PR #2428: Jj/grbigblue
Path: src/melee/gr/grbigblue.c
URL: https://github.com/doldecomp/melee/pull/2428#discussion_r3118017815
Author: PsiLupan

These are just `break;`, no?

Hunk:
```diff
@@ -847,74 +1443,661 @@ bool grBigBlue_801E93D0(Ground_GObj* arg)
     return false;
 }
 
-/// #grBigBlue_801E93D8
-
-void grBigBlue_801E9F38(Ground_GObj* arg) {}
-
-void grBigBlue_801E9F3C(Ground_GObj* gobj)
+void grBigBlue_801E93D8(Ground_GObj* gobj)
 {
-    HSD_JObj* jobj = GET_JOBJ(gobj);
+    Vec3 pos;
+    Vec3 fwd;
+    Vec3 back;
+    Vec3 normal;
+    Vec3 euler;
+    s32 _pad_9C;
+    Vec3 check_pos;
     Ground* gp = gobj->user_data;
-    Vec3 v;
-    PAD_STACK(8);
-
-    Ground_801C2ED0(jobj, gp->map_id);
-    gp->x10_flags.b5 = 1;
-
-    v.x = v.y = v.z = Ground_801C0498();
-
-    HSD_JObjSetScale(jobj, &v);
-
-    ((u8*) gp)[0xC4] = 0;
-    *(s32*) ((u8*) GET_GROUND(Ground_801C2BA4(0x20)) + 0xD0) = 0;
-    grAnime_801C8138(gobj, gp->map_id, 0);
-}
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    u8* bp = (u8*) gp;
+    PAD_STACK(76);
 
-bool grBigBlue_801EA054(Ground_GObj* arg)
-{
-    return false;
-}
+    HSD_JObjGetTranslation2(jobj, &pos);
 
-/// #grBigBlue_801EA05C
+    if (grBigBlue_801EC58C(&pos, &normal, 500.0f) == -3.4028235e38f) {
+        normal.z = 0.0f;
+        normal.x = 0.0f;
+        normal.y = 1.0f;
+    }
 
-void grBigBlue_801EAB4C(Ground_GObj* arg) {}
+    euler.y = 0.0f;
+    euler.x = 0.0f;
+    euler.z = atan2f(-normal.x, normal.y);
 
-bool grBigBlue_801EAB50(Vec3* pos, s32 flag, f32 rangeX, f32 rangeY)
-{
-    HSD_GObj* gobj = Ground_801C2BA4(0x20);
-    u8* gp = (u8*) gobj->user_data;
-    HSD_JObj* jobj = GET_JOBJ(gobj);
-    s32 result = false;
-    f32 dist;
-    PAD_STACK(32);
+    fwd.x = 50.0f;
+    fwd.z = 0.0f;
+    fwd.y = 0.0f;
+    lbVector_ApplyEulerRotation(&fwd, &euler);
+    lbVector_Add(&fwd, &pos);
 
-    if ((int) gp[0xC4] == 2) {
-        dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        if (dist < 0.0F) {
-            dist = -(HSD_JObjGetTranslationX(jobj) - pos->x);
-        } else {
-            dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        }
+    back.x = -50.0f;
+    back.z = 0.0f;
+    back.y = 0.0f;
+    lbVector_ApplyEulerRotation(&back, &euler);
+    lbVector_Add(&back, &pos);
 
-        if (dist < rangeX) {
-            dist = HSD_JObjGetTranslationY(jobj) - pos->y;
-            if (dist < 0.0F) {
-                dist = -(HSD_JObjGetTranslationY(jobj) - pos->y);
-            } else {
-                dist = HSD_JObjGetTranslationY(jobj) - pos->y;
+    switch ((s8) bp[0xC4]) {
+    case 0:
+    {
+        if (*(s32*)((u8*) Ground_801C2BA4(0x20)->user_data + 0xCC) != 0) {
+            u32 cars_avail = 0;
+            u8* mgp = (u8*) Ground_801C2BA4(0x20)->user_data;
+            s32 count = 0;
+
+            if ((s8) mgp[0xE5] != 0) {
+                count = 1;
+                if (cars_avail != 0U) {
+                    cars_avail =
+                        *(u32*)(mgp + ((s8) mgp[0xE4] * 4) + 0xD4);
+                }
             }
-
-            if (dist < rangeY) {
-                result = true;
+            {
+                u8* p = mgp + 0x54;
+                if ((s8) mgp[0x139] != 0) {
+                    count++;
+                    if (cars_avail != 0U) {
+                        cars_avail =
+                            *(u32*)(mgp + ((s8) p[0xE4] * 4) + 0xD4);
+                    }
+                }
+                if ((s8) p[0x139] != 0) {
+                    if (cars_avail != 0U) {
+                    }
+                    count++;
+                }
             }
-        }
 
-        if (flag != 0) {
-            if ((s8) gp[0xC5] == -1) {
-                result = true;
-            }
-        }
-    }
+            if (count <= 1) {
+                f32 height;
+
+                memzero(&pos, 0xC);
+                pos.x = Stage_GetBlastZoneLeftOffset() - 50.0f;
+                height = grBigBlue_801EC58C(&pos, NULL, 500.0f);
+                if (height != -3.4028235e38f) {
+                    f32 speed;
+                    s32 collided;
+
+                    pos.y = height + grBb_804D69C8->xCC;
+                    speed = 140.0f * Ground_801C0498();
+                    collided = grBigBlue_801E8794(jobj, &pos, 1,
+                        2.0f * (60.0f * Ground_801C0498()), speed);
+                    if (collided == 0) {
+                        collided = grBigBlue_801EAB50(&pos, 1,
+                            2.0f * (60.0f * Ground_801C0498()), 25.0f);
+                    }
+                    if (collided == 0) {
+                        f32 cam_right = Stage_GetCamBoundsRightOffset();
+                        f32 cam_left = Stage_GetCamBoundsLeftOffset();
+                        f32 cam_bot = Stage_GetCamBoundsBottomOffset();
+                        if (pos.y <= grBigBlue_801E8B84(
+                                Stage_GetCamBoundsTopOffset(), cam_bot,
+                                cam_left, cam_right))
+                        {
+                            collided = 1;
+                        }
+                    }
+                    if (collided != 0) {
+                        pos.y = 30.0f + Stage_GetCamBoundsTopOffset();
+                    }
+                    if (pos.y == -3.4028235e38f) {
+                        HSD_ASSERTREPORT(0x6CB, NULL, "%d %f\n", collided,
+                                         (double) -3.4028235e38f);
+                    }
+                    HSD_JObjSetTranslate(jobj, &pos);
+                    *(f32*)(bp + 0xD0) = pos.y;
+                    *(f32*)(bp + 0xD8) = grBb_804D69C8->xD0;
+                    HSD_JObjClearFlagsAll(jobj, 0x10U);
+                    bp[0xC4] = 1;
+                }
+            }
+        }
+        break;
+    }
+    case 1:
+        if (pos.x > 0.0f) {
+            *(f32*)(bp + 0xD8) = 0.0f;
+            *(s32*)(bp + 0xC8) = (s32) grBb_804D69C8->xD8;
+            bp[0xC4] = 2;
+        } else {
+            f32 speed2 = 140.0f * Ground_801C0498();
+            if (grBigBlue_801E8794(jobj, &pos, 1,
+                    (60.0f * Ground_801C0498()) + 30.0f, speed2) != 0 ||
+                grBigBlue_801EAB50(&pos, 1,
+                    (60.0f * Ground_801C0498()) + 30.0f,
+                    140.0f * Ground_801C0498()) != 0)
+            {
+                *(f32*)(bp + 0xD8) = 0.0f;
+            } else {
+                *(f32*)(bp + 0xD8) = grBb_804D69C8->xD0;
+            }
+        }
+        goto block_76;
```

## PR #2428: Jj/grbigblue
Path: src/melee/gr/grbigblue.c
URL: https://github.com/doldecomp/melee/pull/2428#discussion_r3118466346
Author: jellejurre

Nope, because case 0 doesn't fall through to there, and the rest does

Hunk:
```diff
@@ -847,74 +1443,661 @@ bool grBigBlue_801E93D0(Ground_GObj* arg)
     return false;
 }
 
-/// #grBigBlue_801E93D8
-
-void grBigBlue_801E9F38(Ground_GObj* arg) {}
-
-void grBigBlue_801E9F3C(Ground_GObj* gobj)
+void grBigBlue_801E93D8(Ground_GObj* gobj)
 {
-    HSD_JObj* jobj = GET_JOBJ(gobj);
+    Vec3 pos;
+    Vec3 fwd;
+    Vec3 back;
+    Vec3 normal;
+    Vec3 euler;
+    s32 _pad_9C;
+    Vec3 check_pos;
     Ground* gp = gobj->user_data;
-    Vec3 v;
-    PAD_STACK(8);
-
-    Ground_801C2ED0(jobj, gp->map_id);
-    gp->x10_flags.b5 = 1;
-
-    v.x = v.y = v.z = Ground_801C0498();
-
-    HSD_JObjSetScale(jobj, &v);
-
-    ((u8*) gp)[0xC4] = 0;
-    *(s32*) ((u8*) GET_GROUND(Ground_801C2BA4(0x20)) + 0xD0) = 0;
-    grAnime_801C8138(gobj, gp->map_id, 0);
-}
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    u8* bp = (u8*) gp;
+    PAD_STACK(76);
 
-bool grBigBlue_801EA054(Ground_GObj* arg)
-{
-    return false;
-}
+    HSD_JObjGetTranslation2(jobj, &pos);
 
-/// #grBigBlue_801EA05C
+    if (grBigBlue_801EC58C(&pos, &normal, 500.0f) == -3.4028235e38f) {
+        normal.z = 0.0f;
+        normal.x = 0.0f;
+        normal.y = 1.0f;
+    }
 
-void grBigBlue_801EAB4C(Ground_GObj* arg) {}
+    euler.y = 0.0f;
+    euler.x = 0.0f;
+    euler.z = atan2f(-normal.x, normal.y);
 
-bool grBigBlue_801EAB50(Vec3* pos, s32 flag, f32 rangeX, f32 rangeY)
-{
-    HSD_GObj* gobj = Ground_801C2BA4(0x20);
-    u8* gp = (u8*) gobj->user_data;
-    HSD_JObj* jobj = GET_JOBJ(gobj);
-    s32 result = false;
-    f32 dist;
-    PAD_STACK(32);
+    fwd.x = 50.0f;
+    fwd.z = 0.0f;
+    fwd.y = 0.0f;
+    lbVector_ApplyEulerRotation(&fwd, &euler);
+    lbVector_Add(&fwd, &pos);
 
-    if ((int) gp[0xC4] == 2) {
-        dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        if (dist < 0.0F) {
-            dist = -(HSD_JObjGetTranslationX(jobj) - pos->x);
-        } else {
-            dist = HSD_JObjGetTranslationX(jobj) - pos->x;
-        }
+    back.x = -50.0f;
+    back.z = 0.0f;
+    back.y = 0.0f;
+    lbVector_ApplyEulerRotation(&back, &euler);
+    lbVector_Add(&back, &pos);
 
-        if (dist < rangeX) {
-            dist = HSD_JObjGetTranslationY(jobj) - pos->y;
-            if (dist < 0.0F) {
-                dist = -(HSD_JObjGetTranslationY(jobj) - pos->y);
-            } else {
-                dist = HSD_JObjGetTranslationY(jobj) - pos->y;
+    switch ((s8) bp[0xC4]) {
+    case 0:
+    {
+        if (*(s32*)((u8*) Ground_801C2BA4(0x20)->user_data + 0xCC) != 0) {
+            u32 cars_avail = 0;
+            u8* mgp = (u8*) Ground_801C2BA4(0x20)->user_data;
+            s32 count = 0;
+
+            if ((s8) mgp[0xE5] != 0) {
+                count = 1;
+                if (cars_avail != 0U) {
+                    cars_avail =
+                        *(u32*)(mgp + ((s8) mgp[0xE4] * 4) + 0xD4);
+                }
             }
-
-            if (dist < rangeY) {
-                result = true;
+            {
+                u8* p = mgp + 0x54;
+                if ((s8) mgp[0x139] != 0) {
+                    count++;
+                    if (cars_avail != 0U) {
+                        cars_avail =
+                            *(u32*)(mgp + ((s8) p[0xE4] * 4) + 0xD4);
+                    }
+                }
+                if ((s8) p[0x139] != 0) {
+                    if (cars_avail != 0U) {
+                    }
+                    count++;
+                }
             }
-        }
 
-        if (flag != 0) {
-            if ((s8) gp[0xC5] == -1) {
-                result = true;
-            }
-        }
-    }
+            if (count <= 1) {
+                f32 height;
+
+                memzero(&pos, 0xC);
+                pos.x = Stage_GetBlastZoneLeftOffset() - 50.0f;
+                height = grBigBlue_801EC58C(&pos, NULL, 500.0f);
+                if (height != -3.4028235e38f) {
+                    f32 speed;
+                    s32 collided;
+
+                    pos.y = height + grBb_804D69C8->xCC;
+                    speed = 140.0f * Ground_801C0498();
+                    collided = grBigBlue_801E8794(jobj, &pos, 1,
+                        2.0f * (60.0f * Ground_801C0498()), speed);
+                    if (collided == 0) {
+                        collided = grBigBlue_801EAB50(&pos, 1,
+                            2.0f * (60.0f * Ground_801C0498()), 25.0f);
+                    }
+                    if (collided == 0) {
+                        f32 cam_right = Stage_GetCamBoundsRightOffset();
+                        f32 cam_left = Stage_GetCamBoundsLeftOffset();
+                        f32 cam_bot = Stage_GetCamBoundsBottomOffset();
+                        if (pos.y <= grBigBlue_801E8B84(
+                                Stage_GetCamBoundsTopOffset(), cam_bot,
+                                cam_left, cam_right))
+                        {
+                            collided = 1;
+                        }
+                    }
+                    if (collided != 0) {
+                        pos.y = 30.0f + Stage_GetCamBoundsTopOffset();
+                    }
+                    if (pos.y == -3.4028235e38f) {
+                        HSD_ASSERTREPORT(0x6CB, NULL, "%d %f\n", collided,
+                                         (double) -3.4028235e38f);
+                    }
+                    HSD_JObjSetTranslate(jobj, &pos);
+                    *(f32*)(bp + 0xD0) = pos.y;
+                    *(f32*)(bp + 0xD8) = grBb_804D69C8->xD0;
+                    HSD_JObjClearFlagsAll(jobj, 0x10U);
+                    bp[0xC4] = 1;
+                }
+            }
+        }
+        break;
+    }
+    case 1:
+        if (pos.x > 0.0f) {
+            *(f32*)(bp + 0xD8) = 0.0f;
+            *(s32*)(bp + 0xC8) = (s32) grBb_804D69C8->xD8;
+            bp[0xC4] = 2;
+        } else {
+            f32 speed2 = 140.0f * Ground_801C0498();
+            if (grBigBlue_801E8794(jobj, &pos, 1,
+                    (60.0f * Ground_801C0498()) + 30.0f, speed2) != 0 ||
+                grBigBlue_801EAB50(&pos, 1,
+                    (60.0f * Ground_801C0498()) + 30.0f,
+                    140.0f * Ground_801C0498()) != 0)
+            {
+                *(f32*)(bp + 0xD8) = 0.0f;
+            } else {
+                *(f32*)(bp + 0xD8) = grBb_804D69C8->xD0;
+            }
+        }
+        goto block_76;
```
