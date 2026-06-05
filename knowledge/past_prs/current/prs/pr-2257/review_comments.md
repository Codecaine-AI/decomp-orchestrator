## PR #2257: tydisplay: match 3 functions
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2257#discussion_r2912545147
Author: PsiLupan

`continue;`

Hunk:
```diff
@@ -118,7 +196,56 @@ s32 tyDisplay_8031C2EC(void)
     return un_80305058(2, 0, 1, 60.0f);
 }
 
-/// #un_8031C354
+s32 un_8031C354(s32 id, s32 (*buf)[], s32 max, s32 kind)
+{
+    void* data;
+    void* other;
+    s32 i;
+    s32 count;
+    s32 val;
+
+    PAD_STACK(8);
+
+    if (id == -1) {
+        return 0;
+    }
+
+    data = un_8031B9DC(id);
+
+    if (kind == 99) {
+        kind = (s32) un_803060BC(id, 6);
+    }
+
+    count = 0;
+    for (i = 0; i < 0x125; i++) {
+        if (i == id) {
+            goto next;
```
