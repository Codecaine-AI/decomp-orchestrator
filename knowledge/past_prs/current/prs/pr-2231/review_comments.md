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
