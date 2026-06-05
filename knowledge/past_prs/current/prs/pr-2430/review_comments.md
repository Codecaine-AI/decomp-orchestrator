## PR #2430: All item TUs > 80% fuzzy match
Path: src/melee/it/itCharItems.h
URL: https://github.com/doldecomp/melee/pull/2430#discussion_r3126418397
Author: jellejurre

Are these comments made up by a human or by AI?

Hunk:
```diff
@@ -897,22 +900,22 @@ typedef struct itTools_ItemVars {
     /* +0 ip+DD4 */ s32 x0;
 } itTools_ItemVars;
 
-typedef struct itToolsAttrEntry {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ f32 x10;
-    /* +14 */ f32 x14;
-    /* +18 */ f32 x18;
-} itToolsAttrEntry;
+typedef struct itToolsMotionAttrs {
+    /* +00 */ f32 x0;  // initial vel.y for the motion
+    /* +04 */ f32 x4;  // fall speed
+    /* +08 */ f32 x8;  // fall speed max
+    /* +0C */ f32 xC;  // rotation delta (per frame)
+    /* +10 */ f32 x10; // post-hit vel.y
+    /* +14 */ f32 x14; // vel threshold for damage
+    /* +18 */ f32 x18; // knockback scale
+} itToolsMotionAttrs;
 
 typedef struct itToolsAttributes {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ itToolsAttrEntry entries[1];
+    /* +00 */ f32 x0;                    // lifetime
+    /* +04 */ f32 x4;                    // knockback timer base
+    /* +08 */ f32 x8;                    // damage multiplier
+    /* +0C */ s32 xC;                    // damage cap
+    /* +10 */ itToolsMotionAttrs motions[1];
 } itToolsAttributes;
```

## PR #2430: All item TUs > 80% fuzzy match
Path: src/melee/it/itCharItems.h
URL: https://github.com/doldecomp/melee/pull/2430#discussion_r3126449237
Author: lukechampine

good catch, definitely AI guesswork that should not be taken as authoritative

Hunk:
```diff
@@ -897,22 +900,22 @@ typedef struct itTools_ItemVars {
     /* +0 ip+DD4 */ s32 x0;
 } itTools_ItemVars;
 
-typedef struct itToolsAttrEntry {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ f32 x10;
-    /* +14 */ f32 x14;
-    /* +18 */ f32 x18;
-} itToolsAttrEntry;
+typedef struct itToolsMotionAttrs {
+    /* +00 */ f32 x0;  // initial vel.y for the motion
+    /* +04 */ f32 x4;  // fall speed
+    /* +08 */ f32 x8;  // fall speed max
+    /* +0C */ f32 xC;  // rotation delta (per frame)
+    /* +10 */ f32 x10; // post-hit vel.y
+    /* +14 */ f32 x14; // vel threshold for damage
+    /* +18 */ f32 x18; // knockback scale
+} itToolsMotionAttrs;
 
 typedef struct itToolsAttributes {
-    /* +0 */ f32 x0;
-    /* +4 */ f32 x4;
-    /* +8 */ f32 x8;
-    /* +C */ f32 xC;
-    /* +10 */ itToolsAttrEntry entries[1];
+    /* +00 */ f32 x0;                    // lifetime
+    /* +04 */ f32 x4;                    // knockback timer base
+    /* +08 */ f32 x8;                    // damage multiplier
+    /* +0C */ s32 xC;                    // damage cap
+    /* +10 */ itToolsMotionAttrs motions[1];
 } itToolsAttributes;
```
