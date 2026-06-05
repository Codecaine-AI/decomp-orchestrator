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
