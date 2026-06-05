## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364260479
Author: jurrejelle

can this use an existing GET_GROUND()?

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```

## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364264661
Author: itsgrimetime

ooh maybe lemme check

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```

## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364305678
Author: itsgrimetime

Fixed in the latest push: removed the local user_data helper and switched the call sites in grIceMt_801F9ACC to GET_GROUND().

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gm/gm_1601.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364329962
Author: jurrejelle

Try to avoid #pragma's if possible

Hunk:
```diff
@@ -919,52 +919,60 @@ s32 fn_80161004(MatchEnd* match_end)
     return max;
 }
 
+#pragma push
+#pragma global_optimizer off
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gm/gm_1601.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364334727
Author: jurrejelle

This code is most likely a for loop, same with the repeated code below here

Hunk:
```diff
@@ -919,52 +919,60 @@ s32 fn_80161004(MatchEnd* match_end)
     return max;
 }
 
+#pragma push
+#pragma global_optimizer off
 s32 fn_80161154(MatchEnd* arg0)
 {
     u8 spC[4];
     MatchPlayerData* var_r31;
     s32 idx;
     s32 cnt;
+    MatchPlayerData* player;
+    u8* flags;
     s32 var_r3 = fn_80161004(arg0);
 
     idx = 4;
     cnt = 0;
     if (arg0->is_teams == 1) {
-        if (arg0->player_standings[0].slot_type != 3 &&
-            arg0->team_standings[arg0->player_standings[0].team].is_big_loser ==
-                var_r3) {
-            spC[0] = 1;
+        flags = spC;
+        player = &arg0->player_standings[0];
+        if (player->slot_type != 3 &&
+            arg0->team_standings[player->team].is_big_loser == var_r3) {
+            *flags = 1;
             cnt = 1;
             idx = 0;
         } else {
-            spC[0] = 0;
+            *flags = 0;
         }
-        if (arg0->player_standings[1].slot_type != 3 &&
-            arg0->team_standings[arg0->player_standings[1].team].is_big_loser ==
-                var_r3) {
-            spC[1] = 1;
+        flags++;
+        player++;
+        if (player->slot_type != 3 &&
+            arg0->team_standings[player->team].is_big_loser == var_r3) {
+            *flags = 1;
             cnt = 1;
             idx = 1;
         } else {
-            spC[1] = 0;
+            *flags = 0;
         }
-        if (arg0->player_standings[2].slot_type != 3 &&
-            arg0->team_standings[arg0->player_standings[2].team].is_big_loser ==
-                var_r3) {
-            spC[2] = 1;
+        flags++;
+        player++;
+        if (player->slot_type != 3 &&
+            arg0->team_standings[player->team].is_big_loser == var_r3) {
+            *flags = 1;
             cnt = 1;
             idx = 2;
         } else {
-            spC[2] = 0;
+            *flags = 0;
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gm/gmresult.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364349062
Author: jurrejelle

This is probably a for loop? idk about the out-of-order 6/7 but good to check anyways

Hunk:
```diff
@@ -1134,50 +1126,374 @@ void fn_80175D34(void)
     }
 }
 
-/// Initialize results screen panel and UI elements
-/// This is a very complex function (~800 lines) that:
-/// - Loads joint objects from scene data
-/// - Sets up GX link callbacks
-/// - Initializes player stats UI elements
-/// - Creates HSD_Text objects for scores/times
-/// NOTE: This implementation is a best-effort attempt, likely not matching
+static const u8 lbl_803B7B18[40][2] = {
+    { 0x00, 0x0 }, { 0x01, 0x1 },  { 0x02, 0x2 }, { 0x03, 0x3 }, { 0x04, 0x5 },
+    { 0x05, 0x6 }, { 0x06, 0xD },  { 0x07, 0x6 }, { 0x08, 0x6 }, { 0x09, 0x7 },
+    { 0x0A, 0x9 }, { 0x0B, 0x8 },  { 0x0C, 0x6 }, { 0x0D, 0x9 }, { 0x0E, 0x4 },
+    { 0x0F, 0x9 }, { 0x10, 0xA },  { 0x11, 0xC }, { 0x12, 0xD }, { 0x13, 0xD },
+    { 0x14, 0x2 }, { 0x15, 0xD },  { 0x16, 0x6 }, { 0x17, 0x7 }, { 0x18, 0x9 },
+    { 0x19, 0xD }, { 0 },          { 0 },         { 0 },         { 0 },
+    { 0 },         { 0 },          { 0 },         { 0 },         { 0 },
+    { 0 },         { 0x40, 0x80 },
+};
+
 void fn_80175DC8(HSD_GObj* gobj)
 {
-    MatchEnd* me;
-    SceneDesc* desc;
+    HSD_JObj* sp108;
+    HSD_JObj* sp104;
+    HSD_JObj* sp100;
+    HSD_JObj* spFC;
+    HSD_JObj* spF4;
+    HSD_JObj* spEC;
+    HSD_JObj* spE4;
+    HSD_JObj* spDC;
+    HSD_JObj* spD4;
+    HSD_JObj* spCC;
+    HSD_JObj* spC4;
+    HSD_JObj* spBC;
+    HSD_JObj* spB4;
+    HSD_JObj* spAC;
+    HSD_JObj* spA4;
+    HSD_JObj* sp9C;
+    HSD_JObj* sp94;
+    HSD_JObj* sp8C;
+    HSD_JObj* sp84;
+    s32 sp80;
+    s32 sp7C;
+    s32 sp78;
+    Point3d sp6C;
+    s32 sp68;
+    s32 sp64;
+    s32 sp60;
+    Point3d sp54;
+    s32 sp50;
+    s32 sp4C;
+    s32 sp48;
+    Point3d sp3C;
+    s32 sp38;
+    s32 sp34;
+    s32 sp30;
+    Point3d sp24;
     DynamicModelDesc* model;
     HSD_JObj* jobj;
-    HSD_JObj* temp_jobj;
+    MatchEnd* me;
+    struct ResultsPlayerData* pdata;
     s32 i;
-    Vec3 pos;
-    PAD_STACK(264);
 
-    me = lbl_8046DBE8.x94;
-    desc = lbl_8046DBE8.pnlsce;
-    model = desc->models[0];
+    PAD_STACK(104);
 
+    me = lbl_8046DBE8.x94;
+    model = lbl_8046DBE8.pnlsce->models[0];
     jobj = HSD_JObjLoadJoint(model->joint);
     HSD_GObjObject_80390A70(gobj, HSD_GObj_804D7849, jobj);
     GObj_SetupGXLink(gobj, fn_80175038, 11, 0);
     lb_8000C07C(jobj, 0, model->anims, model->matanims, model->shapeanims);
     HSD_JObjReqAnimAll(jobj, 0.0F);
     HSD_JObjAnimAll(jobj);
 
-    lb_80011E24(jobj, &temp_jobj, 0x41, -1);
-    /// fn_80179F84 takes temp_jobj but is declared as UNK_PARAMS
-
-    lb_80011E24(jobj, &lbl_8046DBE8.x24, 0x68, -1);
-    lb_80011E24(jobj, &lbl_8046DBE8.x28, 0x69, -1);
+    lb_80011E24(jobj, &sp108, 0x41, -1);
+    fn_80179F84(sp108);
+    sp104 = jobj;
+    lb_80011E24(jobj, &sp104, 0x68, -1);
+    lbl_8046DBE8.x24 = sp104;
+    sp100 = jobj;
+    lb_80011E24(jobj, &sp100, 0x69, -1);
+    lbl_8046DBE8.x28 = sp100;
 
     for (i = 0; i < 6; i++) {
-        lb_80011E24(jobj, &lbl_8046DBE8.x34[i], 0x62 + i, -1);
+        lb_80011E24(jobj, &lbl_8046DBE8.x34[i], i + 0x62, -1);
     }
 
-    lb_80011E24(jobj, &lbl_8046DBE8.x30, 0x0A, -1);
+    spFC = jobj;
+    lb_80011E24(jobj, &spFC, 0xA, -1);
+    lbl_8046DBE8.x30 = spFC;
+
+    pdata = lbl_8046DBE8.player_data;
+    for (i = 0; i < 4; i++, pdata++) {
+        pdata->x0_0 = 0;
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gm/gmresult.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364350435
Author: jurrejelle

Try to remove any M2C_FIELD if possibe

Hunk:
```diff
@@ -1134,50 +1126,374 @@ void fn_80175D34(void)
     }
 }
 
-/// Initialize results screen panel and UI elements
-/// This is a very complex function (~800 lines) that:
-/// - Loads joint objects from scene data
-/// - Sets up GX link callbacks
-/// - Initializes player stats UI elements
-/// - Creates HSD_Text objects for scores/times
-/// NOTE: This implementation is a best-effort attempt, likely not matching
+static const u8 lbl_803B7B18[40][2] = {
+    { 0x00, 0x0 }, { 0x01, 0x1 },  { 0x02, 0x2 }, { 0x03, 0x3 }, { 0x04, 0x5 },
+    { 0x05, 0x6 }, { 0x06, 0xD },  { 0x07, 0x6 }, { 0x08, 0x6 }, { 0x09, 0x7 },
+    { 0x0A, 0x9 }, { 0x0B, 0x8 },  { 0x0C, 0x6 }, { 0x0D, 0x9 }, { 0x0E, 0x4 },
+    { 0x0F, 0x9 }, { 0x10, 0xA },  { 0x11, 0xC }, { 0x12, 0xD }, { 0x13, 0xD },
+    { 0x14, 0x2 }, { 0x15, 0xD },  { 0x16, 0x6 }, { 0x17, 0x7 }, { 0x18, 0x9 },
+    { 0x19, 0xD }, { 0 },          { 0 },         { 0 },         { 0 },
+    { 0 },         { 0 },          { 0 },         { 0 },         { 0 },
+    { 0 },         { 0x40, 0x80 },
+};
+
 void fn_80175DC8(HSD_GObj* gobj)
 {
-    MatchEnd* me;
-    SceneDesc* desc;
+    HSD_JObj* sp108;
+    HSD_JObj* sp104;
+    HSD_JObj* sp100;
+    HSD_JObj* spFC;
+    HSD_JObj* spF4;
+    HSD_JObj* spEC;
+    HSD_JObj* spE4;
+    HSD_JObj* spDC;
+    HSD_JObj* spD4;
+    HSD_JObj* spCC;
+    HSD_JObj* spC4;
+    HSD_JObj* spBC;
+    HSD_JObj* spB4;
+    HSD_JObj* spAC;
+    HSD_JObj* spA4;
+    HSD_JObj* sp9C;
+    HSD_JObj* sp94;
+    HSD_JObj* sp8C;
+    HSD_JObj* sp84;
+    s32 sp80;
+    s32 sp7C;
+    s32 sp78;
+    Point3d sp6C;
+    s32 sp68;
+    s32 sp64;
+    s32 sp60;
+    Point3d sp54;
+    s32 sp50;
+    s32 sp4C;
+    s32 sp48;
+    Point3d sp3C;
+    s32 sp38;
+    s32 sp34;
+    s32 sp30;
+    Point3d sp24;
     DynamicModelDesc* model;
     HSD_JObj* jobj;
-    HSD_JObj* temp_jobj;
+    MatchEnd* me;
+    struct ResultsPlayerData* pdata;
     s32 i;
-    Vec3 pos;
-    PAD_STACK(264);
 
-    me = lbl_8046DBE8.x94;
-    desc = lbl_8046DBE8.pnlsce;
-    model = desc->models[0];
+    PAD_STACK(104);
 
+    me = lbl_8046DBE8.x94;
+    model = lbl_8046DBE8.pnlsce->models[0];
     jobj = HSD_JObjLoadJoint(model->joint);
     HSD_GObjObject_80390A70(gobj, HSD_GObj_804D7849, jobj);
     GObj_SetupGXLink(gobj, fn_80175038, 11, 0);
     lb_8000C07C(jobj, 0, model->anims, model->matanims, model->shapeanims);
     HSD_JObjReqAnimAll(jobj, 0.0F);
     HSD_JObjAnimAll(jobj);
 
-    lb_80011E24(jobj, &temp_jobj, 0x41, -1);
-    /// fn_80179F84 takes temp_jobj but is declared as UNK_PARAMS
-
-    lb_80011E24(jobj, &lbl_8046DBE8.x24, 0x68, -1);
-    lb_80011E24(jobj, &lbl_8046DBE8.x28, 0x69, -1);
+    lb_80011E24(jobj, &sp108, 0x41, -1);
+    fn_80179F84(sp108);
+    sp104 = jobj;
+    lb_80011E24(jobj, &sp104, 0x68, -1);
+    lbl_8046DBE8.x24 = sp104;
+    sp100 = jobj;
+    lb_80011E24(jobj, &sp100, 0x69, -1);
+    lbl_8046DBE8.x28 = sp100;
 
     for (i = 0; i < 6; i++) {
-        lb_80011E24(jobj, &lbl_8046DBE8.x34[i], 0x62 + i, -1);
+        lb_80011E24(jobj, &lbl_8046DBE8.x34[i], i + 0x62, -1);
     }
 
-    lb_80011E24(jobj, &lbl_8046DBE8.x30, 0x0A, -1);
+    spFC = jobj;
+    lb_80011E24(jobj, &spFC, 0xA, -1);
+    lbl_8046DBE8.x30 = spFC;
+
+    pdata = lbl_8046DBE8.player_data;
+    for (i = 0; i < 4; i++, pdata++) {
+        pdata->x0_0 = 0;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spF4, 0x42, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spF4, 0x43, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spF4, 0x44, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spF4, 0x45, -1);
+            break;
+        }
+        pdata->jobjs[0] = spF4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spEC, 0x1D, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spEC, 0x25, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spEC, 0x2D, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spEC, 0x35, -1);
+            break;
+        }
+        pdata->jobjs[1] = spEC;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spE4, 0x1E, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spE4, 0x26, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spE4, 0x2E, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spE4, 0x36, -1);
+            break;
+        }
+        pdata->jobjs[2] = spE4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spDC, 0x3D, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spDC, 0x3E, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spDC, 0x3F, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spDC, 0x40, -1);
+            break;
+        }
+        pdata->jobjs[3] = spDC;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spD4, 0x21, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spD4, 0x29, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spD4, 0x31, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spD4, 0x39, -1);
+            break;
+        }
+        pdata->jobjs[5] = spD4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spCC, 0x46, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spCC, 0x49, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spCC, 0x4C, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spCC, 0x4F, -1);
+            break;
+        }
+        pdata->jobjs[4] = spCC;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spC4, 0x52, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spC4, 0x53, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spC4, 0x54, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spC4, 0x55, -1);
+            break;
+        }
+        pdata->jobjs[6] = spC4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spBC, 0x19, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spBC, 0x1A, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spBC, 0x1B, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spBC, 0x1C, -1);
+            break;
+        }
+        pdata->jobjs[7] = spBC;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spB4, 0x6C, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spB4, 0x6E, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spB4, 0x70, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spB4, 0x72, -1);
+            break;
+        }
+        pdata->jobjs[8] = spB4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spAC, 0x6B, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spAC, 0x6D, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spAC, 0x6F, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spAC, 0x71, -1);
+            break;
+        }
+        pdata->jobjs[9] = spAC;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &spA4, 0x23, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &spA4, 0x2B, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &spA4, 0x33, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &spA4, 0x3B, -1);
+            break;
+        }
+        pdata->jobjs[10] = spA4;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &sp9C, 0x24, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &sp9C, 0x2C, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &sp9C, 0x34, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &sp9C, 0x3C, -1);
+            break;
+        }
+        pdata->jobjs[11] = sp9C;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &sp94, 0x56, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &sp94, 0x57, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &sp94, 0x58, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &sp94, 0x59, -1);
+            break;
+        }
+        pdata->jobjs[12] = sp94;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &sp8C, 0x5A, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &sp8C, 0x5B, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &sp8C, 0x5C, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &sp8C, 0x5D, -1);
+            break;
+        }
+        pdata->jobjs[13] = sp8C;
+        switch (i) {
+        case 0:
+            lb_80011E24(jobj, &sp84, 0x5E, -1);
+            break;
+        case 1:
+            lb_80011E24(jobj, &sp84, 0x5F, -1);
+            break;
+        case 2:
+            lb_80011E24(jobj, &sp84, 0x60, -1);
+            break;
+        case 3:
+            lb_80011E24(jobj, &sp84, 0x61, -1);
+            break;
+        }
+        pdata->jobjs[14] = sp84;
+        lb_8000B1CC(pdata->jobjs[12], NULL, &pdata->stats_position);
+    }
 
