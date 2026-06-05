## PR #2381: grcorneria work
Path: src/melee/gr/grcorneria.c
URL: https://github.com/doldecomp/melee/pull/2381#discussion_r3034038681
Author: jurrejelle

This should probably use HSD_ASSERT

Hunk:
```diff
@@ -557,15 +1125,146 @@ bool grCorneria_801E01A0(Ground_GObj* arg)
     return false;
 }
 
-/// #grCorneria_801E01A8
+void grCorneria_801E01A8(Ground_GObj* gobj)
+{
+    Ground* gp = GET_GROUND(gobj);
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+
+    if (gp->gv.corneria.xC4.value == 0 && gp->gv.corneria.xC6.flags.b0 != 1) {
+        HSD_JObjAddTranslationX(jobj, grCn_804D69A0->x88);
+        HSD_JObjSetTranslateY(jobj, -grCorneria_801E2EA0());
+
+        switch ((s8) gp->gv.corneria.xC5) {
+        case 0:
+            if (HSD_JObjGetTranslationX(jobj) >=
+                4800.0f * Ground_801C0498() / 2 + -1400.0f)
+            {
+                grCorneria_801E03C8(gobj, 8);
+                gp->gv.corneria.xC5 = 1;
+                return;
+            }
+            break;
+        case 1:
+            if (HSD_JObjGetTranslationX(jobj) >=
+                4800.0f * Ground_801C0498() / 2 + 1400.0f)
+            {
+                Ground_801C4A08(gobj);
+            }
+            break;
+        }
+    }
+}
 
 void grCorneria_801E03C4(Ground_GObj* arg) {}
 
-/// #grCorneria_801E03C8
+void grCorneria_801E03C8(Ground_GObj* gobj, int id)
+{
+    Ground* gp;
+    HSD_GObj* new_gobj;
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    f32 x = HSD_JObjGetTranslationX(jobj);
+    PAD_STACK(8);
+
+    new_gobj = grCorneria_801DD534(id);
+    gp = GET_GROUND(new_gobj);
 
-/// #grCorneria_801E0678
+    switch (id) {
+    case 8: {
+        f32 half = 3200.0f * Ground_801C0498() / 2;
+        HSD_JObjSetTranslateX(new_gobj->hsd_obj,
+                              x - (4800.0f * Ground_801C0498() / 2 + half));
+        gp->gv.corneria.xC5 = 0;
+        break;
+    }
+    case 9: {
+        f32 half = 3200.0f * Ground_801C0498() / 2;
+        HSD_JObjSetTranslateX(new_gobj->hsd_obj,
+                              x - (3200.0f * Ground_801C0498() / 2 + half));
+        gp->gv.corneria.xC5 = 0;
+        break;
+    }
+    case 4: {
+        f32 half = 4800.0f * Ground_801C0498() / 2;
+        HSD_JObjSetTranslateX(new_gobj->hsd_obj,
+                              x - (3200.0f * Ground_801C0498() / 2 + half));
+        gp->gv.corneria.xC5 = 0;
+        break;
+    }
+    }
+    if (new_gobj != NULL) {
+        HSD_GObjGXLink_80390908(new_gobj, 3, 0);
+    }
+}
+
+void grCorneria_801E0678(void)
+{
+    HSD_GObj* gobj;
+    Ground* gp;
+
+    gobj = Ground_801C2BA4(0xB);
+    if (gobj != NULL) {
+        Ground_801C4A08(gobj);
+    }
+    gobj = Ground_801C2BA4(8);
+    HSD_JObjSetTranslateX(gobj->hsd_obj, 0.0f);
+    gp = GET_GROUND(gobj);
+    gp->gv.corneria.offset_y.flags.b0 = 1;
+
+    gobj = Ground_801C2BA4(9);
+    gp = GET_GROUND(gobj);
+    gp->gv.corneria.xC6.flags.b0 = 1;
+    {
+        f32 half = 3200.0f * Ground_801C0498() / 2;
+        HSD_JObjSetTranslateX(gobj->hsd_obj,
+                              -(3200.0f * Ground_801C0498() / 2 + half));
+    }
+
+    gobj = Ground_801C2BA4(4);
+    gp = GET_GROUND(gobj);
+    gp->gv.corneria.xC6.flags.b0 = 1;
+    {
+        f32 half = 4800.0f * Ground_801C0498() / 2;
+        HSD_JObjSetTranslateX(gobj->hsd_obj,
+                              3200.0f * Ground_801C0498() / 2 + half);
+    }
+}
+
+int grCorneria_801E08CC(void)
+{
+    Vec3 pos;
+    HSD_GObj* gobj;
 
-/// #grCorneria_801E08CC
+    Camera_GetTransformInterest(&pos);
+    gobj = Ground_801C2BA4(8);
+    if (gobj != NULL) {
+        f32 x = HSD_JObjGetTranslationX(gobj->hsd_obj);
+        if (pos.x > -(3200.0f * Ground_801C0498() / 2 - x) &&
+            pos.x < 3200.0f * Ground_801C0498() / 2 + x)
+        {
+            return 8;
+        }
+    }
+    gobj = Ground_801C2BA4(9);
+    if (gobj != NULL) {
+        f32 x = HSD_JObjGetTranslationX(gobj->hsd_obj);
+        if (pos.x > -(3200.0f * Ground_801C0498() / 2 - x) &&
+            pos.x < 3200.0f * Ground_801C0498() / 2 + x)
+        {
+            return 9;
+        }
+    }
+    gobj = Ground_801C2BA4(4);
+    if (gobj != NULL) {
+        f32 x = HSD_JObjGetTranslationX(gobj->hsd_obj);
+        if (pos.x > -(4800.0f * Ground_801C0498() / 2 - x) &&
+            pos.x < 4800.0f * Ground_801C0498() / 2 + x)
+        {
+            return 4;
+        }
+    }
+    __assert("grcorneria.c", 0x9AC, "0");
```

