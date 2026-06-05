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
