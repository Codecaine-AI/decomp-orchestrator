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
