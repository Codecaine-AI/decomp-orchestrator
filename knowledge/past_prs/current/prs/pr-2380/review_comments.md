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
