## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364260479
Author: jurrejelle

can this use an existing GET_GROUND()?

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```

## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364264661
Author: itsgrimetime

ooh maybe lemme check

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```

## PR #2582: Match and improve several source functions
Path: src/melee/gr/gricemt.c
URL: https://github.com/doldecomp/melee/pull/2582#discussion_r3364305678
Author: itsgrimetime

Fixed in the latest push: removed the local user_data helper and switched the call sites in grIceMt_801F9ACC to GET_GROUND().

Hunk:
```diff
@@ -1456,8 +1456,13 @@ static inline HSD_GObj* grIceMt_801F71E8_noinline2(int id)
     return grIceMt_801F71E8_inner2(id);
 }
 
-void grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,
-                      Ground_GObj* arg3)
+static inline void* grIceMt_GetUserData(HSD_GObj* gobj)
```
