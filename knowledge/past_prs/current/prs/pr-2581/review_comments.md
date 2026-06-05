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
