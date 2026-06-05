## PR #2510: Match `mnEvent_8024CE74`
Path: src/melee/mn/mnnamenew.c
URL: https://github.com/doldecomp/melee/pull/2510#discussion_r3254910800
Author: ribbanya

This is slop. At best, it prematurely fixes sdata.

Hunk:
```diff
@@ -1,6 +1,15 @@
 #include "mnnamenew.h"
 
 #include "baselib/debug.h"
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0)                                                      \
+            : __assert(mnNameNew_804D4F84, line, mnNameNew_804D4F8C))
+#include "sysdolphin/baselib/jobj.h"
+#undef HSD_ASSERT
+#define HSD_ASSERT(line, cond)                                                \
+    ((cond) ? ((void) 0) : __assert(__FILE__, line, #cond))
```

## PR #2510: Match `mnEvent_8024CE74`
Path: src/melee/mn/mnnamenew.h
URL: https://github.com/doldecomp/melee/pull/2510#discussion_r3254912236
Author: ribbanya

These are static literals and don't need to be declared anywhere.

Hunk:
```diff
@@ -7,6 +7,9 @@
 
 #include <baselib/forward.h>
 
+extern char mnNameNew_804D4F84[7];
+extern char mnNameNew_804D4F8C[5];
```
