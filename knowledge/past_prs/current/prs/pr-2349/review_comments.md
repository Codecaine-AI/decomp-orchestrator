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
