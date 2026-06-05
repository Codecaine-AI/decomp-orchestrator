## PR #2466: resplit, match, and link ftPp_SpecialS.c
Path: src/melee/ft/chara/ftPopo/ftPp_SpecialHi.c
URL: https://github.com/doldecomp/melee/pull/2466#discussion_r3205218907
Author: lukechampine

please forgive this hideous hack. If there's a better way to align the floats, I'm all ears!

Hunk:
```diff
@@ -0,0 +1,932 @@
+
+
+#include "ft/chara/ftPopo/ftPp_SpecialHi.h"
+
+#include "ft/chara/ftCommon/ftCo_FallSpecial.h"
+#include "ft/chara/ftCommon/ftCo_Landing.h"
+#include "ft/chara/ftPopo/ftPp_SpecialS.h"
+#include "ft/fighter.h"
+#include "ft/ft_081B.h"
+#include "ft/ft_0892.h"
+#include "ft/ftcliffcommon.h"
+#include "ft/ftcommon.h"
+#include "ft/ftparts.h"
+#include "ftNana/ftNn_Init.h"
+#include "ftPopo/ftPp_Init.h"
+#include "it/items/itclimbersstring.h"
+#include "it/types.h"
+#include "lb/lb_00B0.h"
+#include "lb/lbvector.h"
+#include "pl/player.h"
+
+#include <math.h>
+#include <trigf.h>
+
+static float sdata2_ordering(void)
+{
+    float data_0 = 0.0f;
+    double data_1 = 0.5;
+    double data_2 = 3.0;
+    float data_3 = 3.0f;
+    float data_4 = 5.0f;
+    float data_5 = 1.0f;
+    float data_6 = -1.0f;
+    double data_7 = 0.5;
+    return data_7 + data_6 + data_5 + data_4 + data_3 + data_2 + data_1 +
+           data_0;
+}
```