-    /// The rest of the function has complex switch statements
-    /// for each player slot (0-3) loading many joints and text objects
-    /// This would require ~700 more lines of code to match exactly
+    fn_801785B0(gobj);
+    switch (me->x5) {
+    case 0:
+        sp78 = M2C_FIELD(&lbl_803B7B18, s32*, 0x44);
+        sp7C = M2C_FIELD(&lbl_803B7B18, s32*, 0x48);
+        sp80 = M2C_FIELD(&lbl_803B7B18, s32*, 0x4C);
+        if (lbl_8046DBE8.x2C != NULL) {
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gr/grkongo.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364355819
Author: jurrejelle

probably a loop

Hunk:
```diff
@@ -1018,75 +1024,77 @@ void grKongo_801D6AFC(void)
             var_ctr_5 -= 1;
         } while (var_ctr_5 != 0);
     }
-#if 0
-    var_r7 = &sp8;
+    var_r7 = sp8;
     {
-        var_ctr_6 = 3;
-        var_r3_6 = var_r7;
+        s32 var_ctr_6 = 3;
+        f32* var_r3_6 = var_r7;
         do {
-            var_r3_6->unk0 = 0.0f;
-            var_r3_6->unk4 = 0.0f;
-            var_r3_6->unk8 = 0.0f;
-            var_r3_6->unkC = 0.0f;
-            var_r3_6->unk10 = 0.0f;
-            var_r3_6 += 0x14;
+            var_r3_6[0] = 0.0f;
+            var_r3_6[1] = 0.0f;
+            var_r3_6[2] = 0.0f;
+            var_r3_6[3] = 0.0f;
+            var_r3_6[4] = 0.0f;
+            var_r3_6 += 5;
             var_ctr_6 -= 1;
         } while (var_ctr_6 != 0);
     }
-    var_ctr_7 = 0xF;
-    var_r3_7 = grKg_803E188C;
-    var_r4 = var_r7;
-    var_r8 = 0;
-    do {
-        if ((s16) var_r3_7->unk2 == 0) {
-            if ((var_r8 != 0) && ((s16) var_r3_7->unk-16 == 0)) {
-                rad_compare_c(var_r3_7[1]->unkC - var_r3_7->unkC, grKg_804D6980->unk9C,
-                       grKg_804D6980->unkA0, var_r4);
+    {
+        s32 var_ctr_7 = 0xF;
+        _struct_grKg_803E188C_0x18* var_r3_7 = grKg_803E188C;
+        f32* var_r4 = var_r7;
+        s32 var_r8 = 0;
+        do {
+            if (var_r3_7->unk2 == 0) {
+                if ((var_r8 != 0) && (var_r3_7[-1].unk2 == 0)) {
+                    rad_compare_c(var_r3_7[-1].unkC - var_r3_7->unkC,
+                                  grKg_804D6980->unk9C, grKg_804D6980->unkA0,
+                                  var_r4);
+                }
+                if (((u32) var_r8 != 0xEU) && (var_r3_7[1].unk2 == 0)) {
+                    rad_compare_c(var_r3_7[1].unkC - var_r3_7->unkC,
+                                  grKg_804D6980->unk9C, grKg_804D6980->unkA0,
+                                  var_r4);
+                }
             }
-            if (((u32) var_r8 != 0xEU) && ((s16) var_r3_7[1].unk2 == 0)) {
-                rad_compare_c(var_r3_7[1]->unkC - var_r3_7->unkC, grKg_804D6980->unk9C,
-                       grKg_804D6980->unkA0, var_r4);
+            var_r3_7 += 1;
+            var_r4 += 1;
+            var_r8 += 1;
+            var_ctr_7 -= 1;
+        } while (var_ctr_7 != 0);
+    }
+    {
+        s32 var_ctr_8 = 3;
+        f32* var_r7_2 = var_r7;
+        do {
+            f32 temp_f2 = *var_r7_2;
+            if (temp_f2 != 0.0) {
+                var_r6->unkC += temp_f2;
             }
-        }
-        var_r3_7 += 0x18;
-        var_r4 += 4;
-        var_r8 += 1;
-        var_ctr_7 -= 1;
-    } while (var_ctr_7 != 0);
-    var_ctr_8 = 3;
-    do {
-        temp_f2_11 = var_r7->unk0;
-        if ((bitwise f32) 0.0 != temp_f2_11) {
-            var_r6->unkC += temp_f2_11;
-        }
-        temp_f2_12 = var_r7->unk4;
-        temp_r7 = var_r7 + 4;
-        temp_r6 = &var_r6[1];
-        if ((bitwise f32) 0.0 != temp_f2_12) {
-            temp_r6->unkC += temp_f2_12;
-        }
-        temp_f2_13 = temp_r7->unk4;
-        temp_r7_2 = temp_r7 + 4;
-        temp_r6_2 = temp_r6 + 0x18;
-        if ((bitwise f32) 0.0 != temp_f2_13) {
-            temp_r6_2->unkC += temp_f2_13;
-        }
-        temp_f2_14 = temp_r7_2->unk4;
-        temp_r7_3 = temp_r7_2 + 4;
-        temp_r6_3 = temp_r6_2 + 0x18;
-        if ((bitwise f32) 0.0 != temp_f2_14) {
-            temp_r6_3->unkC += temp_f2_14;
-        }
-        temp_f2_15 = temp_r7_3->unk4;
-        temp_r6_4 = temp_r6_3 + 0x18;
-        if ((bitwise f32) 0.0 != temp_f2_15) {
-            temp_r6_4->unkC += temp_f2_15;
-        }
-        var_r7 = temp_r7_3 + 4 + 4;
-        var_r6 = temp_r6_4 + 0x18;
-        var_ctr_8 -= 1;
-    } while (var_ctr_8 != 0);
-#endif
+            temp_f2 = *++var_r7_2;
+            var_r6 += 1;
+            if (temp_f2 != 0.0) {
+                var_r6->unkC += temp_f2;
+            }
+            temp_f2 = *++var_r7_2;
+            var_r6 += 1;
+            if (temp_f2 != 0.0) {
+                var_r6->unkC += temp_f2;
+            }
+            temp_f2 = *++var_r7_2;
+            var_r6 += 1;
+            if (temp_f2 != 0.0) {
+                var_r6->unkC += temp_f2;
+            }
+            temp_f2 = *++var_r7_2;
+            var_r6 += 1;
+            if (temp_f2 != 0.0) {
+                var_r6->unkC += temp_f2;
+            }
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/gr/grvenom.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364360566
Author: jurrejelle

any "jobj.h" asserts are indications of an included/run jobj.c function, I'll expand upon this a bit more

Hunk:
```diff
@@ -1439,128 +1440,97 @@ void grVenom_80205F30(Ground_GObj* gobj)
     jobj = gobj->hsd_obj;
     sp94 = grVe_803B82D0;
     sp88 = grVe_803B82DC;
+    PAD_STACK(0x3C);
 
-    if (grVe_804D6A40 != 0) {
+    if (grVe_804D6A3C != 0) {
         return;
     }
 
     entry = base + gp->gv.venom.xC8;
     if ((u32) entry[8] != 0U) {
         if (entry[14] == 4) {
             tmp_jobj = Ground_801C3FA4((HSD_GObj*) gobj, 1);
-            if (tmp_jobj == NULL) {
-                __assert("jobj.h", 0x2A9, "jobj");
-            }
-            if (tmp_jobj->flags & 0x20000) {
-                __assert("jobj.h", 0x2AA, (char*) base + 0x2D4);
-            }
-            tmp_jobj->rotate.z = 0.0F;
-            if (!(tmp_jobj->flags & 0x02000000)) {
-                if (tmp_jobj != NULL) {
-                    s32 dirty = 0;
-                    u32 f = tmp_jobj->flags;
-                    if (!(f & 0x800000) && (f & 0x40)) {
-                        dirty = 1;
-                    }
-                    if (dirty == 0) {
-                        HSD_JObjSetMtxDirtySub(tmp_jobj);
-                    }
-                }
-            }
+            HSD_JObjSetRotationZ(tmp_jobj, 0.0F);
         }
 
         state = base[gp->gv.venom.xC8 + 11];
-        if (state < 8) {
-            if (state >= 1) {
-                if (jobj == NULL) {
-                    __assert("jobj.h", 0x294, "jobj");
-                }
-                if (jobj->flags & 0x20000) {
-                    __assert("jobj.h", 0x295, (char*) base + 0x2D4);
-                }
-                jobj->rotate.y = 0.0F;
-                if (!(jobj->flags & 0x02000000)) {
-                    if (jobj != NULL) {
-                        s32 dirty = 0;
-                        u32 f = jobj->flags;
-                        if (!(f & 0x800000) && (f & 0x40)) {
-                            dirty = 1;
-                        }
-                        if (dirty == 0) {
-                            HSD_JObjSetMtxDirtySub(jobj);
-                        }
-                    }
-                }
+        if (state >= 8) {
+            if (state < 0xC) {
+                goto venom_80205F30_far_type;
+            }
+        } else if (state >= 1) {
+                HSD_JObjSetRotationY(jobj, 0.0F);
 
-                if (gp->gv.venom.xF4 != 0) {
-                    if (gp->gv.venom.xF4 < 0 || gp->gv.venom.xF4 >= 5) {
-                        /* nothing */
-                    } else {
-                        if (grAnime_801C83D0((HSD_GObj*) gobj, 0, 7) != 0) {
-                            gp->gv.venom.xF4 = 0;
-                            gp->gv.venom.xF8 =
-                                (s32) * (f32*) ((u8*) grVe_804D6A30 + 0x2C);
-                        }
+                {
+                    s32 anim_state = gp->gv.venom.xF4;
+                    if (anim_state == 0) {
+                        goto venom_80205F30_anim_zero;
                     }
-                } else {
-                    if (gp->gv.venom.xF8 <= 0) {
-                        gp->gv.venom.xF4 = HSD_Randi(4) + 1;
-                        fire_kind = -1;
-                        {
-                            Ground* gp_re = gobj->user_data;
-                            s32 v = base[gp_re->gv.venom.xC8 + 14];
-                            if (v == 4) {
+                    if (anim_state < 0) {
+                        goto venom_80205F30_anim_done;
+                    }
+                    if (anim_state >= 5) {
+                        goto venom_80205F30_anim_done;
+                    }
+                    goto venom_80205F30_check_anim;
+                venom_80205F30_anim_zero:
+                    {
+                        if (gp->gv.venom.xF8 <= 0) {
+                            gp->gv.venom.xF4 = HSD_Randi(4) + 1;
+                            fire_kind = -1;
+                            switch (base[GET_GROUND(gobj)->gv.venom.xC8 + 14]) {
+                            case 0:
+                                break;
+                            case 4:
                                 fire_kind = 1;
-                            } else if (v >= 4) {
-                                /* default branch (>= 4 but != 4 - shouldn't
-                                 * happen for s32 == 4 case) */
-                            } else if (v == 0) {
-                                /* case 0: no change */
-                            } else if (v >= 0) {
+                                break;
+                            default:
                                 fire_kind = 0;
+                                break;
                             }
-                        }
-                        {
+                            {
+                                s32 idx0 = base[gp->gv.venom.xC8 + 14];
+                                s32 anim_id = base[idx0 * 4 + 0xD6];
+                                grAnime_801C8098(
+                                    (HSD_GObj*) gobj, anim_id, 7,
+                                    *(s32*) ((u8*) base + gp->gv.venom.xF4 * 8 +
+                                             fire_kind * 4 + 0x2FC),
+                                    0.0F, 1.0F);
+                            }
+                        } else {
                             s32 idx0 = base[gp->gv.venom.xC8 + 14];
-                            s32 anim_id =
-                                base[idx0 * 4 +
-                                     0xD6]; /* +0x358 = +0xD6 in s32 */
-                            f32 frame = ((
-                                f32*) ((u8*) base + gp->gv.venom.xF4 * 8 +
-                                       fire_kind * 4))[0xBF]; /* 0x2FC offset;
-                                                                 but better: */
-                            (void) frame;
-                            grAnime_801C8098((HSD_GObj*) gobj, anim_id, 7,
-                                             *(s32*) ((u8*) base +
-                                                      gp->gv.venom.xF4 * 8 +
-                                                      fire_kind * 4 + 0x2FC),
-                                             0.0F, 1.0F);
-                        }
-                    } else {
-                        s32 idx0 = base[gp->gv.venom.xC8 + 14];
-                        s32 anim_id = base[idx0 * 4 + 0xD6];
-                        tmp_jobj = Ground_801C3FA4((HSD_GObj*) gobj, anim_id);
-                        if (tmp_jobj == NULL) {
-                            __assert("jobj.h", 0x2A9, "jobj");
-                        }
-                        if (tmp_jobj->flags & 0x20000) {
-                            __assert("jobj.h", 0x2AA, (char*) base + 0x2D4);
-                        }
-                        tmp_jobj->rotate.z = 0.0F;
-                        if (!(tmp_jobj->flags & 0x02000000)) {
-                            if (tmp_jobj != NULL) {
-                                s32 dirty = 0;
-                                u32 f = tmp_jobj->flags;
-                                if (!(f & 0x800000) && (f & 0x40)) {
-                                    dirty = 1;
-                                }
-                                if (dirty == 0) {
-                                    HSD_JObjSetMtxDirtySub(tmp_jobj);
+                            s32 anim_id = base[idx0 * 4 + 0xD6];
+                            tmp_jobj = Ground_801C3FA4((HSD_GObj*) gobj, anim_id);
+                            if (tmp_jobj == NULL) {
+                                __assert("jobj.h", 0x2A9, "jobj");
+                            }
+                            if (tmp_jobj->flags & 0x20000) {
+                                __assert("jobj.h", 0x2AA, (char*) base + 0x2D4);
+                            }
```

## PR #2581: Improve matching in Melee source files
Path: src/melee/lb/lb_00F9.c
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364365924
Author: jurrejelle

undo this, this is likely a regression/"fake match", the HSD_Jobj is the way it was written

Hunk:
```diff
@@ -884,7 +888,10 @@ void lb_8001044C(DynamicsDesc* desc, void* colliders_raw, int num_colliders,
                 HSD_QuatLib_8037EC4C(&angle_quat, &euler_quat, &result_quat);
                 PSMTXQuat(bone_mtx, &result_quat);
                 HSD_QuatLib_8037EB28(bone_mtx, &euler_angles);
-                HSD_JObjSetRotation(jobj, &euler_quat);
+                if (jobj == NULL) {
+                    __assert("jobj.h", 618, "jobj");
+                }
+                jobj->rotate = *(Quaternion*) &euler_angles;
```

## PR #2581: Improve matching in Melee source files
Path: tools/changes_fmt.py
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364376064
Author: jurrejelle

revert these changes

Hunk:
```diff
@@ -3,6 +3,7 @@
 from argparse import ArgumentParser
 import os
```

## PR #2581: Improve matching in Melee source files
Path: tools/project.py
URL: https://github.com/doldecomp/melee/pull/2581#discussion_r3364376897
Author: jurrejelle

revert these changes

Hunk:
```diff
@@ -1420,13 +1420,14 @@ def add_unit(build_obj: BuildConfigUnit, link_step: LinkStep):
             rule="changes_fmt",
             inputs=report_changes_path,
             implicit=changes_fmt,
+            variables={"args": "--fail-on-regressions"},
```

## PR #2510: Match `mnEvent_8024CE74`
Path: src/melee/mn/mnnamenew.c
URL: https://github.com/doldecomp/melee/pull/2510#discussion_r3254910800
Author: ribbanya

This is slop. At best, it prematurely fixes sdata.

Hunk:
```diff
@@ -1,6 +1,15 @@
 #include "mnnamenew.h"
 
 #include "baselib/debug.h"
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0)                                                      \
+            : __assert(mnNameNew_804D4F84, line, mnNameNew_804D4F8C))
+#include "sysdolphin/baselib/jobj.h"
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0) : __assert(__FILE__, line, #cond))
```

## PR #2510: Match `mnEvent_8024CE74`
Path: src/melee/mn/mnnamenew.h
URL: https://github.com/doldecomp/melee/pull/2510#discussion_r3254912236
Author: ribbanya

These are static literals and don't need to be declared anywhere.

Hunk:
```diff
@@ -7,6 +7,9 @@
 
 #include <baselib/forward.h>
 
+extern char mnNameNew_804D4F84[7];
+extern char mnNameNew_804D4F8C[5];
```

## PR #2491: gr: match grheal
Path: src/melee/gr/grheal.c
URL: https://github.com/doldecomp/melee/pull/2491#discussion_r3245710199
Author: itsgrimetime

ah actually I missed this - will try to massage this into a direct string reference

Hunk:
```diff
@@ -307,25 +364,42 @@ void grHeal_8021F708(Ground_GObj* gobj) {}
 
 u32 grHeal_8021F70C(u32 character_id)
 {
+    s32* base;
     s32* entry;
+    s32 value;
     int frame;
 
+    base = grHeal_803E83B8;
     frame = 0;
-    if ((s32) character_id == 0x13) {
-        character_id = 0x12;
-    }
 
-    entry = (s32*) &grHeal_803E851C[0xD];
+    if ((s32) character_id != 0x13) {
+        goto loop_start;
+    }
+    character_id = 0x12;
+    goto loop_start;
 
-    while (entry[frame] != -1 && entry[frame] != character_id) {
-        frame++;
+loop_compare:
+    if ((s32) character_id == value) {
+        goto loop_done;
+    }
+    entry++;
+    frame++;
+loop_check:
+    value = *entry;
+    if (value != -1) {
+        goto loop_compare;
     }
 
-    if (grHeal_803E83B8[frame] == -1) {
-        OSReport("*** Not found Next Player!(%d)\n", frame);
+loop_done:
+    if (base[frame + 0xD] == -1) {
+        OSReport((char*) base + 0x170, character_id);
```

## PR #2484: Match HSD_ByteCodeEval
Path: src/sysdolphin/baselib/bytecode.c
URL: https://github.com/doldecomp/melee/pull/2484#discussion_r3221043907
Author: itsgrimetime

idk why codex insisted on renaming this everywhere. can clean up if preferred

Hunk:
```diff
@@ -158,57 +165,57 @@ float HSD_ByteCodeEval(u8* bytecode, float* args, int nb_args)
             break;
         case 0x0C:
             HSD_ASSERT(405, stack);
-            fv = HSD_Randf();
```

## PR #2466: resplit, match, and link ftPp_SpecialS.c
Path: src/melee/ft/chara/ftPopo/ftPp_SpecialHi.c
URL: https://github.com/doldecomp/melee/pull/2466#discussion_r3205218907
Author: lukechampine

please forgive this hideous hack. If there's a better way to align the floats, I'm all ears!

Hunk:
```diff
@@ -0,0 +1,932 @@
+
+
+#include "ft/chara/ftPopo/ftPp_SpecialHi.h"
+
+#include "ft/chara/ftCommon/ftCo_FallSpecial.h"
+#include "ft/chara/ftCommon/ftCo_Landing.h"
+#include "ft/chara/ftPopo/ftPp_SpecialS.h"
+#include "ft/fighter.h"
+#include "ft/ft_081B.h"
+#include "ft/ft_0892.h"
+#include "ft/ftcliffcommon.h"
+#include "ft/ftcommon.h"
+#include "ft/ftparts.h"
+#include "ftNana/ftNn_Init.h"
+#include "ftPopo/ftPp_Init.h"
+#include "it/items/itclimbersstring.h"
+#include "it/types.h"
+#include "lb/lb_00B0.h"
+#include "lb/lbvector.h"
+#include "pl/player.h"
+
+#include <math.h>
+#include <trigf.h>
+
+static float sdata2_ordering(void)
+{
+    float data_0 = 0.0f;
+    double data_1 = 0.5;
+    double data_2 = 3.0;
+    float data_3 = 3.0f;
+    float data_4 = 5.0f;
+    float data_5 = 1.0f;
+    float data_6 = -1.0f;
+    double data_7 = 0.5;
+    return data_7 + data_6 + data_5 + data_4 + data_3 + data_2 + data_1 +
+           data_0;
+}
```

## PR #2460: various item work
Path: src/melee/it/items/itsamusgrapple.c
URL: https://github.com/doldecomp/melee/pull/2460#discussion_r3191396695
Author: PsiLupan

Can you give things meaningful names instead of leaving them as "new_var" etc.? I think that's my main complaint about most of this PR.

Even just "pos_copy" is better than "new_var," and it saves having to do this cleanup later.

Hunk:
```diff
@@ -1449,7 +1451,8 @@ void it_802BA5DC(ItemLink* tail, ItemLink* head, Vec3* pos,
     ItemLink* next;
     ItemLink* cur;
     bool retracted;
-    PAD_STACK(12);
+    Vec3* new_var;
```

## PR #2460: various item work
Path: src/melee/it/items/itsamusgrapple.c
URL: https://github.com/doldecomp/melee/pull/2460#discussion_r3191433462
Author: lukechampine

fair, a lot of this is permuterslop. I'll give it a cleanup pass.

Hunk:
```diff
@@ -1449,7 +1451,8 @@ void it_802BA5DC(ItemLink* tail, ItemLink* head, Vec3* pos,
     ItemLink* next;
     ItemLink* cur;
     bool retracted;
-    PAD_STACK(12);
+    Vec3* new_var;
```

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Path: src/melee/mn/mnsnap.c
URL: https://github.com/doldecomp/melee/pull/2433#discussion_r3143224540
Author: jellejurre

This should be reverted, you should use HSD_ASSERT with implicit stringe

Hunk:
```diff
@@ -181,13 +262,25 @@ static void mnSnap_8025329C(void)
         if (lbSnap_8001DE8C((void*) mnSnap_thumb_imgs[idx]) == 1) {
             jobj = snap->thumb_jobjs[snap->load_idx];
             img = (void*) mnSnap_thumb_imgs[idx];
-            HSD_ASSERT(193, jobj);
-            HSD_ASSERT(194, jobj->u.dobj);
-            HSD_ASSERT(195, jobj->u.dobj->next);
-            HSD_ASSERT(196, jobj->u.dobj->next->next);
-            HSD_ASSERT(197, jobj->u.dobj->next->next->mobj);
-            HSD_ASSERT(198, jobj->u.dobj->next->next->mobj->tobj);
-            HSD_ASSERT(199, jobj->u.dobj->next->next->mobj->tobj->imagedesc);
+            ((jobj) ? ((void) 0)
+                    : __assert(mnSnap_803F0168, 193, mnSnap_804D5070));
+            ((jobj->u.dobj) ? ((void) 0)
+                            : __assert(mnSnap_803F0168, 194, mnSnap_803F0174));
+            ((jobj->u.dobj->next)
+                 ? ((void) 0)
+                 : __assert(mnSnap_803F0168, 195, mnSnap_803F01D8));
+            ((jobj->u.dobj->next->next)
+                 ? ((void) 0)
+                 : __assert(mnSnap_803F0168, 196, mnSnap_803F01EC));
+            ((jobj->u.dobj->next->next->mobj)
+                 ? ((void) 0)
+                 : __assert(mnSnap_803F0168, 197, mnSnap_803F0208));
+            ((jobj->u.dobj->next->next->mobj->tobj)
+                 ? ((void) 0)
+                 : __assert(mnSnap_803F0168, 198, mnSnap_803F0228));
+            ((jobj->u.dobj->next->next->mobj->tobj->imagedesc)
+                 ? ((void) 0)
+                 : __assert(mnSnap_803F0168, 199, mnSnap_803F0250));
```

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Path: src/melee/mn/mnsnap.c
URL: https://github.com/doldecomp/melee/pull/2433#discussion_r3143224838
Author: jellejurre

Same here

Hunk:
```diff
@@ -284,13 +377,25 @@ void mnSnap_80253640(s32 page)
         HSD_DObjClearFlags(snap->thumb_jobjs[i]->u.dobj->next->next, 1);
         jobj = snap->thumb_jobjs[i];
         img = snap->blank_img;
-        HSD_ASSERT(193, jobj);
-        HSD_ASSERT(194, jobj->u.dobj);
-        HSD_ASSERT(195, jobj->u.dobj->next);
-        HSD_ASSERT(196, jobj->u.dobj->next->next);
-        HSD_ASSERT(197, jobj->u.dobj->next->next->mobj);
-        HSD_ASSERT(198, jobj->u.dobj->next->next->mobj->tobj);
-        HSD_ASSERT(199, jobj->u.dobj->next->next->mobj->tobj->imagedesc);
+        ((jobj) ? ((void) 0)
+                : __assert(mnSnap_803F0168, 193, mnSnap_804D5070));
+        ((jobj->u.dobj) ? ((void) 0)
+                        : __assert(mnSnap_803F0168, 194, mnSnap_803F0174));
+        ((jobj->u.dobj->next)
+             ? ((void) 0)
+             : __assert(mnSnap_803F0168, 195, mnSnap_803F01D8));
+        ((jobj->u.dobj->next->next)
+             ? ((void) 0)
+             : __assert(mnSnap_803F0168, 196, mnSnap_803F01EC));
+        ((jobj->u.dobj->next->next->mobj)
+             ? ((void) 0)
+             : __assert(mnSnap_803F0168, 197, mnSnap_803F0208));
+        ((jobj->u.dobj->next->next->mobj->tobj)
+             ? ((void) 0)
+             : __assert(mnSnap_803F0168, 198, mnSnap_803F0228));
+        ((jobj->u.dobj->next->next->mobj->tobj->imagedesc)
+             ? ((void) 0)
+             : __assert(mnSnap_803F0168, 199, mnSnap_803F0250));
```

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Path: src/melee/mn/mnsnap.c
URL: https://github.com/doldecomp/melee/pull/2433#discussion_r3143225870
Author: jellejurre

Same here, these likely weren't variables that were inlined, but just inline constants

Hunk:
```diff
@@ -342,30 +447,30 @@ void mnSnap_80253964(void)
     for (i = 0; i < 4; i++, base++) {
         HSD_SisLib_803A7664(snap->thumb_labels[i]);
         if (snap->state >= 4 && base < snap->photo_count[snap->active_slot]) {
-            HSD_SisLib_803A6B98(snap->thumb_labels[i], 0.0F, 0.0F, "%03d",
-                                base + 1);
+            HSD_SisLib_803A6B98(snap->thumb_labels[i], 0.0F, 0.0F,
```

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Path: src/melee/mn/mnsnap.c
URL: https://github.com/doldecomp/melee/pull/2433#discussion_r3143227916
Author: jellejurre

Why would this be needed?

Hunk:
```diff
@@ -23,6 +24,86 @@
 #include <melee/mn/inlines.h>
 #include <melee/mn/mnmain.h>
 
+SDATA char mnSnap_804D5070[] = "jobj";
+SDATA char mnSnap_804D5078[] = "jobj.h";
+SDATA char mnSnap_804D5080[] = "%03d";
+SDATA char mnSnap_804D5088[] = "%d\0\0\0\0\0";
+
+static char mnSnap_803F0168[] = "mnsnap.c";
+static char mnSnap_803F0174[] = "jobj->u.dobj";
+static char mnSnap_803F0184[] = "jobj->u.dobj->mobj";
+static char mnSnap_803F0198[] = "jobj->u.dobj->mobj->tobj";
+static char mnSnap_803F01B4[] = "jobj->u.dobj->mobj->tobj->imagedesc";
+static char mnSnap_803F01D8[] = "jobj->u.dobj->next";
+static char mnSnap_803F01EC[] = "jobj->u.dobj->next->next";
+static char mnSnap_803F0208[] = "jobj->u.dobj->next->next->mobj";
+static char mnSnap_803F0228[] = "jobj->u.dobj->next->next->mobj->tobj";
+static char mnSnap_803F0250[] =
+    "jobj->u.dobj->next->next->mobj->tobj->imagedesc";
+
+// Local inline using ftCo_800C6AFC pattern (like mnvibration.c)
+static inline void mnSnap_JObjSetTranslate(HSD_JObj* jobj, Vec3* translate)
```

## PR #2433: mnsnap: decompile fn_802545C4 (99.37%)
Path: src/melee/mn/mnsnap.c
URL: https://github.com/doldecomp/melee/pull/2433#discussion_r3143275555
Author: malvarezcastillo

reverted, unnecessary hack

Hunk:
```diff
@@ -23,6 +24,86 @@
 #include <melee/mn/inlines.h>
 #include <melee/mn/mnmain.h>
 
+SDATA char mnSnap_804D5070[] = "jobj";
+SDATA char mnSnap_804D5078[] = "jobj.h";
+SDATA char mnSnap_804D5080[] = "%03d";
+SDATA char mnSnap_804D5088[] = "%d\0\0\0\0\0";
+
+static char mnSnap_803F0168[] = "mnsnap.c";
+static char mnSnap_803F0174[] = "jobj->u.dobj";
+static char mnSnap_803F0184[] = "jobj->u.dobj->mobj";
+static char mnSnap_803F0198[] = "jobj->u.dobj->mobj->tobj";
+static char mnSnap_803F01B4[] = "jobj->u.dobj->mobj->tobj->imagedesc";
+static char mnSnap_803F01D8[] = "jobj->u.dobj->next";
+static char mnSnap_803F01EC[] = "jobj->u.dobj->next->next";
+static char mnSnap_803F0208[] = "jobj->u.dobj->next->next->mobj";
+static char mnSnap_803F0228[] = "jobj->u.dobj->next->next->mobj->tobj";
+static char mnSnap_803F0250[] =
+    "jobj->u.dobj->next->next->mobj->tobj->imagedesc";
+
+// Local inline using ftCo_800C6AFC pattern (like mnvibration.c)
+static inline void mnSnap_JObjSetTranslate(HSD_JObj* jobj, Vec3* translate)
```

## PR #2430: All item TUs > 80% fuzzy match
Path: src/melee/it/itCharItems.h
URL: https://github.com/doldecomp/melee/pull/2430#discussion_r3126418397
Author: jellejurre

Are these comments made up by a human or by AI?

Hunk:
```diff
@@ -897,22 +900,22 @@ typedef struct itTools_ItemVars {
     /* +0 ip+DD4 */ s32 x0;
 } itTools_ItemVars;
 
-typedef struct itToolsAttrEntry {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ f32 x10;
-    /* +14 */ f32 x14;
-    /* +18 */ f32 x18;
-} itToolsAttrEntry;
+typedef struct itToolsMotionAttrs {
+    /* +00 */ f32 x0;  // initial vel.y for the motion
+    /* +04 */ f32 x4;  // fall speed
+    /* +08 */ f32 x8;  // fall speed max
+    /* +0C */ f32 xC;  // rotation delta (per frame)
+    /* +10 */ f32 x10; // post-hit vel.y
+    /* +14 */ f32 x14; // vel threshold for damage
+    /* +18 */ f32 x18; // knockback scale
+} itToolsMotionAttrs;
 
 typedef struct itToolsAttributes {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ itToolsAttrEntry entries[1];
+    /* +00 */ f32 x0;                    // lifetime
+    /* +04 */ f32 x4;                    // knockback timer base
+    /* +08 */ f32 x8;                    // damage multiplier
+    /* +0C */ s32 xC;                    // damage cap
+    /* +10 */ itToolsMotionAttrs motions[1];
 } itToolsAttributes;
```

## PR #2430: All item TUs > 80% fuzzy match
Path: src/melee/it/itCharItems.h
URL: https://github.com/doldecomp/melee/pull/2430#discussion_r3126449237
Author: lukechampine

good catch, definitely AI guesswork that should not be taken as authoritative

Hunk:
```diff
@@ -897,22 +900,22 @@ typedef struct itTools_ItemVars {
     /* +0 ip+DD4 */ s32 x0;
 } itTools_ItemVars;
 
-typedef struct itToolsAttrEntry {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ f32 x10;
-    /* +14 */ f32 x14;
-    /* +18 */ f32 x18;
-} itToolsAttrEntry;
+typedef struct itToolsMotionAttrs {
+    /* +00 */ f32 x0;  // initial vel.y for the motion
+    /* +04 */ f32 x4;  // fall speed
+    /* +08 */ f32 x8;  // fall speed max
+    /* +0C */ f32 xC;  // rotation delta (per frame)
+    /* +10 */ f32 x10; // post-hit vel.y
+    /* +14 */ f32 x14; // vel threshold for damage
+    /* +18 */ f32 x18; // knockback scale
+} itToolsMotionAttrs;
 
 typedef struct itToolsAttributes {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ itToolsAttrEntry entries[1];
+    /* +00 */ f32 x0;                    // lifetime
+    /* +04 */ f32 x4;                    // knockback timer base
+    /* +08 */ f32 x8;                    // damage multiplier
+    /* +0C */ s32 xC;                    // damage cap
+    /* +10 */ itToolsMotionAttrs motions[1];
 } itToolsAttributes;
```

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

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itdosei.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071310664
Author: PsiLupan

This should be
`#include <baseline/gobj.h>`

Hunk:
```diff
@@ -3,6 +3,8 @@
 #include <placeholder.h>
 #include <platform.h>
 
+#include "baselib/gobj.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itdosei.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071313739
Author: PsiLupan

Is there a reason not to do it now?

Hunk:
```diff
@@ -11,37 +13,129 @@
 #include "lb/lb_00B0.h"
 
 #include <math.h>
+#include <baselib/jobj.h>
 #include <baselib/random.h>
 
+f32 it_804DC878 = 0.0f; // TODO: needs to be in .sdata2
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itkirby_2F23.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071328397
Author: PsiLupan

Same as prior comment regarding include for gobj.

Hunk:
```diff
@@ -3,20 +3,61 @@
 #include <placeholder.h>
 #include <platform.h>
 
+#include "baselib/gobj.h"
 #include "ft/chara/ftKirby/ftKb_Init.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itlipstickspore.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071341073
Author: PsiLupan

Assuming this is MSL/math.h

Should be `#include <MSL/math.h>`

Hunk:
```diff
@@ -1,38 +1,128 @@
 #include "itlipstickspore.h"
 
+#include "math.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itpikachutjoltair.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071351505
Author: PsiLupan

Explicit `#include <MSL/math.h>`

Hunk:
```diff
@@ -11,6 +11,10 @@
 #include "it/items/itpikachutjoltground.h"
 #include "lb/lb_00B0.h"
 
+#include <math.h>
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itseakneedlethrown.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071354118
Author: PsiLupan

Same as prior comment.

Hunk:
```diff
@@ -1,30 +1,73 @@
 #include "itseakneedlethrown.h"
 
+#include "placeholder.h"
+
+#include "db/db.h"
+#include "ft/ftlib.h"
+
 #include "it/forward.h"
 
 #include "it/inlines.h"
+#include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
+#include "it/item.h"
+#include "lb/lbvector.h"
+#include "mp/mpcoll.h"
+#include "mp/mplib.h"
 
+#include <math.h>
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itunknown.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071356791
Author: PsiLupan

Fix the include style as seen in previous comment.

Hunk:
```diff
@@ -1,23 +1,31 @@
 #include "itunknown.h"
 
+#include "math.h"
```

## PR #2404: gr: 5 match progress (100%)
Path: src/melee/gr/groldkongo.c
URL: https://github.com/doldecomp/melee/pull/2404#discussion_r3068083179
Author: jurrejelle

This looks bad. Is this used? if not, probably remove

Hunk:
```diff
@@ -202,7 +211,79 @@ void grOldKongo_802105C8(HSD_GObj* gobj)
     }
 }
 
-/// #grOldKongo_80210650
+extern f32 grOk_804DB9CC;
+extern f32 grOk_804DBA04;
+extern f32 grOk_804DBA08;
+extern f32 grOk_804DBA0C;
+extern f32 grOk_804DBA10;
+extern f32 grOk_804DBA14;
+extern f32 grOk_804DBA18;
+extern f32 grOk_804DBA1C;
+
+extern char grOk_803E6640[];
+#undef __FILE__
+#define __FILE__ grOk_803E6640
```

## PR #2404: gr: 5 match progress (100%)
Path: src/melee/gr/groldkongo.c
URL: https://github.com/doldecomp/melee/pull/2404#discussion_r3068085204
Author: jurrejelle

it is possible this is a for loop of some sort, but also since it's matching it's fine if you can't / don't want to get that to work

Hunk:
```diff
@@ -202,7 +211,79 @@ void grOldKongo_802105C8(HSD_GObj* gobj)
     }
 }
 
-/// #grOldKongo_80210650
+extern f32 grOk_804DB9CC;
+extern f32 grOk_804DBA04;
+extern f32 grOk_804DBA08;
+extern f32 grOk_804DBA0C;
+extern f32 grOk_804DBA10;
+extern f32 grOk_804DBA14;
+extern f32 grOk_804DBA18;
+extern f32 grOk_804DBA1C;
+
+extern char grOk_803E6640[];
+#undef __FILE__
+#define __FILE__ grOk_803E6640
+
+f32 grOldKongo_80210650(void)
+{
+    f32 result;
+    s32 total;
+    s32 r;
+
+    total = grOk_804D6A90->x2C + grOk_804D6A90->x2E + grOk_804D6A90->x30 +
+            grOk_804D6A90->x32 + grOk_804D6A90->x34 + grOk_804D6A90->x36 +
+            grOk_804D6A90->x38 + grOk_804D6A90->x3A;
+
+    if (total != 0) {
+        r = HSD_Randi(total);
+    } else {
+        r = 0;
+    }
+
+    r -= grOk_804D6A90->x2C;
+    if (r < 0) {
+        result = grOk_804DBA04;
+    } else {
+        r -= grOk_804D6A90->x2E;
+        if (r < 0) {
+            result = grOk_804DBA08;
+        } else {
+            r -= grOk_804D6A90->x30;
+            if (r < 0) {
+                result = grOk_804DBA0C;
+            } else {
+                r -= grOk_804D6A90->x32;
+                if (r < 0) {
+                    result = grOk_804DB9CC;
+                } else {
+                    r -= grOk_804D6A90->x34;
+                    if (r < 0) {
+                        result = grOk_804DBA10;
+                    } else {
+                        r -= grOk_804D6A90->x36;
+                        if (r < 0) {
+                            result = grOk_804DBA14;
+                        } else {
+                            r -= grOk_804D6A90->x38;
+                            if (r < 0) {
+                                result = grOk_804DBA18;
+                            } else {
+                                r -= grOk_804D6A90->x3A;
+                                if (r < 0) {
+                                    result = grOk_804DBA1C;
+                                } else {
+                                    HSD_ASSERT(786, 0);
+                                }
+                            }
+                        }
+                    }
+                }
+            }
+        }
+    }
+
+    return result;
+}
```

## PR #2404: gr: 5 match progress (100%)
Path: src/melee/gr/grpushon.c
URL: https://github.com/doldecomp/melee/pull/2404#discussion_r3068086850
Author: jurrejelle

This function exists inside the lobj.c, why create this def? if it's for inline reasons, maybe clarify that in the same since rn it uses the same name while not doing exactly the same (fn vs def)

Hunk:
```diff
@@ -324,7 +363,44 @@ void fn_802190A0(Ground* gp, s32 joint_id, CollData* coll, s32 unk,
     }
 }
 
-/// #grPushOn_802190D0
+void grPushOn_802190D0(HSD_GObj* gobj)
+{
+    HSD_LObj* cur = gobj->hsd_obj;
+    f32 scale = Ground_801C0498();
+    struct grPushOn_LightConfig* entry;
+    GXColor color;
+    Vec3 pos;
+    s32 i;
+    HSD_LObj* lobj;
+
+    lobj = cur == NULL ? NULL : cur->next;
+    entry = light_configs;
+
+#define HSD_LObjGetType(lobj) ((u32) ((lobj)->flags & LOBJ_TYPE_MASK))
```

## PR #2404: gr: 5 match progress (100%)
Path: src/melee/gr/groldkongo.c
URL: https://github.com/doldecomp/melee/pull/2404#discussion_r3068088158
Author: jurrejelle

could you rename these to x1C_pad... if they're unused?
not 100% needed but good practice

Hunk:
```diff
@@ -23,7 +23,16 @@ static struct {
     u8 x4[0x10];
     f32 x14;
     f32 x18;
-    u8 x1C[0x2C];
+    u8 x1C[0x10];
```

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

## PR #2380: Link mngallery
Path: src/melee/mn/mngallery.c
URL: https://github.com/doldecomp/melee/pull/2380#discussion_r3031627398
Author: jurrejelle

what's this?

Hunk:
```diff
@@ -334,36 +291,31 @@ void fn_80258ED0(HSD_GObj* gobj)
                 HSD_SisLib_803A6368(data->text, 0xC8);
             }
         } else if (buttons & (MenuInput_StartButton | MenuInput_AButton)) {
-            data->unk14 = 3;
+            data->state = 3;
             mn_8022BD6C();
             mnGallery_80258BC4(data);
         }
     }
 }
 
-#pragma push
-#pragma optimization_level 2
-#pragma opt_strength_reduction on
-#pragma opt_propagation off
-void fn_802590C4(HSD_GObj* gobj)
+inline void fn_802590C4_inline(HSD_GObj* gobj)
 {
-    extern f64 mnGallery_804DC368;
-
-    struct fn_802590C4_data {
-        u8 pad[0x14];
-        u8 state;
-        u8 pad2[3];
-        s32 frame;
-        HSD_GObj* gobjs[2];
-    };
-    struct fn_802590C4_data* store;
     s32 i;
-    struct fn_802590C4_data* data;
-    s32 zero;
-    char* read_base;
+    struct mnGallery_804D6C88_userdata* tmp;
+    tmp = HSD_GObjGetUserData(gobj); /// @todo GET_804D6C88 breaks these
```

## PR #2380: Link mngallery
Path: src/melee/mn/mngallery.c
URL: https://github.com/doldecomp/melee/pull/2380#discussion_r3031631641
Author: jellejurre

the fact that we have to use HSD_GObjGetUserData directly instead of the helper method we defined

Hunk:
```diff
@@ -334,36 +291,31 @@ void fn_80258ED0(HSD_GObj* gobj)
                 HSD_SisLib_803A6368(data->text, 0xC8);
             }
         } else if (buttons & (MenuInput_StartButton | MenuInput_AButton)) {
-            data->unk14 = 3;
+            data->state = 3;
             mn_8022BD6C();
             mnGallery_80258BC4(data);
         }
     }
 }
 
-#pragma push
-#pragma optimization_level 2
-#pragma opt_strength_reduction on
-#pragma opt_propagation off
-void fn_802590C4(HSD_GObj* gobj)
+inline void fn_802590C4_inline(HSD_GObj* gobj)
 {
-    extern f64 mnGallery_804DC368;
-
-    struct fn_802590C4_data {
-        u8 pad[0x14];
-        u8 state;
-        u8 pad2[3];
-        s32 frame;
-        HSD_GObj* gobjs[2];
-    };
-    struct fn_802590C4_data* store;
     s32 i;
-    struct fn_802590C4_data* data;
-    s32 zero;
-    char* read_base;
+    struct mnGallery_804D6C88_userdata* tmp;
+    tmp = HSD_GObjGetUserData(gobj); /// @todo GET_804D6C88 breaks these
```

## PR #2380: Link mngallery
Path: src/melee/mn/mngallery.c
URL: https://github.com/doldecomp/melee/pull/2380#discussion_r3031685408
Author: BR-

HSD_GObjGetUserData is the inline that drives GET_FIGHTER, etc. It just returns userdata through a void*, the same as the inline Jelle wrote.
GET_804D6C88 is a macro I made to mimic GET_FIGHTER, just for this file. Calls the inline then casts to mnGallery_804D6C88_userdata*.

Hunk:
```diff
@@ -334,36 +291,31 @@ void fn_80258ED0(HSD_GObj* gobj)
                 HSD_SisLib_803A6368(data->text, 0xC8);
             }
         } else if (buttons & (MenuInput_StartButton | MenuInput_AButton)) {
-            data->unk14 = 3;
+            data->state = 3;
             mn_8022BD6C();
             mnGallery_80258BC4(data);
         }
     }
 }
 
-#pragma push
-#pragma optimization_level 2
-#pragma opt_strength_reduction on
-#pragma opt_propagation off
-void fn_802590C4(HSD_GObj* gobj)
+inline void fn_802590C4_inline(HSD_GObj* gobj)
 {
-    extern f64 mnGallery_804DC368;
-
-    struct fn_802590C4_data {
-        u8 pad[0x14];
-        u8 state;
-        u8 pad2[3];
-        s32 frame;
-        HSD_GObj* gobjs[2];
-    };
-    struct fn_802590C4_data* store;
     s32 i;
-    struct fn_802590C4_data* data;
-    s32 zero;
-    char* read_base;
+    struct mnGallery_804D6C88_userdata* tmp;
+    tmp = HSD_GObjGetUserData(gobj); /// @todo GET_804D6C88 breaks these
```

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

## PR #2358: Link grfzerocar
Path: src/melee/gr/grfzerocar.c
URL: https://github.com/doldecomp/melee/pull/2358#discussion_r3002083852
Author: ribbanya

@PsiLupan @r-burns Do you know how to fix this string ordering? I tried a bunch of things with inlines and pragmas and can't get it to behave.

Hunk:
```diff
@@ -52,19 +45,31 @@ grFZeroCarEntry grFZeroCar_803E0BD8[30] = {
     { 0, 28, { 1, -1, -1, -1 } }, { 0, 29, { 1, 3, 2, 4 } },
 };
 
+static char grFZeroCar_804D4598[8] = "archive";
+
+// For sdata2 ordering
+static void fakeFunc(Vec3);
+static void fakeFunc(Vec3 temp)
+{
+    f64 f = 1.0;
+    temp.x = 0.0f;
+    temp.y = f;
+}
+
 static inline void setup_car_child(HSD_JObj* parent, s16 ext_count, s32 offset,
                                    f32 scale_factor)
 {
     UnkArchiveStruct* archive;
     HSD_JObj* jobj;
 
     archive = grDatFiles_801C6330(ext_count);
-    HSD_ASSERT(95, archive);
+    HSD_ASSERTMSG(95, archive, grFZeroCar_804D4598);
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2982940692
Author: ThePlayerRolo

100% sure this is a fake match.
If you don't know how to solve it you should include a decomp.me scratch comment or just a comment saying its a fake match

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2983173424
Author: lukechampine

what makes a match "fake"? Isn't it kinda subjective? For me, "fake" means stuff like `M2C_FIELD`, or comma assignments, that sort of thing. Even `PAD_STACK` is "fake" by the strictest definition, but clearly we allow that (for now, at least).

This also works, for example, and it feels "less fake", but I doubt it's what the original source looked like:
```c
Fighter* fp2;
fp->cmd_vars[2] = 0;
if ((gobj != NULL) && (fp2 = GET_FIGHTER(gobj)) != NULL) {
    pos1.x = 0.0f;
    pos1.y = 1.45f;
    pos1.z = 5.016f;
    lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
} else {
    sp2C.x = sp2C.y = sp2C.z = 0.0f;
}
sp2C.z = 0;
```
`fp2` suggests a function was inlined here, but I tried factoring it out and couldn't restore the match. ‾\\\_(ツ)\_/‾

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2983620969
Author: ThePlayerRolo

> what makes a match "fake"? Isn't it kinda subjective? For me, "fake" means stuff like `M2C_FIELD`, or comma assignments, that sort of thing. Even `PAD_STACK` is "fake" by the strictest definition, but clearly we allow that (for now, at least).
> 
> This also works, for example, and it feels "less fake", but I doubt it's what the original source looked like:
> 
> ```c
> Fighter* fp2;
> fp->cmd_vars[2] = 0;
> if ((gobj != NULL) && (fp2 = GET_FIGHTER(gobj)) != NULL) {
>     pos1.x = 0.0f;
>     pos1.y = 1.45f;
>     pos1.z = 5.016f;
>     lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
> } else {
>     sp2C.x = sp2C.y = sp2C.z = 0.0f;
> }
> sp2C.z = 0;
> ```
> 
> `fp2` suggests a function was inlined here, but I tried factoring it out and couldn't restore the match. ‾\_(ツ)_/‾

well the reason I consider it fake is because theres a very big chance they didn't use a goto there.
About PAD_STACK: THe reason I don't think we should mention that yet is because PAD_STACK is mentioned so much throughout the repo its something thats most likely going to be cleaned up (at least to the best ability) near the end of decomp.

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2984009273
Author: jurrejelle

IMO, adding a comment about this being a "fake match" doesn't really add anything. Anyone can see that they probably didn't use goto, so that this could be cleaned up further. However, for now it's a match which is already better than what we had. 

I personally would have committed what you suggested as the "less fake" option and called it a day, that's cleaner than a lot of the code I've committed as matching 🤷

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2984048662
Author: ThePlayerRolo

> IMO, adding a comment about this being a "fake match" doesn't really add anything. Anyone can see that they probably didn't use goto, so that this could be cleaned up further. However, for now it's a match which is already better than what we had.
> 
> I personally would have committed what you suggested as the "less fake" option and called it a day, that's cleaner than a lot of the code I've committed as matching 🤷

I mean yeah true

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2984086278
Author: lukechampine

aight, I pushed the goto-less version

Hunk:
```diff
@@ -205,25 +207,74 @@ inline void ftKb_SpecialNFx_SetCall(HSD_GObj* gobj)
     fp->take_dmg_cb = ftKb_Init_800EE7B8;
 }
 
-/// #ftKb_SpecialNFx_800FDF30
+extern u32 ftKb_Init_804D3DB8[2];
+extern u32 ftKb_Init_804D3DC0[2];
+extern char ftKb_Init_804D3DC8[2];
+extern char ftKb_Init_803CB6D8[];
+extern char ftKb_Init_803CB6F8[];
 
-void ftKb_SpecialNFx_CreateBlasterShot(Fighter_GObj* gobj)
+void ftKb_SpecialNFx_800FDF30(Fighter_GObj* gobj)
 {
-    ftKb_SpecialNFx_800FDF30(gobj);
+    Vec3 sp2C;
+    Vec3 pos1;
+    ftKb_DatAttrs* da;
+    Fighter* fp;
+    f64 launchAngle;
+
+    PAD_STACK(4);
+
+    fp = fp = GET_FIGHTER(gobj);
+    da = fp->dat_attrs;
+
+    if (fp->cmd_vars[2] != 0) {
+        fp->cmd_vars[2] = 0;
+        if (gobj != NULL) {
+            Fighter* fp2 = GET_FIGHTER(gobj);
+            if (fp2 != NULL) {
+                pos1.x = 0.0f;
+                pos1.y = 1.45f;
+                pos1.z = 5.016f;
+                lb_8000B1CC(fp2->parts[FtPart_R3rdNa].joint, &pos1, &sp2C);
+                goto after;
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2984311199
Author: PsiLupan

Would prefer we don't undo proper OSReport/HSD_ASSERT usage.

Hunk:
```diff
@@ -265,17 +310,27 @@ void ftKb_SpecialNFx_800FE100(HSD_GObj* gobj)
     fp->self_vel.x = 0.0f;
 
     fp->mv.fx.SpecialN.isBlasterLoop = false;
+
+    switch (fp->fv.kb.hat.kind) {
+    case FTKIND_FOX:
+        blaster_id = da->specialn_fx_blaster_item_id;
+        break;
+    case FTKIND_FALCO:
+        blaster_id = da->specialn_fc_blaster_item_id;
+        break;
+    }
+
     blasterGObj = it_802AE8A8(fp->facing_dir, gobj, &fp->cur_pos,
-                              FtPart_R3rdNa, ftKbGetBlasterId(fp, da));
+                              FtPart_R3rdNa, blaster_id);
     fp->fv.kb.xB0 = blasterGObj;
 
     if (blasterGObj != NULL) {
         ftKb_SpecialNFx_SetCall(gobj);
         return;
     }
 
-    OSReport("ftToSpecialNFox::Caution!!!\n");
-    HSD_ASSERT(429, 0);
+    OSReport(ftKb_Init_803CB6D8);
+    __assert(ftKb_Init_803CB6F8, 429, ftKb_Init_804D3DC8);
```

## PR #2349: ftkirbyspecialfox.c matches
Path: src/melee/ft/chara/ftKirby/ftkirbyspecialfox.c
URL: https://github.com/doldecomp/melee/pull/2349#discussion_r2984313189
Author: PsiLupan

Same as previous comment regarding proper OSReport/HSD_ASSERT usage.

Hunk:
```diff
@@ -310,17 +366,27 @@ void ftKb_SpecialNFx_800FE240(HSD_GObj* gobj)
     ftAnim_8006EBA4(gobj);
 
     fp->mv.fx.SpecialN.isBlasterLoop = false;
+
+    switch (fp->fv.kb.hat.kind) {
+    case FTKIND_FOX:
+        blaster_id = da->specialn_fx_blaster_item_id;
+        break;
+    case FTKIND_FALCO:
+        blaster_id = da->specialn_fc_blaster_item_id;
+        break;
+    }
+
     blasterGObj = it_802AE8A8(fp->facing_dir, gobj, &fp->cur_pos,
-                              FtPart_R3rdNa, ftKbGetBlasterId(fp, da));
+                              FtPart_R3rdNa, blaster_id);
     fp->fv.kb.xB0 = blasterGObj;
 
     if (blasterGObj != NULL) {
         ftKb_SpecialNFx_SetCall(gobj);
         return;
     }
 
-    OSReport("ftToSpecialNFox::Caution!!!\n");
-    HSD_ASSERT(465, 0);
+    OSReport(ftKb_Init_803CB6D8);
+    __assert(ftKb_Init_803CB6F8, 465, ftKb_Init_804D3DC8);
```

## PR #2344: Decompile 9 fighter, library, game, and menu functions
Path: src/melee/mn/mnname.c
URL: https://github.com/doldecomp/melee/pull/2344#discussion_r2970215570
Author: PsiLupan

This lacks a `#pragma push` before it followed by `#pragma pop` at the end of the function, so it's incorrectly affecting all functions in the file.

Hunk:
```diff
@@ -245,7 +245,37 @@ f32 mnName_80238964(u8 index, u8 target, u8 flag)
     }
 }
 
-/// #mnName_80238A04
+#pragma dont_inline on
```

## PR #2344: Decompile 9 fighter, library, game, and menu functions
Path: src/melee/mn/mnname.c
URL: https://github.com/doldecomp/melee/pull/2344#discussion_r2971624959
Author: johnwinston

Fixed — added `#pragma push` / `#pragma pop` wrapping.

Hunk:
```diff
@@ -245,7 +245,37 @@ f32 mnName_80238964(u8 index, u8 target, u8 flag)
     }
 }
 
-/// #mnName_80238A04
+#pragma dont_inline on
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954419745
Author: PsiLupan

Mind fixing this to use `HSD_ASSERT`?

I'm guessing the string there is just condition `0`

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954424048
Author: PsiLupan

Same as prior comment regarding `HSD_ASSERT`

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
+    }
 
-/// #un_80318CB4
+    gobj = ptr->gobj0;
+    if ((ptr->gobj4 && ptr->gobj4) && gobj4) {
+    }
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj0 = NULL;
+    }
 
-/// #un_80319540
+    gobj = ptr->gobj4;
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj4 = NULL;
+    }
 
-/// #un_80319994
+    joint = HSD_ArchiveGetPublicAddress(ptr->archive, "ToyDspBg_Top_joint");
+    if (joint != NULL) {
+        ptr->gobj4 = GObj_Create(9, 9, zero);
+        jobj = HSD_JObjLoadJoint(joint);
+        HSD_GObjObject_80390A70(ptr->gobj4, temp = HSD_GObj_804D7849, jobj);
+        GObj_SetupGXLink(ptr->gobj4, HSD_GObj_JObjCallback, 0x3C, zero);
+        lb_8001204C(jobj, &ptr->jobj, &un_804D5ABC, 1);
+        return;
+    }
+
+    OSReport("*** Can not Load Panel Label(%s)\n", "ToyDspBg_Top_joint");
+    __assert("tydisplay.c", 0x43E, un_804D5AA8);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954432775
Author: PsiLupan

Since this is an OSPanic:

Replace the filename with `__FILE__` and declare the actual string, please. It makes matching and linking the file later easier.

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
+    }
 
-/// #un_80318CB4
+    gobj = ptr->gobj0;
+    if ((ptr->gobj4 && ptr->gobj4) && gobj4) {
+    }
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj0 = NULL;
+    }
 
-/// #un_80319540
+    gobj = ptr->gobj4;
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj4 = NULL;
+    }
 
-/// #un_80319994
+    joint = HSD_ArchiveGetPublicAddress(ptr->archive, "ToyDspBg_Top_joint");
+    if (joint != NULL) {
+        ptr->gobj4 = GObj_Create(9, 9, zero);
+        jobj = HSD_JObjLoadJoint(joint);
+        HSD_GObjObject_80390A70(ptr->gobj4, temp = HSD_GObj_804D7849, jobj);
+        GObj_SetupGXLink(ptr->gobj4, HSD_GObj_JObjCallback, 0x3C, zero);
+        lb_8001204C(jobj, &ptr->jobj, &un_804D5ABC, 1);
+        return;
+    }
+
+    OSReport("*** Can not Load Panel Label(%s)\n", "ToyDspBg_Top_joint");
+    __assert("tydisplay.c", 0x43E, un_804D5AA8);
+}
+
+static s32 un_804DE018 = (s32) 0xC8C8C8FF;
+static f32 un_804DE01C = 0.6f;
 
-/// #un_80319EF0
+void un_8031B328(void)
+{
+    HSD_FogDesc* fogDesc;
+    TyDspBgData* ptr = un_804D6F1C;
+    TyDspSceneGfx* scene = (TyDspSceneGfx*) un_804D6ED4;
+    void* lightData;
+    TyDspBgData* temp3;
+    s8 temp2;
+    HSD_LObj* lobj;
+    HSD_GObj* temp;
+
+    PAD_STACK(24);
 
-/// #fn_8031A4EC
+    if ((temp3 = ptr)->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        OSPanic("tydisplay.c", 0x459, un_804D5AC0);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954440838
Author: PsiLupan

This should just be used in the actual function call. Shouldn't need to declare it as a static above.

Hunk:
```diff
@@ -203,11 +1918,132 @@ s32 un_8031BBF4(s8 arg0)
     return (s32) table[arg0];
 }
 
-/// #un_8031BC54
+static char un_803FF01C[] = "ToyDspStand_Top_joint";
```

## PR #2281: it: decompile 24 item functions
Path: src/melee/it/itCommonItems.h
URL: https://github.com/doldecomp/melee/pull/2281#discussion_r2934007399
Author: ribbanya

This is wrong; create a new `ItemVars` union for each type of Pokémon.

Hunk:
```diff
@@ -646,14 +654,24 @@ typedef struct itKamexAttributes {
 typedef struct {
     s16 x0;
     u8 padding[0xE34 - 0xDD8];
-    s32 timer;
-    int x64;
-    f32 x68;
-    f32 x6C;
+    union {
+        s32 timer;
+        f32 timer_f;
+    };
+    union {
+        int x64;
+        f32 x64_f;
+    };
+    union {
+        int x68;
+        f32 x68_f;
+    };
```

## PR #2257: tydisplay: match 3 functions
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2257#discussion_r2912545147
Author: PsiLupan

`continue;`

Hunk:
```diff
@@ -118,7 +196,56 @@ s32 tyDisplay_8031C2EC(void)
     return un_80305058(2, 0, 1, 60.0f);
 }
 
-/// #un_8031C354
+s32 un_8031C354(s32 id, s32 (*buf)[], s32 max, s32 kind)
+{
+    void* data;
+    void* other;
+    s32 i;
+    s32 count;
+    s32 val;
+
+    PAD_STACK(8);
+
+    if (id == -1) {
+        return 0;
+    }
+
+    data = un_8031B9DC(id);
+
+    if (kind == 99) {
+        kind = (s32) un_803060BC(id, 6);
+    }
+
+    count = 0;
+    for (i = 0; i < 0x125; i++) {
+        if (i == id) {
+            goto next;
```

## PR #2256: mnname: match 2 functions
Path: src/melee/mn/mnname.c
URL: https://github.com/doldecomp/melee/pull/2256#discussion_r2912533564
Author: PsiLupan

This should use the actual `jobj` struct, not pointer math.

Hunk:
```diff
@@ -141,7 +157,25 @@ void mnName_80239F5C(HSD_JObj* jobj, f32 x)
     HSD_JObjSetTranslateX(jobj, x);
 }
 
-/// #mnName_80239FFC
+void mnName_80239FFC(HSD_GObj* gobj)
+{
+    u8* p = (u8*) gobj;
+    HSD_JObj* jobj;
+    HSD_JObj* child;
+
+    jobj = *(HSD_JObj**) (p + 0x30);
```

## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2909326516
Author: mchen91

I was getting this error during the build: `ERROR Size mismatch for @260 (type Object) at 0x804D5790: Expected 0x4, found 0x1`
I'm not certain this is the proper fix, so please let me know if there is a better way to deal with it

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```

## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2912615941
Author: PsiLupan

In this case, it's the `symbols.txt` file has the symbols, their address, their associated size, and type. The auto-size was just 4 and if it's corrected, it should be resolved.

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```

## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2912767319
Author: mchen91

Thank you, I've updated the size in the symbols file

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```

## PR #2241: Match ef_061D 100% and rename to efspecial (special effects)
Path: src/melee/ef/efspecial.c
URL: https://github.com/doldecomp/melee/pull/2241#discussion_r2902421323
Author: PsiLupan

This is indicative of an inline from `jobj.h` - it shouldn't be necessary to redefine this.

Hunk:
```diff
@@ -0,0 +1,509 @@
+#include "efspecial.h"
+
+#include "eflib.h"
+#include "math.h"
+#include "types.h"
+
+#include "baselib/class.h"
+#include "baselib/debug.h"
+
+#include "baselib/forward.h"
+
+#include "baselib/gobj.h"
+#include "baselib/list.h"
+#include "baselib/object.h"
+#include "baselib/pobj.h"
+
+#include <dolphin/mtx.h>
+
+extern char ef_803BF9D0[];
+extern char ef_804D39D8[];
+extern char ef_804D39E0[];
+
+#define efSpecial_HSD_ASSERT_MSG(line)                                        \
+    (((line) == 619)                                     ? "rotate"           \
+     : ((line) == 640 || (line) == 661 || (line) == 682) ? ef_803BF9D0        \
+     : ((line) == 761 || (line) == 824)                  ? "scale"            \
+     : ((line) == 917 || (line) == 980)                  ? "translate"        \
+     : ((line) == 1171)                                  ? "mtx"              \
+                                                         : ef_804D39E0)
+
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0)                                                      \
+            : __assert(ef_804D39D8, line, efSpecial_HSD_ASSERT_MSG(line)))
+
+#include "baselib/jobj.h"
+
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0) : __assert(__FILE__, line, #cond))
+
+#include "baselib/particle.h"
+#include "ft/inlines.h"
+
+/* 458EE0 */ extern HSD_JObj* efLib_80458EE0[16];
+/* 4D64E8 */ extern s32 efLib_804D64E8;
+/* 4D64F0 */ extern s32 efLib_804D64F0;
+/* 3BF9D0 */ char ef_803BF9D0[] = "!(jobj->flags & JOBJ_USE_QUATERNION)";
+/* 4D39D8 */ SDATA char ef_804D39D8[] = "jobj.h";
+/* 4D39E0 */ SDATA char ef_804D39E0[] = "jobj";
+/* 4D81D0 */ extern const f32 ef_804D81D0;
+/* 4D81D8 */ extern const f64 ef_804D81D8;
+/* 4D81E0 */ extern const f64 ef_804D81E0;
+/* 4D81E8 */ extern const f32 ef_804D81E8;
+/* 4D81EC */ extern const f32 ef_804D81EC;
+/* 4D81F0 */ extern const f32 ef_804D81F0;
+
+void* efSync_SpawnSpecial(s32 gfx_id, HSD_GObj* arg_gobj, void* vlist)
+{
+    void* ret_obj;
+    u8 sp_pad128[0x8];
+    Vec3 sp130;
+    u8 sp_pad130[0x4];
+    Effect* eff_2;
+    Effect* eff_1;
+    Fighter* fighter_1;
+    FighterBone* fighter_bone_1;
+    f64 f64_1;
+    f32 f32_1;
+    HSD_JObj* jobj_1;
+    HSD_JObj* jobj_2;
+    s32 cnt;
+    PAD_STACK(0x98);
+
+    efLib_804D64E8 = 1;
+    ret_obj = NULL;
+
+    switch (gfx_id) {
+    case 0x479:
+        ret_obj = efLib_8005C9FC(0x3F2, va_arg(vlist, Vec3*));
+        break;
+    case 0x47A:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x3E8, arg_gobj, jobj_1);
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        hsd_8039EFAC(0, 1, 0x3E9, jobj_1);
+        break;
+    case 0x47B:
+        ret_obj = efLib_8005C9FC(0x3EB, va_arg(vlist, Vec3*));
+        break;
+    case 0x47C:
+        ret_obj = efLib_8005C3DC(0x3E9, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005F08C;
+        }
+        break;
+    case 0x47D:
+        ret_obj = hsd_8039EFAC(0, 1, 0x3F0, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x47E:
+        ret_obj = hsd_8039EFAC(0, 1, 0x3F1, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x47F:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D4, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x480:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D2, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x481:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D3, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x482:
+        ret_obj = efLib_8005C1B4(0x7D0, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005EBC8;
+        }
+        break;
+    case 0x483:
+        ret_obj = efLib_8005C9FC(0x7D7, va_arg(vlist, Vec3*));
+        break;
+    case 0x484:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7DB, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x485:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7DE, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x486:
+        ret_obj = efLib_8005C814(0x7D1, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x487:
+        ret_obj = efLib_8005C5C4(0x7D2, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x488:
+        ret_obj = efLib_8005C3DC(0xBB8, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x489:
+        ret_obj = efLib_8005C3DC(0xBB9, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48A:
+        ret_obj = efLib_8005C3DC(0xBBA, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48B:
+        ret_obj = efLib_8005C1B4(0xBBB, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48C:
+        ret_obj = efLib_8005C1B4(0xBBC, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005E3A0;
+        }
+        break;
+    case 0x48D:
+        ret_obj = efLib_8005CF40(0xBC0, vlist);
+        break;
+    case 0x48E:
+        ret_obj = efLib_8005C814(0xBBD, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, ef_804D81E8);
+            HSD_JObjSetRotationZ(eff_1->gobj->hsd_obj, *va_arg(vlist, f32*));
+        }
+        break;
+    case 0x48F:
+        ret_obj = efLib_8005C6F4(0xFA0, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0xFA1, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x490:
+        ret_obj = efLib_8005C1B4(0xFA2, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->translate.z = *va_arg(vlist, f32*);
+            eff_1->x10 = efLib_8005EDDC;
+        }
+        break;
+    case 0x491:
+        ret_obj = efLib_8005C1B4(0xFA4, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x492:
+        ret_obj = efLib_8005C3DC(0xFA3, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x493:
+        ret_obj = efLib_8005C3DC(0xFA5, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x494:
+        fighter_1 = GET_FIGHTER(arg_gobj);
+        fighter_bone_1 = fighter_1->parts;
+        jobj_1 = fighter_bone_1[44].joint;
+        jobj_2 = fighter_bone_1[1].joint;
+        ret_obj = efLib_8005C2BC(0x1388, arg_gobj, jobj_1);
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x10 = efLib_8005E090;
+            ((Effect*) ret_obj)->x24 = 0x41;
+            ((Effect*) ret_obj)->x14 = NULL;
+            eff_1 = efLib_8005C1B4(0x1389, arg_gobj, jobj_1);
+            ((Effect*) ret_obj)->x0 = (void*) eff_1;
+            if (eff_1 != NULL) {
+                eff_1 = (Effect*) ((Effect*) ret_obj)->x0;
+                eff_1->x10 = efLib_8005E090;
+                eff_1->x24 = 0x41;
+                eff_1->x14 = fighter_1;
+                eff_2 = efLib_8005C1B4(0x138A, arg_gobj, jobj_2);
+                eff_1->x0 = (void*) eff_2;
+                if (eff_2 != NULL) {
+                    eff_2 = (Effect*) eff_1->x0;
+                    eff_2->x10 = efLib_8005E090;
+                    eff_2->x24 = 0x41;
+                    eff_2->x14 = fighter_1;
+                }
+            }
+        }
+        break;
+    case 0x495:
+        ret_obj = efLib_8005C3DC(0x138B, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x496:
+        ret_obj = efLib_8005C1B4(0x138C, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x497:
+        ret_obj = efLib_8005C1B4(0x138D, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005E2B4;
+        }
+        break;
+    case 0x498:
+        ret_obj = efLib_8005C2BC(0x138E, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x499:
+        ret_obj = efLib_8005C2BC(0x138F, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49A:
+        ret_obj = efLib_8005CF40(0x138B, vlist);
+        break;
+    case 0x49B:
+        ret_obj = hsd_8039EFAC(0, 5, 0x138F, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49C:
+        ret_obj = hsd_8039EFAC(0, 5, 0x1395, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49D:
+        ret_obj = efLib_8005C814(0x1390, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            jobj_2 = arg_gobj->hsd_obj;
+            jobj_1 = GET_JOBJ(eff_1->gobj);
+            HSD_JObjSetScaleX(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetScaleY(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetScaleZ(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetTranslateZ(HSD_JObjGetChild(jobj_1),
+                                  HSD_JObjGetTranslationZ(jobj_1) -
+                                      ef_804D81EC);
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                HSD_JObjSetRotationY(jobj_1, ef_804D81F0);
+                HSD_JObjSetRotationZ(jobj_1, -*va_arg(vlist, f32*));
+            } else {
+                HSD_JObjSetRotationY(jobj_1, ef_804D81E8);
+                HSD_JObjSetRotationZ(jobj_1, *va_arg(vlist, f32*));
+            }
+            eff_1->x10 = efLib_8005E1D8;
+        }
+        break;
+    case 0x49E:
+        ret_obj = efLib_8005C9FC(0x206, va_arg(vlist, Vec3*));
+        break;
+    case 0x49F: {
+        HSD_JObj* attach_jobj;
+
+        attach_jobj = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x7D00, arg_gobj, attach_jobj);
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        hsd_8039EFAC(0, 0x20, 0x7D00, attach_jobj);
+        break;
+    }
+    case 0x4A0:
+        ret_obj = efLib_8005C9FC(0x7D02, va_arg(vlist, Vec3*));
+        break;
+    case 0x4A5:
+        ret_obj = efLib_8005CD2C(0xA028, vlist, arg_gobj);
+        break;
+    case 0x4A6:
+        ret_obj = efLib_8005CD2C(0xA029, vlist, arg_gobj);
+        break;
+    case 0x4A7:
+        ret_obj = efLib_8005CD2C(0xA02A, vlist, arg_gobj);
+        break;
+    case 0x4A8:
+        ret_obj = efLib_8005CD2C(0xA02B, vlist, arg_gobj);
+        break;
+    case 0x4A1:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D4, jobj_1);
+        break;
+    case 0x4A2:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D2, jobj_1);
+        break;
+    case 0x4A3:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D3, jobj_1);
+        break;
+    case 0x4A4:
+        ret_obj = efLib_8005C814(0x84D0, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+        }
+        break;
+    case 0x4A9:
+        ret_obj = efLib_8005C3DC(0x9858, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+            eff_1 = ret_obj;
+            HSD_JObjAnimAll(eff_1->gobj->hsd_obj);
+        }
+        break;
+    case 0x4AA:
+        ret_obj = efLib_8005C3DC(0x9859, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            eff_1 = ret_obj;
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, f32_1);
+            HSD_JObjAnimAll(eff_1->gobj->hsd_obj);
+        }
+        break;
+    case 0x4AB:
+        ret_obj = efLib_8005C6F4(0x9471, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0x9470, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x4AC:
+        ret_obj = efLib_8005C814(0x80E8, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, ef_804D81E8);
+            HSD_JObjSetRotationZ(eff_1->gobj->hsd_obj, *va_arg(vlist, f32*));
+        }
+        break;
+    case 0x4AD:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x24, 0x8CA0, jobj_1);
+        break;
+    case 0x4AE:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x2E, 0xB3B0, jobj_1);
+        break;
+    case 0x4AF:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x2E, 0xB3B1, jobj_1);
+        break;
+    case 0x4B0:
+        ret_obj = efLib_8005CF40(0xB3B6, vlist);
+        break;
+    case 0x4B1: {
+        HSD_JObj* attach_jobj;
+
+        attach_jobj = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x9088, arg_gobj, attach_jobj);
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+        }
+        hsd_8039EFAC(0, 0x25, 0x9088, attach_jobj);
+        break;
+    }
+    case 0x4B2:
+        ret_obj = efLib_8005C9FC(0x908A, va_arg(vlist, Vec3*));
+        break;
+    case 0x4B3:
+        ret_obj = efLib_8005C6F4(0xB799, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0xB798, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x4B4:
+        ret_obj = efLib_8005C6F4(0x4E20, arg_gobj, va_arg(vlist, void*));
+        break;
+    case 0x4B5:
+        ret_obj = efLib_8005C6F4(0x4E21, arg_gobj, va_arg(vlist, void*));
+        break;
+    case 0x4B6:
+        ret_obj = efLib_8005C2BC(0x5208, arg_gobj, va_arg(vlist, HSD_JObj*));
+        goto efSync_SpawnSpecial_case_4B6_4B7;
+    case 0x4B7:
+        ret_obj = efLib_8005C2BC(0x5209, arg_gobj, va_arg(vlist, HSD_JObj*));
+    efSync_SpawnSpecial_case_4B6_4B7:
+        if (ret_obj != NULL) {
+            HSD_JObj* jobj;
+
+            jobj_1 = GET_JOBJ(arg_gobj);
+            HSD_JObjGetScale(jobj_1, &sp130);
+            eff_1 = ret_obj;
+            jobj = eff_1->gobj->hsd_obj;
+            ((jobj) ? ((void) 0) : __assert(ef_804D39D8, 823, ef_804D39E0));
```

## PR #2241: Match ef_061D 100% and rename to efspecial (special effects)
Path: src/melee/ef/efspecial.c
URL: https://github.com/doldecomp/melee/pull/2241#discussion_r2920385474
Author: ribbanya

Added a todo comment, doesn't seem that straightforward to me.

Hunk:
```diff
@@ -0,0 +1,509 @@
+#include "efspecial.h"
+
+#include "eflib.h"
+#include "math.h"
+#include "types.h"
+
+#include "baselib/class.h"
+#include "baselib/debug.h"
+
+#include "baselib/forward.h"
+
+#include "baselib/gobj.h"
+#include "baselib/list.h"
+#include "baselib/object.h"
+#include "baselib/pobj.h"
+
+#include <dolphin/mtx.h>
+
+extern char ef_803BF9D0[];
+extern char ef_804D39D8[];
+extern char ef_804D39E0[];
+
+#define efSpecial_HSD_ASSERT_MSG(line)                                        \
+    (((line) == 619)                                     ? "rotate"           \
+     : ((line) == 640 || (line) == 661 || (line) == 682) ? ef_803BF9D0        \
+     : ((line) == 761 || (line) == 824)                  ? "scale"            \
+     : ((line) == 917 || (line) == 980)                  ? "translate"        \
+     : ((line) == 1171)                                  ? "mtx"              \
+                                                         : ef_804D39E0)
+
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0)                                                      \
+            : __assert(ef_804D39D8, line, efSpecial_HSD_ASSERT_MSG(line)))
+
+#include "baselib/jobj.h"
+
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0) : __assert(__FILE__, line, #cond))
+
+#include "baselib/particle.h"
+#include "ft/inlines.h"
+
+/* 458EE0 */ extern HSD_JObj* efLib_80458EE0[16];
+/* 4D64E8 */ extern s32 efLib_804D64E8;
+/* 4D64F0 */ extern s32 efLib_804D64F0;
+/* 3BF9D0 */ char ef_803BF9D0[] = "!(jobj->flags & JOBJ_USE_QUATERNION)";
+/* 4D39D8 */ SDATA char ef_804D39D8[] = "jobj.h";
+/* 4D39E0 */ SDATA char ef_804D39E0[] = "jobj";
+/* 4D81D0 */ extern const f32 ef_804D81D0;
+/* 4D81D8 */ extern const f64 ef_804D81D8;
+/* 4D81E0 */ extern const f64 ef_804D81E0;
+/* 4D81E8 */ extern const f32 ef_804D81E8;
+/* 4D81EC */ extern const f32 ef_804D81EC;
+/* 4D81F0 */ extern const f32 ef_804D81F0;
+
+void* efSync_SpawnSpecial(s32 gfx_id, HSD_GObj* arg_gobj, void* vlist)
+{
+    void* ret_obj;
+    u8 sp_pad128[0x8];
+    Vec3 sp130;
+    u8 sp_pad130[0x4];
+    Effect* eff_2;
+    Effect* eff_1;
+    Fighter* fighter_1;
+    FighterBone* fighter_bone_1;
+    f64 f64_1;
+    f32 f32_1;
+    HSD_JObj* jobj_1;
+    HSD_JObj* jobj_2;
+    s32 cnt;
+    PAD_STACK(0x98);
+
+    efLib_804D64E8 = 1;
+    ret_obj = NULL;
+
+    switch (gfx_id) {
+    case 0x479:
+        ret_obj = efLib_8005C9FC(0x3F2, va_arg(vlist, Vec3*));
+        break;
+    case 0x47A:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x3E8, arg_gobj, jobj_1);
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        hsd_8039EFAC(0, 1, 0x3E9, jobj_1);
+        break;
+    case 0x47B:
+        ret_obj = efLib_8005C9FC(0x3EB, va_arg(vlist, Vec3*));
+        break;
+    case 0x47C:
+        ret_obj = efLib_8005C3DC(0x3E9, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005F08C;
+        }
+        break;
+    case 0x47D:
+        ret_obj = hsd_8039EFAC(0, 1, 0x3F0, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x47E:
+        ret_obj = hsd_8039EFAC(0, 1, 0x3F1, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x47F:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D4, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x480:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D2, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x481:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7D3, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x482:
+        ret_obj = efLib_8005C1B4(0x7D0, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005EBC8;
+        }
+        break;
+    case 0x483:
+        ret_obj = efLib_8005C9FC(0x7D7, va_arg(vlist, Vec3*));
+        break;
+    case 0x484:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7DB, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x485:
+        ret_obj = hsd_8039EFAC(0, 2, 0x7DE, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x486:
+        ret_obj = efLib_8005C814(0x7D1, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x487:
+        ret_obj = efLib_8005C5C4(0x7D2, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x488:
+        ret_obj = efLib_8005C3DC(0xBB8, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x489:
+        ret_obj = efLib_8005C3DC(0xBB9, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48A:
+        ret_obj = efLib_8005C3DC(0xBBA, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48B:
+        ret_obj = efLib_8005C1B4(0xBBB, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x48C:
+        ret_obj = efLib_8005C1B4(0xBBC, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005E3A0;
+        }
+        break;
+    case 0x48D:
+        ret_obj = efLib_8005CF40(0xBC0, vlist);
+        break;
+    case 0x48E:
+        ret_obj = efLib_8005C814(0xBBD, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, ef_804D81E8);
+            HSD_JObjSetRotationZ(eff_1->gobj->hsd_obj, *va_arg(vlist, f32*));
+        }
+        break;
+    case 0x48F:
+        ret_obj = efLib_8005C6F4(0xFA0, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0xFA1, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x490:
+        ret_obj = efLib_8005C1B4(0xFA2, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->translate.z = *va_arg(vlist, f32*);
+            eff_1->x10 = efLib_8005EDDC;
+        }
+        break;
+    case 0x491:
+        ret_obj = efLib_8005C1B4(0xFA4, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x492:
+        ret_obj = efLib_8005C3DC(0xFA3, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x493:
+        ret_obj = efLib_8005C3DC(0xFA5, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x494:
+        fighter_1 = GET_FIGHTER(arg_gobj);
+        fighter_bone_1 = fighter_1->parts;
+        jobj_1 = fighter_bone_1[44].joint;
+        jobj_2 = fighter_bone_1[1].joint;
+        ret_obj = efLib_8005C2BC(0x1388, arg_gobj, jobj_1);
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x10 = efLib_8005E090;
+            ((Effect*) ret_obj)->x24 = 0x41;
+            ((Effect*) ret_obj)->x14 = NULL;
+            eff_1 = efLib_8005C1B4(0x1389, arg_gobj, jobj_1);
+            ((Effect*) ret_obj)->x0 = (void*) eff_1;
+            if (eff_1 != NULL) {
+                eff_1 = (Effect*) ((Effect*) ret_obj)->x0;
+                eff_1->x10 = efLib_8005E090;
+                eff_1->x24 = 0x41;
+                eff_1->x14 = fighter_1;
+                eff_2 = efLib_8005C1B4(0x138A, arg_gobj, jobj_2);
+                eff_1->x0 = (void*) eff_2;
+                if (eff_2 != NULL) {
+                    eff_2 = (Effect*) eff_1->x0;
+                    eff_2->x10 = efLib_8005E090;
+                    eff_2->x24 = 0x41;
+                    eff_2->x14 = fighter_1;
+                }
+            }
+        }
+        break;
+    case 0x495:
+        ret_obj = efLib_8005C3DC(0x138B, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        break;
+    case 0x496:
+        ret_obj = efLib_8005C1B4(0x138C, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x497:
+        ret_obj = efLib_8005C1B4(0x138D, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            eff_1->x10 = efLib_8005E2B4;
+        }
+        break;
+    case 0x498:
+        ret_obj = efLib_8005C2BC(0x138E, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x499:
+        ret_obj = efLib_8005C2BC(0x138F, arg_gobj, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49A:
+        ret_obj = efLib_8005CF40(0x138B, vlist);
+        break;
+    case 0x49B:
+        ret_obj = hsd_8039EFAC(0, 5, 0x138F, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49C:
+        ret_obj = hsd_8039EFAC(0, 5, 0x1395, va_arg(vlist, HSD_JObj*));
+        break;
+    case 0x49D:
+        ret_obj = efLib_8005C814(0x1390, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            jobj_2 = arg_gobj->hsd_obj;
+            jobj_1 = GET_JOBJ(eff_1->gobj);
+            HSD_JObjSetScaleX(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetScaleY(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetScaleZ(jobj_1, HSD_JObjGetScaleY(jobj_2));
+            HSD_JObjSetTranslateZ(HSD_JObjGetChild(jobj_1),
+                                  HSD_JObjGetTranslationZ(jobj_1) -
+                                      ef_804D81EC);
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                HSD_JObjSetRotationY(jobj_1, ef_804D81F0);
+                HSD_JObjSetRotationZ(jobj_1, -*va_arg(vlist, f32*));
+            } else {
+                HSD_JObjSetRotationY(jobj_1, ef_804D81E8);
+                HSD_JObjSetRotationZ(jobj_1, *va_arg(vlist, f32*));
+            }
+            eff_1->x10 = efLib_8005E1D8;
+        }
+        break;
+    case 0x49E:
+        ret_obj = efLib_8005C9FC(0x206, va_arg(vlist, Vec3*));
+        break;
+    case 0x49F: {
+        HSD_JObj* attach_jobj;
+
+        attach_jobj = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x7D00, arg_gobj, attach_jobj);
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(GET_JOBJ(eff_1->gobj), f32_1);
+        }
+        hsd_8039EFAC(0, 0x20, 0x7D00, attach_jobj);
+        break;
+    }
+    case 0x4A0:
+        ret_obj = efLib_8005C9FC(0x7D02, va_arg(vlist, Vec3*));
+        break;
+    case 0x4A5:
+        ret_obj = efLib_8005CD2C(0xA028, vlist, arg_gobj);
+        break;
+    case 0x4A6:
+        ret_obj = efLib_8005CD2C(0xA029, vlist, arg_gobj);
+        break;
+    case 0x4A7:
+        ret_obj = efLib_8005CD2C(0xA02A, vlist, arg_gobj);
+        break;
+    case 0x4A8:
+        ret_obj = efLib_8005CD2C(0xA02B, vlist, arg_gobj);
+        break;
+    case 0x4A1:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D4, jobj_1);
+        break;
+    case 0x4A2:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D2, jobj_1);
+        break;
+    case 0x4A3:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x22, 0x84D3, jobj_1);
+        break;
+    case 0x4A4:
+        ret_obj = efLib_8005C814(0x84D0, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+        }
+        break;
+    case 0x4A9:
+        ret_obj = efLib_8005C3DC(0x9858, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+            eff_1 = ret_obj;
+            HSD_JObjAnimAll(eff_1->gobj->hsd_obj);
+        }
+        break;
+    case 0x4AA:
+        ret_obj = efLib_8005C3DC(0x9859, arg_gobj, va_arg(vlist, HSD_JObj*));
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            eff_1 = ret_obj;
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, f32_1);
+            HSD_JObjAnimAll(eff_1->gobj->hsd_obj);
+        }
+        break;
+    case 0x4AB:
+        ret_obj = efLib_8005C6F4(0x9471, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0x9470, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x4AC:
+        ret_obj = efLib_8005C814(0x80E8, arg_gobj, va_arg(vlist, Vec3*));
+        if (ret_obj != NULL) {
+            eff_1 = ret_obj;
+            HSD_JObjSetRotationY(eff_1->gobj->hsd_obj, ef_804D81E8);
+            HSD_JObjSetRotationZ(eff_1->gobj->hsd_obj, *va_arg(vlist, f32*));
+        }
+        break;
+    case 0x4AD:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x24, 0x8CA0, jobj_1);
+        break;
+    case 0x4AE:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x2E, 0xB3B0, jobj_1);
+        break;
+    case 0x4AF:
+        jobj_1 = va_arg(vlist, HSD_JObj*);
+        ret_obj = hsd_8039EFAC(0, 0x2E, 0xB3B1, jobj_1);
+        break;
+    case 0x4B0:
+        ret_obj = efLib_8005CF40(0xB3B6, vlist);
+        break;
+    case 0x4B1: {
+        HSD_JObj* attach_jobj;
+
+        attach_jobj = va_arg(vlist, HSD_JObj*);
+        ret_obj = efLib_8005C1B4(0x9088, arg_gobj, attach_jobj);
+        if (ret_obj != NULL) {
+            if (*va_arg(vlist, f32*) < ef_804D81D0) {
+                f64_1 = ef_804D81D8;
+            } else {
+                f64_1 = ef_804D81E0;
+            }
+            jobj_1 = GET_JOBJ(((Effect*) ret_obj)->gobj);
+            f32_1 = f64_1;
+            HSD_JObjSetRotationY(jobj_1, f32_1);
+        }
+        hsd_8039EFAC(0, 0x25, 0x9088, attach_jobj);
+        break;
+    }
+    case 0x4B2:
+        ret_obj = efLib_8005C9FC(0x908A, va_arg(vlist, Vec3*));
+        break;
+    case 0x4B3:
+        ret_obj = efLib_8005C6F4(0xB799, arg_gobj, va_arg(vlist, void*));
+        if (ret_obj != NULL) {
+            ((Effect*) ret_obj)->x0 =
+                (void*) efLib_8005C6F4(0xB798, arg_gobj, va_arg(vlist, void*));
+        }
+        break;
+    case 0x4B4:
+        ret_obj = efLib_8005C6F4(0x4E20, arg_gobj, va_arg(vlist, void*));
+        break;
+    case 0x4B5:
+        ret_obj = efLib_8005C6F4(0x4E21, arg_gobj, va_arg(vlist, void*));
+        break;
+    case 0x4B6:
+        ret_obj = efLib_8005C2BC(0x5208, arg_gobj, va_arg(vlist, HSD_JObj*));
+        goto efSync_SpawnSpecial_case_4B6_4B7;
+    case 0x4B7:
+        ret_obj = efLib_8005C2BC(0x5209, arg_gobj, va_arg(vlist, HSD_JObj*));
+    efSync_SpawnSpecial_case_4B6_4B7:
+        if (ret_obj != NULL) {
+            HSD_JObj* jobj;
+
+            jobj_1 = GET_JOBJ(arg_gobj);
+            HSD_JObjGetScale(jobj_1, &sp130);
+            eff_1 = ret_obj;
+            jobj = eff_1->gobj->hsd_obj;
+            ((jobj) ? ((void) 0) : __assert(ef_804D39D8, 823, ef_804D39E0));
```

## PR #2232: grzebes
Path: src/melee/gr/grzebes.c
URL: https://github.com/doldecomp/melee/pull/2232#discussion_r2912400349
Author: PsiLupan

Can these be fixed to be used in-place?

https://github.com/doldecomp/melee/blob/cf59f2c4b8e1b47bfd92ce3128e99d9b8137b6e0/src/melee/gr/grlast.c#L217

Being an example of that what looks like for that particular OSReport.

Hunk:
```diff
@@ -4,42 +4,203 @@
 
 #include "forward.h"
 
+#include <dolphin/os.h>
+
+#include "cm/camera.h"
 #include "ft/ftdevice.h"
+#include "ft/ftlib.h"
+#include "gr/granime.h"
+#include "gr/grdatfiles.h"
+#include "gr/grdisplay.h"
 #include "gr/grlib.h"
+#include "gr/grmaterial.h"
 #include "gr/grzakogenerator.h"
 #include "gr/inlines.h"
+#include "lb/lb_00B0.h"
+#include "lb/lb_00F9.h"
+#include "mp/mplib.h"
+
+#include <baselib/gobjgxlink.h>
+#include <baselib/gobjproc.h>
+#include <baselib/jobj.h>
+#include <baselib/lobj.h>
+#include <baselib/random.h>
+
+#include <MSL/math_ppc.h>
 
 /* 1D84A0 */ static void grZebes_801D84A0(bool arg);
 /* 1D8528 */ static void grZebes_801D8528(void);
 /* 1D852C */ void grZebes_801D852C(void);
 /* 1D8550 */ static bool grZebes_801D8550(void);
-/* 1D8558 */ static void grZebes_801D8558(int);
+/* 1D8558 */ static Ground_GObj* grZebes_801D8558(int);
 /* 1D8814 */ static bool grZebes_801D8814(Ground_GObj* arg);
 /* 1D90FC */ static void grZebes_801D90FC(Ground_GObj* arg);
 /* 1D9254 */ static bool grZebes_801D9254(Ground_GObj* arg);
 /* 1D93D8 */ static void grZebes_801D93D8(Ground_GObj* arg);
 /* 1D93DC */ void grZebes_801D93DC(Ground_GObj* gobj);
 /* 1D9408 */ static bool grZebes_801D9408(Ground_GObj* arg);
+/* 1D9410 */ static void grZebes_801D9410(Ground_GObj* arg);
 /* 1D94EC */ static void grZebes_801D94EC(Ground_GObj* arg);
 /* 1D94F0 */ static void fn_801D94F0(Ground_GObj* gobj);
 /* 1D95B0 */ static bool grZebes_801D95B0(Ground_GObj* arg);
+/* 1D95B8 */ static void grZebes_801D95B8(Ground_GObj* arg);
 /* 1D9754 */ static void grZebes_801D9754(Ground_GObj* arg);
 /* 1D99D8 */ static bool grZebes_801D99D8(Ground_GObj* arg);
+/* 1DA0C4 */ static void grZebes_801DA0C4(f32 level);
+/* 1DA254 */ static void grZebes_801DA254(Ground_GObj* gobj, f32 level);
 /* 1D9F2C */ static void grZebes_801D9F2C(Ground_GObj* arg);
 /* 1D9F7C */ static bool grZebes_801D9F7C(Ground_GObj* arg);
 /* 1DA0C0 */ static void grZebes_801DA0C0(Ground_GObj* arg);
 /* 1DA3E8 */ static void grZebes_801DA3E8(void);
-/* 1DA9D8 */ static void fn_801DA9D8(UNK_T arg0, Ground* gp, float* y,
-                                     float z);
-/* 1DA9F0 */ static void fn_801DA9F0(UNK_T arg0, Ground* gp, float y,
-                                     float* x);
+/* 1DA528 */ static s32 grZebes_801DA528(HSD_GObj*, void*, s32, s32);
+/* 1DA9D8 */ static void fn_801DA9D8(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DA9F0 */ static void fn_801DA9F0(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DAC90 */ static void fn_801DAC90(Item_GObj*, Ground*, Vec3*, HSD_GObj*,
+                                     f32);
+/* 1DAA08 */ static s32 grZebes_801DAA08(void);
+/* 1DAE70 */ static void grZebes_801DAE70(s32, u8, f32, f32, f32);
+/* 1DB3CC */ static s32 grZebes_801DB3CC(HSD_GObj* gobj);
+/* 1DBB60 */ static s32 grZebes_801DBB60(s32 arg);
+/* 1DC260 */ static void grZebes_801DC260(void);
+/* 1DC408 */ static void grZebes_801DC408(Ground_GObj*);
+/* 1DC744 */ static void grZebes_801DC744(s32, u8);
+/* 1DC9DC */ static void grZebes_801DC9DC(s32 arg);
 /* 1DCCB8 */ static DynamicsDesc* grZebes_801DCCB8(enum_t arg);
 /* 1DCCC0 */ static bool grZebes_801DCCC0(Vec3* arg, int arg0, HSD_JObj* jobj);
-/* 4D6990 */ static HSD_GObj* grZe_804D6990;
+
+static s16 grZe_803E1A10[] = {
+    1, 6, 21, 4, 6, 14, 3, 6,
+    1, 2, 7, 6, 5, 7, 1, 0,
+};
+
+static StageCallbacks grZe_callbacks[] = {
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+};
+
+static u8 grZe_803E1B20[0x0A] = { 0 };
+static u8 grZe_803E1B2C[0x34] = { 0 };
+static char grZe_803E1B60[0x24] = "%s:%d: couldn t get gobj(id=%d)\n";
```

## PR #2232: grzebes
Path: src/melee/gr/grzebes.c
URL: https://github.com/doldecomp/melee/pull/2232#discussion_r2912411154
Author: PsiLupan

The rest of the statics should probably just be removed until the file is correctly matched. I don't really like leaving the false impression of ordering until have the rest of the file matched, since things like that `map_a_gobj` are going to be an HSD_ASSERT that tells us the actual name for a temp.

Hunk:
```diff
@@ -4,42 +4,203 @@
 
 #include "forward.h"
 
+#include <dolphin/os.h>
+
+#include "cm/camera.h"
 #include "ft/ftdevice.h"
+#include "ft/ftlib.h"
+#include "gr/granime.h"
+#include "gr/grdatfiles.h"
+#include "gr/grdisplay.h"
 #include "gr/grlib.h"
+#include "gr/grmaterial.h"
 #include "gr/grzakogenerator.h"
 #include "gr/inlines.h"
+#include "lb/lb_00B0.h"
+#include "lb/lb_00F9.h"
+#include "mp/mplib.h"
+
+#include <baselib/gobjgxlink.h>
+#include <baselib/gobjproc.h>
+#include <baselib/jobj.h>
+#include <baselib/lobj.h>
+#include <baselib/random.h>
+
+#include <MSL/math_ppc.h>
 
 /* 1D84A0 */ static void grZebes_801D84A0(bool arg);
 /* 1D8528 */ static void grZebes_801D8528(void);
 /* 1D852C */ void grZebes_801D852C(void);
 /* 1D8550 */ static bool grZebes_801D8550(void);
-/* 1D8558 */ static void grZebes_801D8558(int);
+/* 1D8558 */ static Ground_GObj* grZebes_801D8558(int);
 /* 1D8814 */ static bool grZebes_801D8814(Ground_GObj* arg);
 /* 1D90FC */ static void grZebes_801D90FC(Ground_GObj* arg);
 /* 1D9254 */ static bool grZebes_801D9254(Ground_GObj* arg);
 /* 1D93D8 */ static void grZebes_801D93D8(Ground_GObj* arg);
 /* 1D93DC */ void grZebes_801D93DC(Ground_GObj* gobj);
 /* 1D9408 */ static bool grZebes_801D9408(Ground_GObj* arg);
+/* 1D9410 */ static void grZebes_801D9410(Ground_GObj* arg);
 /* 1D94EC */ static void grZebes_801D94EC(Ground_GObj* arg);
 /* 1D94F0 */ static void fn_801D94F0(Ground_GObj* gobj);
 /* 1D95B0 */ static bool grZebes_801D95B0(Ground_GObj* arg);
+/* 1D95B8 */ static void grZebes_801D95B8(Ground_GObj* arg);
 /* 1D9754 */ static void grZebes_801D9754(Ground_GObj* arg);
 /* 1D99D8 */ static bool grZebes_801D99D8(Ground_GObj* arg);
+/* 1DA0C4 */ static void grZebes_801DA0C4(f32 level);
+/* 1DA254 */ static void grZebes_801DA254(Ground_GObj* gobj, f32 level);
 /* 1D9F2C */ static void grZebes_801D9F2C(Ground_GObj* arg);
 /* 1D9F7C */ static bool grZebes_801D9F7C(Ground_GObj* arg);
 /* 1DA0C0 */ static void grZebes_801DA0C0(Ground_GObj* arg);
 /* 1DA3E8 */ static void grZebes_801DA3E8(void);
-/* 1DA9D8 */ static void fn_801DA9D8(UNK_T arg0, Ground* gp, float* y,
-                                     float z);
-/* 1DA9F0 */ static void fn_801DA9F0(UNK_T arg0, Ground* gp, float y,
-                                     float* x);
+/* 1DA528 */ static s32 grZebes_801DA528(HSD_GObj*, void*, s32, s32);
+/* 1DA9D8 */ static void fn_801DA9D8(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DA9F0 */ static void fn_801DA9F0(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DAC90 */ static void fn_801DAC90(Item_GObj*, Ground*, Vec3*, HSD_GObj*,
+                                     f32);
+/* 1DAA08 */ static s32 grZebes_801DAA08(void);
+/* 1DAE70 */ static void grZebes_801DAE70(s32, u8, f32, f32, f32);
+/* 1DB3CC */ static s32 grZebes_801DB3CC(HSD_GObj* gobj);
+/* 1DBB60 */ static s32 grZebes_801DBB60(s32 arg);
+/* 1DC260 */ static void grZebes_801DC260(void);
+/* 1DC408 */ static void grZebes_801DC408(Ground_GObj*);
+/* 1DC744 */ static void grZebes_801DC744(s32, u8);
+/* 1DC9DC */ static void grZebes_801DC9DC(s32 arg);
 /* 1DCCB8 */ static DynamicsDesc* grZebes_801DCCB8(enum_t arg);
 /* 1DCCC0 */ static bool grZebes_801DCCC0(Vec3* arg, int arg0, HSD_JObj* jobj);
-/* 4D6990 */ static HSD_GObj* grZe_804D6990;
+
+static s16 grZe_803E1A10[] = {
+    1, 6, 21, 4, 6, 14, 3, 6,
+    1, 2, 7, 6, 5, 7, 1, 0,
+};
+
+static StageCallbacks grZe_callbacks[] = {
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+};
+
+static u8 grZe_803E1B20[0x0A] = { 0 };
+static u8 grZe_803E1B2C[0x34] = { 0 };
+static char grZe_803E1B60[0x24] = "%s:%d: couldn t get gobj(id=%d)\n";
```

## PR #2232: grzebes
Path: src/melee/gr/grzebes.c
URL: https://github.com/doldecomp/melee/pull/2232#discussion_r2912984661
Author: jellejurre

I was unsure what to do with the statics that were being used. Is doing it like this okay?

Hunk:
```diff
@@ -4,42 +4,203 @@
 
 #include "forward.h"
 
+#include <dolphin/os.h>
+
+#include "cm/camera.h"
 #include "ft/ftdevice.h"
+#include "ft/ftlib.h"
+#include "gr/granime.h"
+#include "gr/grdatfiles.h"
+#include "gr/grdisplay.h"
 #include "gr/grlib.h"
+#include "gr/grmaterial.h"
 #include "gr/grzakogenerator.h"
 #include "gr/inlines.h"
+#include "lb/lb_00B0.h"
+#include "lb/lb_00F9.h"
+#include "mp/mplib.h"
+
+#include <baselib/gobjgxlink.h>
+#include <baselib/gobjproc.h>
+#include <baselib/jobj.h>
+#include <baselib/lobj.h>
+#include <baselib/random.h>
+
+#include <MSL/math_ppc.h>
 
 /* 1D84A0 */ static void grZebes_801D84A0(bool arg);
 /* 1D8528 */ static void grZebes_801D8528(void);
 /* 1D852C */ void grZebes_801D852C(void);
 /* 1D8550 */ static bool grZebes_801D8550(void);
-/* 1D8558 */ static void grZebes_801D8558(int);
+/* 1D8558 */ static Ground_GObj* grZebes_801D8558(int);
 /* 1D8814 */ static bool grZebes_801D8814(Ground_GObj* arg);
 /* 1D90FC */ static void grZebes_801D90FC(Ground_GObj* arg);
 /* 1D9254 */ static bool grZebes_801D9254(Ground_GObj* arg);
 /* 1D93D8 */ static void grZebes_801D93D8(Ground_GObj* arg);
 /* 1D93DC */ void grZebes_801D93DC(Ground_GObj* gobj);
 /* 1D9408 */ static bool grZebes_801D9408(Ground_GObj* arg);
+/* 1D9410 */ static void grZebes_801D9410(Ground_GObj* arg);
 /* 1D94EC */ static void grZebes_801D94EC(Ground_GObj* arg);
 /* 1D94F0 */ static void fn_801D94F0(Ground_GObj* gobj);
 /* 1D95B0 */ static bool grZebes_801D95B0(Ground_GObj* arg);
+/* 1D95B8 */ static void grZebes_801D95B8(Ground_GObj* arg);
 /* 1D9754 */ static void grZebes_801D9754(Ground_GObj* arg);
 /* 1D99D8 */ static bool grZebes_801D99D8(Ground_GObj* arg);
+/* 1DA0C4 */ static void grZebes_801DA0C4(f32 level);
+/* 1DA254 */ static void grZebes_801DA254(Ground_GObj* gobj, f32 level);
 /* 1D9F2C */ static void grZebes_801D9F2C(Ground_GObj* arg);
 /* 1D9F7C */ static bool grZebes_801D9F7C(Ground_GObj* arg);
 /* 1DA0C0 */ static void grZebes_801DA0C0(Ground_GObj* arg);
 /* 1DA3E8 */ static void grZebes_801DA3E8(void);
-/* 1DA9D8 */ static void fn_801DA9D8(UNK_T arg0, Ground* gp, float* y,
-                                     float z);
-/* 1DA9F0 */ static void fn_801DA9F0(UNK_T arg0, Ground* gp, float y,
-                                     float* x);
+/* 1DA528 */ static s32 grZebes_801DA528(HSD_GObj*, void*, s32, s32);
+/* 1DA9D8 */ static void fn_801DA9D8(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DA9F0 */ static void fn_801DA9F0(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DAC90 */ static void fn_801DAC90(Item_GObj*, Ground*, Vec3*, HSD_GObj*,
+                                     f32);
+/* 1DAA08 */ static s32 grZebes_801DAA08(void);
+/* 1DAE70 */ static void grZebes_801DAE70(s32, u8, f32, f32, f32);
+/* 1DB3CC */ static s32 grZebes_801DB3CC(HSD_GObj* gobj);
+/* 1DBB60 */ static s32 grZebes_801DBB60(s32 arg);
+/* 1DC260 */ static void grZebes_801DC260(void);
+/* 1DC408 */ static void grZebes_801DC408(Ground_GObj*);
+/* 1DC744 */ static void grZebes_801DC744(s32, u8);
+/* 1DC9DC */ static void grZebes_801DC9DC(s32 arg);
 /* 1DCCB8 */ static DynamicsDesc* grZebes_801DCCB8(enum_t arg);
 /* 1DCCC0 */ static bool grZebes_801DCCC0(Vec3* arg, int arg0, HSD_JObj* jobj);
-/* 4D6990 */ static HSD_GObj* grZe_804D6990;
+
+static s16 grZe_803E1A10[] = {
+    1, 6, 21, 4, 6, 14, 3, 6,
+    1, 2, 7, 6, 5, 7, 1, 0,
+};
+
+static StageCallbacks grZe_callbacks[] = {
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+};
+
+static u8 grZe_803E1B20[0x0A] = { 0 };
+static u8 grZe_803E1B2C[0x34] = { 0 };
+static char grZe_803E1B60[0x24] = "%s:%d: couldn t get gobj(id=%d)\n";
```

## PR #2232: grzebes
Path: src/melee/gr/grzebes.c
URL: https://github.com/doldecomp/melee/pull/2232#discussion_r2913014666
Author: PsiLupan

Yeah, that looks a lot better.

Hunk:
```diff
@@ -4,42 +4,203 @@
 
 #include "forward.h"
 
+#include <dolphin/os.h>
+
+#include "cm/camera.h"
 #include "ft/ftdevice.h"
+#include "ft/ftlib.h"
+#include "gr/granime.h"
+#include "gr/grdatfiles.h"
+#include "gr/grdisplay.h"
 #include "gr/grlib.h"
+#include "gr/grmaterial.h"
 #include "gr/grzakogenerator.h"
 #include "gr/inlines.h"
+#include "lb/lb_00B0.h"
+#include "lb/lb_00F9.h"
+#include "mp/mplib.h"
+
+#include <baselib/gobjgxlink.h>
+#include <baselib/gobjproc.h>
+#include <baselib/jobj.h>
+#include <baselib/lobj.h>
+#include <baselib/random.h>
+
+#include <MSL/math_ppc.h>
 
 /* 1D84A0 */ static void grZebes_801D84A0(bool arg);
 /* 1D8528 */ static void grZebes_801D8528(void);
 /* 1D852C */ void grZebes_801D852C(void);
 /* 1D8550 */ static bool grZebes_801D8550(void);
-/* 1D8558 */ static void grZebes_801D8558(int);
+/* 1D8558 */ static Ground_GObj* grZebes_801D8558(int);
 /* 1D8814 */ static bool grZebes_801D8814(Ground_GObj* arg);
 /* 1D90FC */ static void grZebes_801D90FC(Ground_GObj* arg);
 /* 1D9254 */ static bool grZebes_801D9254(Ground_GObj* arg);
 /* 1D93D8 */ static void grZebes_801D93D8(Ground_GObj* arg);
 /* 1D93DC */ void grZebes_801D93DC(Ground_GObj* gobj);
 /* 1D9408 */ static bool grZebes_801D9408(Ground_GObj* arg);
+/* 1D9410 */ static void grZebes_801D9410(Ground_GObj* arg);
 /* 1D94EC */ static void grZebes_801D94EC(Ground_GObj* arg);
 /* 1D94F0 */ static void fn_801D94F0(Ground_GObj* gobj);
 /* 1D95B0 */ static bool grZebes_801D95B0(Ground_GObj* arg);
+/* 1D95B8 */ static void grZebes_801D95B8(Ground_GObj* arg);
 /* 1D9754 */ static void grZebes_801D9754(Ground_GObj* arg);
 /* 1D99D8 */ static bool grZebes_801D99D8(Ground_GObj* arg);
+/* 1DA0C4 */ static void grZebes_801DA0C4(f32 level);
+/* 1DA254 */ static void grZebes_801DA254(Ground_GObj* gobj, f32 level);
 /* 1D9F2C */ static void grZebes_801D9F2C(Ground_GObj* arg);
 /* 1D9F7C */ static bool grZebes_801D9F7C(Ground_GObj* arg);
 /* 1DA0C0 */ static void grZebes_801DA0C0(Ground_GObj* arg);
 /* 1DA3E8 */ static void grZebes_801DA3E8(void);
-/* 1DA9D8 */ static void fn_801DA9D8(UNK_T arg0, Ground* gp, float* y,
-                                     float z);
-/* 1DA9F0 */ static void fn_801DA9F0(UNK_T arg0, Ground* gp, float y,
-                                     float* x);
+/* 1DA528 */ static s32 grZebes_801DA528(HSD_GObj*, void*, s32, s32);
+/* 1DA9D8 */ static void fn_801DA9D8(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DA9F0 */ static void fn_801DA9F0(Item_GObj* arg0, Ground* gp, Vec3* pos,
+                                     HSD_GObj* fobj, f32 slope);
+/* 1DAC90 */ static void fn_801DAC90(Item_GObj*, Ground*, Vec3*, HSD_GObj*,
+                                     f32);
+/* 1DAA08 */ static s32 grZebes_801DAA08(void);
+/* 1DAE70 */ static void grZebes_801DAE70(s32, u8, f32, f32, f32);
+/* 1DB3CC */ static s32 grZebes_801DB3CC(HSD_GObj* gobj);
+/* 1DBB60 */ static s32 grZebes_801DBB60(s32 arg);
+/* 1DC260 */ static void grZebes_801DC260(void);
+/* 1DC408 */ static void grZebes_801DC408(Ground_GObj*);
+/* 1DC744 */ static void grZebes_801DC744(s32, u8);
+/* 1DC9DC */ static void grZebes_801DC9DC(s32 arg);
 /* 1DCCB8 */ static DynamicsDesc* grZebes_801DCCB8(enum_t arg);
 /* 1DCCC0 */ static bool grZebes_801DCCC0(Vec3* arg, int arg0, HSD_JObj* jobj);
-/* 4D6990 */ static HSD_GObj* grZe_804D6990;
+
+static s16 grZe_803E1A10[] = {
+    1, 6, 21, 4, 6, 14, 3, 6,
+    1, 2, 7, 6, 5, 7, 1, 0,
+};
+
+static StageCallbacks grZe_callbacks[] = {
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+};
+
+static u8 grZe_803E1B20[0x0A] = { 0 };
+static u8 grZe_803E1B2C[0x34] = { 0 };
+static char grZe_803E1B60[0x24] = "%s:%d: couldn t get gobj(id=%d)\n";
```

## PR #2232: grzebes
Path: src/melee/gr/grzebes.c
URL: https://github.com/doldecomp/melee/pull/2232#discussion_r2913021669
Author: PsiLupan

I believe if you just do:
```
pos1 = { 24.1f, -4.6f, 0.0f };
pos2 = { 24.05f, 2.2f, 0.0f };
```

They'll be treated as const and you don't need to declare them like this at all.

Hunk:
```diff
@@ -68,27 +196,450 @@ bool grZebes_801D8550(void)
     return false;
 }
 
-/// #grZebes_801D8558
+StageCallbacks grZe_callbacks[] = {
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+    { NULL, NULL, NULL, NULL, { 0 } },
+};
+
+Ground_GObj* grZebes_801D8558(int id)
+{
+    Ground_GObj* gobj;
+    StageCallbacks* cbs = &grZe_callbacks[id];
+    gobj = Ground_801C14D0(id);
+    if (gobj != NULL) {
+        Ground* gp = GET_GROUND(gobj);
+        gp->x8_callback = NULL;
+        gp->xC_callback = NULL;
+        GObj_SetupGXLink(gobj, grDisplay_801C5DB0, 3, 0);
+        if (cbs->callback3 != NULL) {
+            gp->x1C_callback = cbs->callback3;
+        }
+        if (cbs->callback0 != NULL) {
+            cbs->callback0(gobj);
+        }
+        if (cbs->callback2 != NULL) {
+            HSD_GObjProc_8038FD54(gobj, cbs->callback2, 4);
+        }
+    } else {
+        OSReport("%s:%d: couldn t get gobj(id=%d)\n", "grzebes.c", 256, id);
+    }
+    return gobj;
+}
+
+typedef struct {
+    Vec3 x00;
+    Vec3 x04;
+    Vec3 x08;
+    Vec3 x0C;
+    Vec3 x10;
+} grZe_803B7FF0_t;
 
-/// #grZebes_801D8644
+static const grZe_803B7FF0_t grZe_803B7FF0 = {
+    { 0.0f, 0.0f, 0.0f },
+    { 8.2f, -4.55f, 0.0f },
+    { 7.59f, 2.5f, 0.0f },
+    { 8.589f, 1.215f, 0.0f },
+    { 23.151f, 1.207f, 0.0f },
+};
+
+u8 grZe_803E1B90[0xF0] = { 0 };
+
+void grZebes_801D8644(HSD_GObj* gobj)
+{
+    Ground* gp = GET_GROUND(gobj);
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    HSD_JObj* child_jobj;
+    Item_GObj* mat_gobj;
+    Item_GObj* mat_gobj2;
+    Vec3 pos;
+    UNUSED u8 _[4];
+
+    gp->gv.zebes5.xF0 = (u32) grZebes_801D8558(7);
+    Ground_801C2ED0(jobj, gp->map_id);
+    grAnime_801C8138(gobj, gp->map_id, 0);
+    child_jobj = Ground_801C3FA4(gobj, 0x1E);
+    mat_gobj = grMaterial_801C8CFC(7, 0, gp, child_jobj, NULL, fn_801DA9D8,
+                                   NULL);
+    grMaterial_801C8DE0(mat_gobj, 0.0f, -7.0f, 0.0f, 0.0f, 7.0f, 0.0f,
+                        3.0f);
+    grMaterial_801C8E08(mat_gobj);
+    gp->gv.zebes5.xC4 = 0;
+    gp->gv.zebes5.xC8 = 0xFF;
+    gp->gv.zebes5.xCC = HSD_JObjGetTranslationX(child_jobj);
+    gp->gv.zebes5.xD0 = 0.0f;
+    gp->gv.zebes5.xD4 = 0.0f;
+    gp->gv.zebes5.xD8 = 0.0f;
+    gp->gv.zebes5.xDC = (u32) child_jobj;
+    gp->gv.zebes5.xE0 = (u32) Ground_801C3FA4(gobj, 0x20);
+    gp->gv.zebes5.xE4 = (u32) (mat_gobj2 = mat_gobj);
+
+    gp->gv.zebes5.xE8 = 0x1C;
+    gp->gv.zebes5.xEC = 0;
+    gp->gv.zebes5.xF4 = 0;
+    pos = grZe_803B7FF0.x00;
+    mat_gobj2 = grMaterial_801C8D44(0, 0, gp, &pos, 0, NULL, fn_801DAC90,
+                                    NULL);
+    grMaterial_801C8E08(mat_gobj2);
+    gp->gv.zebes5.x100 = (u32) mat_gobj2;
+    grZebes_801DC9DC((s32) gobj);
+    gp->gv.zebes5.xFC = (u32) grZakoGenerator_801CA394(
+        (UNK_T) &grZe_803E1B90, 0xA, (UNK_T) grZebes_801DCB64, 1.0f);
+    mpJointSetB10(0);
+    Ground_801C2FE0((Ground_GObj*) gobj);
+}
 
 bool grZebes_801D8814(Ground_GObj* arg)
 {
     return false;
 }
 
-/// #grZebes_801D881C
+void grZebes_801D881C(HSD_GObj* gobj)
+{
+    Vec3 sp80;
+    Vec3 sp74;
+    f32 col_heights[6];
+    f32 col_x[6];
+    Vec3 sp28;
+    Vec3 sp1C;
+    f32 sp18;
+    f32 sp14;
+    Ground* gp = GET_GROUND(gobj);
+    HSD_GObj* secondary_gobj = (HSD_GObj*) gp->gv.zebes5.xF0;
+    u8 result = grZebes_801DA528(gobj, &gp->gv.zebes5.xC8, 1, 2);
+
+    if ((s32) gp->gv.zebes5.xEC != result) {
+        gp->gv.zebes5.xEC = result;
+        if (result == 1) {
+            grAnime_801C7FF8(gobj, 0x15, 1, 1, 30.0f, 1.0f);
+            grAnime_801C78FC(gobj, 0x15, 1U);
+        } else if (result == 3) {
+            grAnime_801C7FF8(gobj, 0x15, 1, 2, 0.0f, 1.0f);
+            grAnime_801C78FC(gobj, 0x15, 1U);
+        }
+    }
+
+    {
+        s16 timer = *(s16*) &gp->gv.zebes5.xF8;
+        *(s16*) &gp->gv.zebes5.xF8 = (s16) (timer - 1);
+        if (timer < 0) {
+            grZebes_801DAA08();
+            {
+                f32 base = grZe_804D6990->x08;
+                *(s16*) &gp->gv.zebes5.xF8 =
+                    (s16) ((grZe_804D6990->x0C - base) * HSD_Randf() + base);
+            }
+        }
+    }
+
+    {
+        s32 popped = grZebes_801DB3CC(gobj);
+        grZebes_801DC260();
+        grZebes_801DBB60(gp->gv.zebes5.x100);
+        grZebes_801DC408(gobj);
+
+        switch (gp->gv.zebes5.xC4) {
+        case 0:
+            if (popped != 0) {
+                gp->gv.zebes5.xC4 = 1;
+                grAnime_801C8098(gobj, 0xE, 1, 3, 0.0f, 1.0f);
+                grAnime_801C7980(gobj, 0xE, 1U);
+                grAnime_801C8098(secondary_gobj, 1, 1, 3, 0.0f, 1.0f);
+                grAnime_801C7980(secondary_gobj, 1, 1U);
+            }
+            break;
+        case 1:
+            if (grAnime_801C83D0(gobj, 0xE, 1) != 0) {
+                f32 base;
+                gp->gv.zebes5.xC4 = 2;
+                base = grZe_804D6990->x00;
+                gp->gv.zebes5.xC6 =
+                    (s16) ((grZe_804D6990->x04 - base) * HSD_Randf() + base);
+            }
+            break;
+        case 2:
+            gp->gv.zebes5.xC6 =
+                (s16) (gp->gv.zebes5.xC6 - 1);
+            if (gp->gv.zebes5.xC6 < 0) {
+                gp->gv.zebes5.xC4 = 3;
+                grAnime_801C8098(gobj, 0xE, 1, 4, 0.0f, 1.0f);
+                grAnime_801C7980(gobj, 0xE, 1U);
+                grAnime_801C8098(secondary_gobj, 1, 1, 4, 0.0f, 1.0f);
+                grAnime_801C7980(secondary_gobj, 1, 1U);
+                gp->gv.zebes5.xF6 = 0;
+                grZe_804D6994 = 0;
+            }
+            break;
+        case 3:
+        {
+            s16 eq_counter;
+            s32 divisor;
+            s32 spawn_phase;
+            gp->gv.zebes5.xF6 =
+                (s16) (gp->gv.zebes5.xF6 + 1);
+            divisor = grZe_804D6990->x10;
+            eq_counter = gp->gv.zebes5.xF6;
+            spawn_phase = eq_counter / divisor;
+            if (eq_counter % divisor == 0) {
+                s32 mirror = 6 - spawn_phase;
+                if (spawn_phase < mirror) {
+                    f32 scale_min = grZe_804D6990->x58;
+                    u8* base = (u8*) grZe_8049F140 + spawn_phase * 0x24;
+                    f32 rand = HSD_Randf();
+                    grZebes_801DAE70(
+                        spawn_phase, 4,
+                        *(f32*) (base + 0x14),
+                        *(f32*) (base + 0x18),
+                        (grZe_804D6990->x5C - scale_min) * rand + scale_min);
+                }
+                if (spawn_phase <= mirror) {
+                    u8* base2 = (u8*) grZe_8049F140 + mirror * 0x24;
+                    f32 rand2 = HSD_Randf();
+                    grZebes_801DAE70(
+                        mirror, 4,
+                        *(f32*) (base2 + 0x5C),
+                        *(f32*) (base2 + 0x60),
+                        (f32) (0.5 * rand2 + 1.0));
+                }
+            }
+            if (grAnime_801C83D0(gobj, 0xE, 1) != 0) {
+                int i;
+                gp->gv.zebes5.xC4 = 0;
+                for (i = 0; i < 20; i++) {
+                    if (grZe_8049F170[i].x00_active == 4) {
+                        grZe_8049F170[i].x00_active = 1;
+                    }
+                }
+            }
+            break;
+        }
+        }
+    }
+
+    sp80 = grZe_803B7FF0.x04;
+    sp74 = grZe_803B7FF0.x08;
+    {
+        HSD_JObj* jobj = Ground_801C3FA4(gobj, 0xE);
+        if (jobj != NULL) {
+            lb_8000B1CC(jobj, &sp80, &grZe_8049F158[0]);
+            lb_8000B1CC(jobj, &sp74, &grZe_8049F140[0]);
+        }
+    }
+
+    if (gp->gv.zebes5.xC4 == 0) {
+        int i;
+        f32 colWidth;
+        f32 left_x;
+
+        mpJointListAdd(0);
+        mpLib_80057424(0);
+
+        colWidth = (grZe_8049F140[1].x - grZe_8049F140[0].x) / 5.0f;
+        left_x = grZe_8049F140[0].x;
+
+        col_heights[0] = -9999.0f;
+        col_heights[1] = -9999.0f;
+        col_heights[2] = -9999.0f;
+        col_heights[3] = -9999.0f;
+        col_heights[4] = -9999.0f;
+        col_heights[5] = -9999.0f;
+
+        {
+            int j;
+            grZe_BubbleEntry* entry = grZe_8049F170;
+            for (j = 0; j < 20; j++, entry++) {
+                if (entry->x00_active == 1) {
+                    f32 dx = entry->x08_x - left_x;
+                    f32 top = (f32) (1.8 * (f64) entry->x18_size +
+                                     (f64) entry->x0C_y);
+                    {
+                        f32 left_frac =
+                            (f32) ((f64) dx - 0.9) / colWidth;
+                        s32 col_left =
+                            (s32) (0.5 + (f64) left_frac);
+                        if (col_left > 5) {
+                            col_left = 5;
+                        } else if (col_left < 0) {
+                            col_left = 0;
+                        }
+                        col_x[col_left] =
+                            (f32) col_left * colWidth + left_x;
+                        if (top > col_heights[col_left]) {
+                            col_heights[col_left] = top;
+                        }
+                    }
+                    {
+                        f32 right_frac =
+                            (f32) (0.9 + (f64) dx) / colWidth;
+                        s32 col_right =
+                            (s32) (0.5 + (f64) right_frac);
+                        if (col_right > 5) {
+                            col_right = 5;
+                        } else if (col_right < 0) {
+                            col_right = 0;
+                        }
+                        col_x[col_right] =
+                            (f32) col_right * colWidth + left_x;
+                        if (top > col_heights[col_right]) {
+                            col_heights[col_right] = top;
+                        }
+                    }
+                }
+            }
+        }
+
+        sp28 = grZe_803B7FF0.x0C;
+        sp1C = grZe_803B7FF0.x10;
+
+        {
+            HSD_JObj* sima_jobj;
+            sima_jobj = Ground_801C3FA4(gobj, 0xE);
+            HSD_ASSERT(0x293, sima_jobj);
+            lb_8000B1CC(sima_jobj, &sp28, &sp28);
+        }
+        col_x[0] = sp28.x;
+        col_heights[0] = sp28.y;
+
+        {
+            HSD_JObj* sima_jobj;
+            sima_jobj = Ground_801C3FA4(secondary_gobj, 1);
+            HSD_ASSERT(0x299, sima_jobj);
+            lb_8000B1CC(sima_jobj, &sp1C, &sp1C);
+        }
+        col_x[5] = sp1C.x;
+        col_heights[5] = sp1C.y;
+
+        for (i = 0; i < 5; i++) {
+            if (i != 0) {
+                f32 limit = col_heights[i + 1] - colWidth;
+                if (col_heights[i] < limit) {
+                    col_heights[i] = limit;
+                }
+            }
+            if (i != 5) {
+                f32 limit = col_heights[i] - colWidth;
+                if (col_heights[i + 1] < limit) {
+                    col_heights[i + 1] = limit;
+                }
+            }
+        }
+
+        {
+            int k;
+            for (k = 0; k <= 5; k++) {
+                mpVtxSetPos(k, col_x[k], col_heights[k]);
+            }
+        }
+        mpLib_80055E24(0);
+    } else {
+        mpLib_80057BC0(0);
+    }
+
+    Ground_801C4368(&sp18, &sp14);
+    grZakoGenerator_801CA43C((void*) gp->gv.zebes5.xFC,
+                             Ground_801C3FA4(gobj, 0xE), sp18);
+    Ground_801C2FE0((Ground_GObj*) gobj);
+    lb_800115F4();
+}
 
 void grZebes_801D90FC(Ground_GObj* arg) {}
 
-/// #grZebes_801D9100
+u8 grZe_803E1C80[0x6C] = { 0 };
+
+void grZebes_801D9100(HSD_GObj* gobj)
+{
+    // This is VERY MUCH permuterslop
+    // but 100% is 100%
+    Item_GObj *new_var3;
+    HSD_JObj* child_jobj;
+    Ground* gp = GET_GROUND(gobj);
+    int new_var;
+    HSD_JObj* jobj = GET_JOBJ(gobj);
+    Item_GObj* mat_gobj;
+    Ground_GObj *new_var2;
+
+    grAnime_801C8138(gobj, gp->map_id, 0);
+    Ground_801C2ED0(jobj, gp->map_id);
+    mat_gobj = gobj;
+    new_var3 = mat_gobj;
+    child_jobj = Ground_801C3FA4(new_var3, 0xF);
+
+    mat_gobj = grMaterial_801C8CFC(7, 0, gp, child_jobj, NULL, fn_801DA9F0,
+                                   NULL);
+    grMaterial_801C8DE0(mat_gobj, 0.0f, -5.0f, 0.0f, 0.0f, 5.0f, 0.0f,
+                        2.0f);
+    new_var2 = (Ground_GObj *) gobj;
+    grMaterial_801C8E08(mat_gobj);
+    gp->gv.zebes4.xC4 = 0xFF;
+    gp->gv.zebes4.xC5 = 0;
+    gp->gv.zebes4.xC6 = 0;
+    gp->gv.zebes4.xC8 = HSD_JObjGetTranslationX(child_jobj);
+    gp->gv.zebes4.xCC = 0.0f;
+    gp->gv.zebes4.xD0 = 0.0f;
+    gp->gv.zebes4.xD4 = 0.0f;
+    gp->gv.zebes4.xD8 = (u32) child_jobj;
+    new_var = 0xD;
+    gp->gv.zebes4.xDC = (u32) Ground_801C3FA4(gobj, 0x11);
+    gp->gv.zebes4.xE0 = (u32) mat_gobj;
+    gp->gv.zebes4.xE4 = new_var;
+    gp->gv.zebes4.xE8 = 0;
+    gp->gv.zebes4.xEC =
+        (u32) grZakoGenerator_801CA394((void*) &grZe_803E1C80, 4,
+                                       (void*) grZebes_801DCBB0, 1.0f);
+    Ground_801C2FE0(new_var2);
+}
 
 bool grZebes_801D9254(Ground_GObj* arg)
 {
     return false;
 }
 
-/// #grZebes_801D925C
+static const Vec3 grZe_803B802C = { 24.1f, -4.6f, 0.0f };
+static const Vec3 grZe_803B8038 = { 24.05f, 2.2f, 0.0f };
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900123360
Author: PsiLupan

What's up with the empty pragma range that does nothing?

Hunk:
```diff
@@ -415,11 +449,14 @@ s32 ftCo_800D7268(Fighter* fp)
     return 0;
 }
 
-/// #ftCo_800D72A0
 
-/// #ftCo_800D730C
+#pragma push
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900127632
Author: stephenjayakar

Ok, just learned what those meant. Yeah, those are empty. RMing

Hunk:
```diff
@@ -415,11 +449,14 @@ s32 ftCo_800D7268(Fighter* fp)
     return 0;
 }
 
-/// #ftCo_800D72A0
 
-/// #ftCo_800D730C
+#pragma push
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900158500
Author: PsiLupan

Think this pop is by itself? I don't see an associated push, just glancing at the changed.

Hunk:
```diff
@@ -1485,16 +2290,19 @@ void fn_800DC404(Fighter_GObj* gobj)
     fn_800DB5D8(gobj);
     fn_800DAA40(gobj, fp->victim_gobj);
 }
-#pragma pop
-
 void ftCo_CaptureDamageLw_Anim(Fighter_GObj* gobj)
 {
     fn_800DB8A4(gobj);
     if (!ftAnim_IsFramesRemaining(gobj)) {
         fn_800DBAE4(gobj);
     }
 }
+#pragma pop
+
+#pragma pop
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900159732
Author: stephenjayakar

good catch

Hunk:
```diff
@@ -1485,16 +2290,19 @@ void fn_800DC404(Fighter_GObj* gobj)
     fn_800DB5D8(gobj);
     fn_800DAA40(gobj, fp->victim_gobj);
 }
-#pragma pop
-
 void ftCo_CaptureDamageLw_Anim(Fighter_GObj* gobj)
 {
     fn_800DB8A4(gobj);
     if (!ftAnim_IsFramesRemaining(gobj)) {
         fn_800DBAE4(gobj);
     }
 }
+#pragma pop
+
+#pragma pop
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900252841
Author: PsiLupan

There's no `#pragma pop` after this.

Hunk:
```diff
@@ -1485,16 +2290,17 @@ void fn_800DC404(Fighter_GObj* gobj)
     fn_800DB5D8(gobj);
     fn_800DAA40(gobj, fp->victim_gobj);
 }
-#pragma pop
-
 void ftCo_CaptureDamageLw_Anim(Fighter_GObj* gobj)
 {
     fn_800DB8A4(gobj);
     if (!ftAnim_IsFramesRemaining(gobj)) {
         fn_800DBAE4(gobj);
     }
 }
+#pragma pop
 
+#pragma push
+#pragma dont_inline on
```

## PR #2231: ftCo_Attack100 matches
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2231#discussion_r2900283518
Author: PsiLupan

Let's just not do inline assembly. It was common practice when we needed entire files pre-objdiff, but really isn't necessary now outside of SDK.

Hunk:
```diff
@@ -2303,34 +2303,234 @@ void ftCo_CaptureDamageLw_Anim(Fighter_GObj* gobj)
 #pragma dont_inline on
 void ftCo_CaptureDamageLw_IASA(Fighter_GObj* gobj) {}
 
-static inline void ftCo_CaptureDamageLw_Phys_inline(Fighter_GObj* gobj)
+#ifdef MWERKS_GEKKO
+
+asm void ftCo_CaptureDamageLw_Phys(Fighter_GObj* gobj)
```

## PR #2217: Match ~100 functions
Path: src/melee/vi/vi0401.c
URL: https://github.com/doldecomp/melee/pull/2217#discussion_r2888021429
Author: PsiLupan

This is just wrong. It's sbss, not sdata.

Hunk:
```diff
@@ -38,12 +38,12 @@ static SceneDesc* un_804D6F50;
 static HSD_Archive* un_804D6F54;
 static HSD_JObj* un_804D6F58;
 static GXColor erase_colors_vi0401;
-static ViCharaDesc un_804D6F60;
+SDATA static ViCharaDesc un_804D6F60;
```

## PR #2217: Match ~100 functions
Path: src/melee/vi/vi0501.c
URL: https://github.com/doldecomp/melee/pull/2217#discussion_r2888025197
Author: PsiLupan

Same as the other. This is sbss, not sdata.

Hunk:
```diff
@@ -32,17 +32,15 @@ static HSD_Archive* un_804D6F74;
 static HSD_Archive* un_804D6F78;
 static GXColor erase_colors_vi0501;
 static float un_804D6F80;
-static ViCharaDesc un_804D6F84;
+SDATA static ViCharaDesc un_804D6F84;
```

## PR #2217: Match ~100 functions
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2217#discussion_r2889680798
Author: ribbanya

This kind of pointer arithmetic is slop. If it matches, then fine, but it's going to need to be cleaned up eventually by someone. If you can have Claude output `M2C_FIELD` that would be preferred. Ideally the proper fields of the struct (in this case `Fighter`) would be used, or created if they don't exist.

In this case, these are just callback fields (`death2_cb` etc.) so I'm not sure why it didn't opt to just use those. Are you running the functions through m2c before passing them to an LLM?

Hunk:
```diff
@@ -909,7 +909,19 @@ bool fn_800D952C(Fighter_GObj* gobj)
 
 /// #fn_800D9C64
 
-/// #ftCo_800D9C98
+void ftCo_800D9C98(Fighter_GObj* gobj)
+{
+    Fighter* fp = GET_FIGHTER(gobj);
+
+    if (fp->fv.ss.x223C != NULL) {
+        it_802B7B84(fp->fv.ss.x223C);
+        fp->fv.ss.x223C = NULL;
+    }
+
+    *(s32*)((u8*)fp + 0x21E4) = 0;
+    *(s32*)((u8*)fp + 0x21F0) = 0;
+    *(s32*)((u8*)fp + 0x21DC) = 0;
```

## PR #2217: Match ~100 functions
Path: src/melee/gr/grpushon.c
URL: https://github.com/doldecomp/melee/pull/2217#discussion_r2889693866
Author: ribbanya

```suggestion
/// #grPushOn_802183E4
```

Hunk:
```diff
@@ -46,7 +60,10 @@ bool grPushOn_802183DC(void)
     return false;
 }
 
-/// #grPushOn_802183E4
+void grPushOn_802183E4(int arg)
+{
+    NOT_IMPLEMENTED;
+}
```

## PR #2217: Match ~100 functions
Path: src/melee/ft/chara/ftCommon/ftCo_Attack100.c
URL: https://github.com/doldecomp/melee/pull/2217#discussion_r2893247175
Author: dwilliams27

Gotcha. Yeah the agents have m2c available, but realizing I did not force it to start there. Will ensure that is forced as first step in flow, and add in logic on the verifier to reject common slop patterns (raw offset pointer arithmetic, NOT_IMPLEMENTED stubs, and C99 loop-variable declarations) before accepting writes.

Appreciate this feedback! Will hop into the discord and try and also integrate other ideas I see in there to avoid generating more low quality work. Thanks for the review

Hunk:
```diff
@@ -909,7 +909,19 @@ bool fn_800D952C(Fighter_GObj* gobj)
 
 /// #fn_800D9C64
 
-/// #ftCo_800D9C98
+void ftCo_800D9C98(Fighter_GObj* gobj)
+{
+    Fighter* fp = GET_FIGHTER(gobj);
+
+    if (fp->fv.ss.x223C != NULL) {
+        it_802B7B84(fp->fv.ss.x223C);
+        fp->fv.ss.x223C = NULL;
+    }
+
+    *(s32*)((u8*)fp + 0x21E4) = 0;
+    *(s32*)((u8*)fp + 0x21F0) = 0;
+    *(s32*)((u8*)fp + 0x21DC) = 0;
```

## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869356886
Author: ribbanya

Does this pattern meaningfully fix the stack? Not sure how to feel about it. Fighters do this as well but we didn't define macros for it.

We've played with the idea of passing in the attribute type to a generic macro, like `GET_ATTRS(ip, itBombHeiAttributes)`, but didn't end up implementing it.

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```

## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869406510
Author: jurrejelle

I just copied it over from itlikelike, I wasn't aware it wasn't a "Standard" thing we did. I used it and it mostly helped, especially in cases where there's no between-var for it (like `GET_ATTRS(ip)->0x4` vs `((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)->0x4`). I did have to break it a few times for permuter reasons to get 100% (like break out article data for example), but I'd say it makes the code more readable / helps personally

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```

## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869424116
Author: ribbanya

> I did have to break it a few times for permuter reasons to get 100% (like break out article data for example)

I think if it's not consistent it should be avoided. Needs further investigation, but in the meantime, using it or not doesn't matter much.

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```
