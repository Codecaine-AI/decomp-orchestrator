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