## PR #2381: grcorneria work
Path: src/melee/gr/grcorneria.c
URL: https://github.com/doldecomp/melee/pull/2381#discussion_r3034041253
Author: jurrejelle

Is it possible to fix this pointer math?

Hunk:
```diff
@@ -855,7 +1913,51 @@ s32 grCorneria_801E2598(u32 arg0, u32 arg1)
     return val != 0;
 }
 
-/// #grCorneria_801E25C4
+void grCorneria_801E25C4(HSD_GObj* gobj, void* gv, int line, int arg3,
+                         int arg4)
+{
+    s16* table;
+    s16 joint0;
+    s16 joint1;
+    int i;
+    u8* v = gv;
+
+    i = 0;
+    *(s16*) (v + 4) = line;
+    *(s16*) (v + 6) = arg3;
+    *(s32*) (v + 8) = arg4;
+    table = &grCn_803E1D38.dialog_joints[0].joint0;
+    joint0 = grCn_803E1D38.dialog_joints[line].joint0;
+    joint1 = grCn_803E1D38.dialog_joints[line].joint1;
+    do {
+        if (i != 0 && *(s16*) (v + 4) != i) {
+            HSD_JObj* j0 = Ground_801C3FA4(gobj, table[0]);
+            if (j0 != NULL) {
+                HSD_JObjSetFlagsAll(j0, JOBJ_HIDDEN);
+            }
+            {
+                HSD_JObj* j1 = Ground_801C3FA4(gobj, table[1]);
+                if (j1 != NULL) {
+                    HSD_JObjSetFlagsAll(j1, JOBJ_HIDDEN);
+                }
+            }
+        }
+        i += 1;
+        table += 2;
+    } while (i < 5);
+    *(HSD_JObj**) (v + 0xC) = Ground_801C3FA4(gobj, joint0);
+    *(HSD_JObj**) (v + 0x10) = Ground_801C3FA4(gobj, joint1);
+    *(HSD_JObj**) (v + 0x14) = Ground_801C3FA4(gobj, 5);
+    *(s16*) (v + 0x18) = joint0;
+    *(s16*) (v + 0x1A) = joint1;
+    *(s16*) (v + 0x1C) = 5;
+    *(s16*) (v + 0) = 0;
+    *(s16*) (v + 2) = 0xA;
```

## PR #2381: grcorneria work
Path: src/melee/gr/grcorneria.c
URL: https://github.com/doldecomp/melee/pull/2381#discussion_r3034048457
Author: jurrejelle

not 100% required, but for cases like this there's `f32 angle = ABS(gp->gv.arwing.xE8);`
same for MIN, MAX and CLAMP

Hunk:
```diff
@@ -425,11 +755,131 @@ bool grCorneria_801DE560(Ground_GObj* arg)
     return false;
 }
 
-/// #grCorneria_801DE568
+void grCorneria_801DE568(Ground_GObj* gobj)
+{
+    Ground* gp = GET_GROUND(gobj);
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+
+    {
+        u8* entry = (u8*) &grCn_803E1D38 + gp->gv.arwing.xC8 * 4;
+        if (grCn_803E1D38.arwing_gobj[gp->gv.arwing.xC8] != NULL) {
+            f32 angle = gp->gv.arwing.xE8;
+            if (angle < 0.0f) {
+                angle = -angle;
+            }
```

## PR #2381: grcorneria work
Path: src/melee/gr/grcorneria.c
URL: https://github.com/doldecomp/melee/pull/2381#discussion_r3034055567
Author: jurrejelle

not really a comment, just wondering that most of these are f32s, how come they're being assigned as s32s 🤔

