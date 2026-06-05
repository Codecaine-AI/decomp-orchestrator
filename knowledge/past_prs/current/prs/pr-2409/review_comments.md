## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itdosei.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071310664
Author: PsiLupan

This should be
`#include <baseline/gobj.h>`

Hunk:
```diff
@@ -3,6 +3,8 @@
 #include <placeholder.h>
 #include <platform.h>
 
+#include "baselib/gobj.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itdosei.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071313739
Author: PsiLupan

Is there a reason not to do it now?

Hunk:
```diff
@@ -11,37 +13,129 @@
 #include "lb/lb_00B0.h"
 
 #include <math.h>
+#include <baselib/jobj.h>
 #include <baselib/random.h>
 
+f32 it_804DC878 = 0.0f; // TODO: needs to be in .sdata2
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itkirby_2F23.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071328397
Author: PsiLupan

Same as prior comment regarding include for gobj.

Hunk:
```diff
@@ -3,20 +3,61 @@
 #include <placeholder.h>
 #include <platform.h>
 
+#include "baselib/gobj.h"
 #include "ft/chara/ftKirby/ftKb_Init.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itlipstickspore.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071341073
Author: PsiLupan

Assuming this is MSL/math.h

Should be `#include <MSL/math.h>`

Hunk:
```diff
@@ -1,38 +1,128 @@
 #include "itlipstickspore.h"
 
+#include "math.h"
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itpikachutjoltair.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071351505
Author: PsiLupan

Explicit `#include <MSL/math.h>`

Hunk:
```diff
@@ -11,6 +11,10 @@
 #include "it/items/itpikachutjoltground.h"
 #include "lb/lb_00B0.h"
 
+#include <math.h>
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itseakneedlethrown.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071354118
Author: PsiLupan

Same as prior comment.

Hunk:
```diff
@@ -1,30 +1,73 @@
 #include "itseakneedlethrown.h"
 
+#include "placeholder.h"
+
+#include "db/db.h"
+#include "ft/ftlib.h"
+
 #include "it/forward.h"
 
 #include "it/inlines.h"
+#include "it/it_266F.h"
 #include "it/it_26B1.h"
 #include "it/it_2725.h"
+#include "it/item.h"
+#include "lb/lbvector.h"
+#include "mp/mpcoll.h"
+#include "mp/mplib.h"
 
+#include <math.h>
```

## PR #2409: >50% fuzzy match on all remaining item TUs
Path: src/melee/it/items/itunknown.c
URL: https://github.com/doldecomp/melee/pull/2409#discussion_r3071356791
Author: PsiLupan

Fix the include style as seen in previous comment.

Hunk:
```diff
@@ -1,23 +1,31 @@
 #include "itunknown.h"
 
+#include "math.h"
```
