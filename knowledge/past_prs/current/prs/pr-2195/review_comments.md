## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869356886
Author: ribbanya

Does this pattern meaningfully fix the stack? Not sure how to feel about it. Fighters do this as well but we didn't define macros for it.

We've played with the idea of passing in the attribute type to a generic macro, like `GET_ATTRS(ip, itBombHeiAttributes)`, but didn't end up implementing it.

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```

## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869406510
Author: jurrejelle

I just copied it over from itlikelike, I wasn't aware it wasn't a "Standard" thing we did. I used it and it mostly helped, especially in cases where there's no between-var for it (like `GET_ATTRS(ip)->0x4` vs `((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)->0x4`). I did have to break it a few times for permuter reasons to get 100% (like break out article data for example), but I'd say it makes the code more readable / helps personally

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```

## PR #2195: itbombhei
Path: src/melee/it/items/itbombhei.c
URL: https://github.com/doldecomp/melee/pull/2195#discussion_r2869424116
Author: ribbanya

> I did have to break it a few times for permuter reasons to get 100% (like break out article data for example)

I think if it's not consistent it should be avoided. Needs further investigation, but in the meantime, using it or not doesn't matter much.

Hunk:
```diff
@@ -1,19 +1,29 @@
 #include "itbombhei.h"
 
 #include "itbombhei.static.h"
+
+#include "math.h"
+
 #include <placeholder.h>
 #include <platform.h>
 
 #include "baselib/forward.h"
 
 #include "baselib/gobj.h"
 #include "baselib/jobj.h"
+
+#include "it/forward.h"
+
 #include "it/inlines.h"
 #include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
 #include "it/itCommonItems.h"
 #include "it/item.h"
+#include "lb/lb_00F9.h"
+
+#define GET_ATTRS(ip)                                                         \
+    ((itBombHeiAttributes*) ip->xC4_article_data->x4_specialAttributes)
```
