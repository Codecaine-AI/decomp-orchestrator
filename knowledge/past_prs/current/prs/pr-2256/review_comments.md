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