Hunk:
```diff
@@ -425,11 +755,131 @@ bool grCorneria_801DE560(Ground_GObj* arg)
     return false;
 }
 
-/// #grCorneria_801DE568
+void grCorneria_801DE568(Ground_GObj* gobj)
+{
+    Ground* gp = GET_GROUND(gobj);
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+
+    {
+        u8* entry = (u8*) &grCn_803E1D38 + gp->gv.arwing.xC8 * 4;
+        if (grCn_803E1D38.arwing_gobj[gp->gv.arwing.xC8] != NULL) {
+            f32 angle = gp->gv.arwing.xE8;
+            if (angle < 0.0f) {
+                angle = -angle;
+            }
+            if (angle < 10.0f) {
+                gp->gv.arwing.xE8 = 0.0f;
+                while (gp->gv.arwing.xDC < -M_PI) {
+                    gp->gv.arwing.xDC += 2.0 * M_PI;
+                }
+                {
+                    f32 rot = gp->gv.arwing.xDC;
+                    while (rot > M_PI) {
+                        gp->gv.arwing.xDC -= 2.0 * M_PI;
+                        rot = gp->gv.arwing.xDC;
+                    }
+                    if (rot < 0.0f) {
+                        rot = -rot;
+                    }
+                    if (rot < 1.0471976f) {
+                        HSD_JObjClearFlagsAll(jobj, JOBJ_HIDDEN);
+                    } else {
+                        HSD_JObjSetFlagsAll(jobj, JOBJ_HIDDEN);
+                    }
+                }
+            } else {
+                HSD_JObjSetFlagsAll(jobj, JOBJ_HIDDEN);
+            }
+            HSD_JObjSetTranslate(jobj, (Vec3*) &gp->gv.arwing.xE0);
+            {
+                f32 scale = Ground_801C0498();
+                {
+                    f32 s = scale * grCn_804D69A0->x70;
+                    HSD_JObjSetScaleX(jobj, s);
+                }
+                {
+                    f32 s = scale * grCn_804D69A0->x70;
+                    HSD_JObjSetScaleY(jobj, s);
+                }
+                {
+                    f32 s = scale * grCn_804D69A0->x70;
+                    HSD_JObjSetScaleZ(jobj, s);
+                }
+            }
+            Ground_801C2FE0(gobj);
+        } else {
+            s32 val = *(s32*) (entry + 0x48);
+            mpLib_80057BC0(grCn_803E1D38.x458[val]);
+            Ground_801C4A08(gobj);
+        }
+    }
+}
 
 void grCorneria_801DE8E0(Ground_GObj* arg) {}
 
-/// #grCorneria_801DE8E4
+void grCorneria_801DE8E4(Ground_GObj* gobj)
+{
+    Ground* gp = GET_GROUND(gobj);
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    f32 scale;
+    s32 idx;
+    s32 zero = 0;
+
+    static Vec3 zero_vec = { 0, 0, 0 };
+    scale = Ground_801C0498();
+    gp->gv.corneria.xC8 = (void*) grCn_804D69A4;
+    gp->gv.corneria.xE4 = zero_vec;
+    *(s32*) &gp->gv.corneria.offset_y.val = zero;
+    grAnime_801C7FF8(gobj, 7, 7, 0, 0.0f, 1.0f);
+    grAnime_801C7FF8(gobj, 8, 7, 0, 0.0f, 1.0f);
+    grAnime_801C8098(gobj, 2, 7, 3, 0.0f, 1.0f);
+    idx = grCn_803E1D38.arwing_type[(s32) gp->gv.corneria.xC8];
+    if (idx < 10) {
+        if (idx < 1) {
+            goto default_case;
+        }
+        {
+            s32 val = grCn_803E1D38.arwing_group[(s32) gp->gv.corneria.xC8];
+            HSD_GObj* arwing = grCorneria_801DD534(grCn_803E1D38.x444[val]);
+            *(HSD_GObj**) &gp->gv.corneria.offset_x = arwing;
+            if (arwing != NULL) {
+                Ground* agp =
+                    GET_GROUND(*(HSD_GObj**) &gp->gv.corneria.offset_x);
+                if (agp != NULL) {
+                    agp->gv.corneria.xC8 = gp->gv.corneria.xC8;
+                }
+            }
+        }
+    } else if (idx < 14) {
+        HSD_JObj* src_jobj = Ground_801C3FA4(
+            grCn_803E1D38.arwing_gobj[(s32) gp->gv.corneria.xC8], 4);
+        lb_8000C2F8(Ground_801C3FA4(gobj, 0), src_jobj);
+        *(s32*) &gp->gv.corneria.offset_x = zero;
+    } else {
+    default_case:
+        *(s32*) &gp->gv.corneria.offset_y.val = -1;
+        *(s32*) &gp->gv.corneria.xE4 = -1;
+    }
+    {
+        f32 s = scale * grCn_804D69A0->x70;
+        HSD_JObjSetScaleX(jobj, s);
+    }
+    {
+        f32 s = scale * grCn_804D69A0->x70;
+        HSD_JObjSetScaleY(jobj, s);
+    }
+    {
+        f32 s = scale * grCn_804D69A0->x70;
+        HSD_JObjSetScaleZ(jobj, s);
+    }
+    gp->gv.corneria.xC4.flags.b0 = 0;
+    *(s32*) &gp->gv.corneria.base_x = zero;
+    *(s32*) &gp->gv.corneria.xF0 = zero;
+    *(s32*) &gp->gv.corneria.xF4 = zero;
+    *(s32*) &gp->gv.corneria.xF8 = grCn_804D69A0->x68;
+    *(s32*) &gp->gv.corneria.xFC = zero;
```
