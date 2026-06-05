## PR #2460: various item work
Path: src/melee/it/items/itsamusgrapple.c
URL: https://github.com/doldecomp/melee/pull/2460#discussion_r3191396695
Author: PsiLupan

Can you give things meaningful names instead of leaving them as "new_var" etc.? I think that's my main complaint about most of this PR.

Even just "pos_copy" is better than "new_var," and it saves having to do this cleanup later.

Hunk:
```diff
@@ -1449,7 +1451,8 @@ void it_802BA5DC(ItemLink* tail, ItemLink* head, Vec3* pos,
     ItemLink* next;
     ItemLink* cur;
     bool retracted;
-    PAD_STACK(12);
+    Vec3* new_var;
```

## PR #2460: various item work
Path: src/melee/it/items/itsamusgrapple.c
URL: https://github.com/doldecomp/melee/pull/2460#discussion_r3191433462
Author: lukechampine

fair, a lot of this is permuterslop. I'll give it a cleanup pass.

Hunk:
```diff
@@ -1449,7 +1451,8 @@ void it_802BA5DC(ItemLink* tail, ItemLink* head, Vec3* pos,
     ItemLink* next;
     ItemLink* cur;
     bool retracted;
-    PAD_STACK(12);
+    Vec3* new_var;
```
