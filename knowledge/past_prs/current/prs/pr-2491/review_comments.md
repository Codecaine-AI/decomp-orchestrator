## PR #2491: gr: match grheal
Path: src/melee/gr/grheal.c
URL: https://github.com/doldecomp/melee/pull/2491#discussion_r3245710199
Author: itsgrimetime

ah actually I missed this - will try to massage this into a direct string reference

Hunk:
```diff
@@ -307,25 +364,42 @@ void grHeal_8021F708(Ground_GObj* gobj) {}
 
 u32 grHeal_8021F70C(u32 character_id)
 {
+    s32* base;
     s32* entry;
+    s32 value;
     int frame;
 
+    base = grHeal_803E83B8;
     frame = 0;
-    if ((s32) character_id == 0x13) {
-        character_id = 0x12;
-    }
 
-    entry = (s32*) &grHeal_803E851C[0xD];
+    if ((s32) character_id != 0x13) {
+        goto loop_start;
+    }
+    character_id = 0x12;
+    goto loop_start;
 
-    while (entry[frame] != -1 && entry[frame] != character_id) {
-        frame++;
+loop_compare:
+    if ((s32) character_id == value) {
+        goto loop_done;
+    }
+    entry++;
+    frame++;
+loop_check:
+    value = *entry;
+    if (value != -1) {
+        goto loop_compare;
     }
 
-    if (grHeal_803E83B8[frame] == -1) {
-        OSReport("*** Not found Next Player!(%d)\n", frame);
+loop_done:
+    if (base[frame + 0xD] == -1) {
+        OSReport((char*) base + 0x170, character_id);
```
