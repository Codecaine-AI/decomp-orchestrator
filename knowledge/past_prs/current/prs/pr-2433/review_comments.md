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
