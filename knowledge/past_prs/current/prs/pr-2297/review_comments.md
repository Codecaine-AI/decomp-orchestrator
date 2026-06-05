## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954419745
Author: PsiLupan

Mind fixing this to use `HSD_ASSERT`?

I'm guessing the string there is just condition `0`

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954424048
Author: PsiLupan

Same as prior comment regarding `HSD_ASSERT`

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
+    }
 
-/// #un_80318CB4
+    gobj = ptr->gobj0;
+    if ((ptr->gobj4 && ptr->gobj4) && gobj4) {
+    }
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj0 = NULL;
+    }
 
-/// #un_80319540
+    gobj = ptr->gobj4;
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj4 = NULL;
+    }
 
-/// #un_80319994
+    joint = HSD_ArchiveGetPublicAddress(ptr->archive, "ToyDspBg_Top_joint");
+    if (joint != NULL) {
+        ptr->gobj4 = GObj_Create(9, 9, zero);
+        jobj = HSD_JObjLoadJoint(joint);
+        HSD_GObjObject_80390A70(ptr->gobj4, temp = HSD_GObj_804D7849, jobj);
+        GObj_SetupGXLink(ptr->gobj4, HSD_GObj_JObjCallback, 0x3C, zero);
+        lb_8001204C(jobj, &ptr->jobj, &un_804D5ABC, 1);
+        return;
+    }
+
+    OSReport("*** Can not Load Panel Label(%s)\n", "ToyDspBg_Top_joint");
+    __assert("tydisplay.c", 0x43E, un_804D5AA8);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954432775
Author: PsiLupan

Since this is an OSPanic:

Replace the filename with `__FILE__` and declare the actual string, please. It makes matching and linking the file later easier.

Hunk:
```diff
@@ -25,31 +149,1590 @@ void un_803182D4_OnFrame(void)
     }
 }
 
-/// #un_8031830C
+inline void quicksort(TySortElem* base, s32 lo, s32 hi)
+{
+    TySortElem tmp;
+    PAD_STACK(16);
+
+    if (lo < hi) {
+        s32 mid = (lo + hi) / 2;
+        s32 pivot, i;
+
+        if (lo != mid) {
+            tmp = base[lo];
+            base[lo] = base[mid];
+            base[mid] = tmp;
+        }
+
+        pivot = lo;
+        for (i = lo + 1; i <= hi; i++) {
+            if (base[i].val < base[lo].val) {
+                pivot++;
+                if (pivot != i) {
+                    tmp = base[pivot];
+                    base[pivot] = base[i];
+                    base[i] = tmp;
+                }
+            }
+        }
+
+        if (lo != pivot) {
+            tmp = base[lo];
+            base[lo] = base[pivot];
+            base[pivot] = tmp;
+        }
+
+        if (lo < pivot - 1) {
+            s32 mid2 = (pivot + lo - 1) / 2;
+            s32 pivot2;
+
+            if (lo != mid2) {
+                tmp = base[lo];
+                base[lo] = base[mid2];
+                base[mid2] = tmp;
+            }
+
+            pivot2 = lo;
+            for (i = lo + 1; i <= pivot - 1; i++) {
+                if (base[i].val < base[lo].val) {
+                    pivot2++;
+                    if (pivot2 != i) {
+                        tmp = base[pivot2];
+                        base[pivot2] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (lo != pivot2) {
+                tmp = base[lo];
+                base[lo] = base[pivot2];
+                base[pivot2] = tmp;
+            }
+
+            un_8031830C(base, lo, pivot2 - 1);
+            un_8031830C(base, pivot2 + 1, pivot - 1);
+        }
+
+        if (pivot + 1 < hi) {
+            s32 mid3 = (pivot + hi + 1) / 2;
+            s32 pivot3;
+
+            if (pivot + 1 != mid3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[mid3];
+                base[mid3] = tmp;
+            }
+
+            pivot3 = pivot + 1;
+            for (i = pivot + 2; i <= hi; i++) {
+                if (base[i].val < base[pivot + 1].val) {
+                    pivot3++;
+                    if (pivot3 != i) {
+                        tmp = base[pivot3];
+                        base[pivot3] = base[i];
+                        base[i] = tmp;
+                    }
+                }
+            }
+
+            if (pivot + 1 != pivot3) {
+                tmp = base[pivot + 1];
+                base[pivot + 1] = base[pivot3];
+                base[pivot3] = tmp;
+            }
+
+            un_8031830C(base, pivot + 1, pivot3 - 1);
+            un_8031830C(base, pivot3 + 1, hi);
+        }
+    }
+}
+
+void un_8031830C(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+void un_80318714(TySortElem* base, s32 lo, s32 hi)
+{
+    quicksort(base, lo, hi);
+}
+
+extern TyDspGrid* un_804D6F14;
+extern HSD_JObj** un_804D6F10;
+
+void un_80318B1C(s32 arg0)
+{
+    s32 i;
+    s32 start;
+    s32 placed;
+    TyDspGrid* grid = un_804D6F14;
+    s32 rand_id;
+    TyDspEntry* check;
+    s32 rand_result;
+
+    if (arg0 > 1) {
+        rand_result = HSD_Randi(arg0 - 1);
+    } else {
+        rand_result = 0;
+    }
+    start = rand_result;
+
+    if (arg0 > 0x125) {
+        placed = 0;
+        i = 0;
+        while (placed < arg0) {
+            if (i >= 0x125) {
+                rand_id = HSD_Randi(0x124);
+                check = un_8031B9DC(rand_id);
+                while (check->x00 == -1) {
+                    rand_id = HSD_Randi(0x124);
+                    check = un_8031B9DC(rand_id);
+                }
+                grid->sort[start].key = rand_id;
+                grid->sort[start].val =
+                    (s32) un_803060BC(grid->sort[start].key, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+                placed++;
+            } else {
+                check = un_8031B9DC(i);
+                if (check->x00 != -1) {
+                    grid->sort[start].key = i;
+                    grid->sort[start].val = (s32) un_803060BC(i, 7);
+                    start++;
+                    if (start >= arg0) {
+                        start = 0;
+                    }
+                    placed++;
+                }
+            }
+            i++;
+        }
+    } else {
+        i = 0;
+        do {
+            if (un_803048C0(i) != 0) {
+                un_8031B9DC(i);
+                grid->sort[start].key = i;
+                grid->sort[start].val = (s32) un_803060BC(i, 7);
+                start++;
+                if (start >= arg0) {
+                    start = 0;
+                }
+            }
+            i++;
+        } while (i < 0x125);
+    }
+}
+void un_80318CB4(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_JObj** jobjArr;
+    s32 prev_ring_size;
+    s32 ring_count = 0;
+    s32 ring_max = 6;
+    f32 angle = 0.0f;
+    f32 radius;
+    f32 base_step;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 n;
+
+    PAD_STACK(0x50);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    if (arg0 != 0) {
+        base_step = 9.0f;
+    } else {
+        base_step = 11.0f;
+    }
+    radius = base_step;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[0].x = 0.0f;
+            grid->pos[0].z = 0.0f;
+        } else {
+            f32 rad = 0.017453292f * angle;
+            grid->pos[i].x = radius * cosf(rad);
+            grid->pos[i].z = radius * sinf(rad);
+            if (arg0 == 0) {
+                grid->pos[i].x =
+                    2.0f * HSD_Randf() + grid->pos[i].x;
+                grid->pos[i].z =
+                    2.0f * HSD_Randf() + grid->pos[i].z;
+            }
+            if (HSD_Randi(3) != 0) {
+                f32 theta =
+                    atan2f(grid->pos[i].z, grid->pos[i].x);
+                f32 mag = sqrtf(
+                    grid->pos[i].x * grid->pos[i].x +
+                    grid->pos[i].z * grid->pos[i].z);
+                s32 tries;
+                s32 start;
+                s32 collided;
+
+                if (i < 0x24) {
+                    start = 0;
+                } else {
+                    start = i - (prev_ring_size * 2 - 6);
+                }
+
+                collided = 0;
+            retry:
+                if (collided == 0) {
+                    s32 k;
+                    grid->pos[i].x = mag * cosf(theta);
+                    grid->pos[i].z = mag * sinf(theta);
+                    tries = (s32) (mag / 0.1f);
+                    if (HSD_Randi(2) != 0) {
+                        f32 half = mag * 0.5f;
+                        if ((s32) half > 1) {
+                            tries -= HSD_Randi((s32) half);
+                        }
+                    }
+                    for (k = i - 1; k >= start; k--) {
+                        f32 dx = grid->pos[i].x - grid->pos[k].x;
+                        f32 dz = grid->pos[i].z - grid->pos[k].z;
+                        f32 dist = sqrtf(dx * dx + dz * dz);
+                        if (dist > 2.1474836e9f ||
+                            dist < -2.1474836e9f)
+                        {
+                            OSReport(
+                                "*** tyDisplay Atari Irregul!\n");
+                            __assert("tydisplay.c", 0xC6U, "0");
+                        }
+                        if ((s32) dist <= (s32) 8.0f) {
+                            collided = 1;
+                            break;
+                        }
+                    }
+                    if (tries != 0) {
+                        if (collided == 0) {
+                            mag -= 0.1f;
+                        }
+                        collided = 0;
+                        goto retry;
+                    }
+                }
+            }
+            ring_count += 1;
+            if (ring_count >= ring_max) {
+                if (arg0 != 0) {
+                    radius += 9.0f;
+                } else {
+                    radius += 11.0f;
+                }
+                prev_ring_size = ring_max;
+                ring_count = 0;
+                ring_max += 6;
+                if (arg0 != 0) {
+                    angle = 0.0f;
+                } else {
+                    angle = (f32) HSD_Randi(0x1E);
+                }
+            } else {
+                angle += 360.0f / (f32) ring_max;
+            }
+        }
+
+        if (grid->pos[i].x < grid->x04_min_x) {
+            grid->x04_min_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].x > grid->x0C_max_x) {
+            grid->x0C_max_x = grid->pos[i].x;
+        }
+        if (grid->pos[i].z < grid->x08_min_z) {
+            grid->x08_min_z = grid->pos[i].z;
+        }
+        if (grid->pos[i].z > grid->x10_max_z) {
+            grid->x10_max_z = grid->pos[i].z;
+        }
+    }
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            for (n = 1; n <= n2; n++) {
+                if (*(s32*) &sort[n].val >
+                    *(s32*) &sort[0].val)
+                {
+                    pivot += 1;
+                    if (pivot != n) {
+                        tmp = sort[pivot];
+                        sort[pivot] = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                tmp = sort[0];
+                sort[0] = sort[pivot];
+                sort[pivot] = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 posIdx = 0;
+        s32 jobjIdx = 0;
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            cfg->x78 = un_8031BC54(grid->sort[k].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[jobjIdx] = (HSD_JObj*) gobj->hsd_obj;
+                HSD_JObjSetTranslateX(
+                    jobjArr[jobjIdx], grid->pos[posIdx].x);
+                HSD_JObjSetTranslateZ(
+                    jobjArr[jobjIdx], grid->pos[posIdx].z);
+                jobjIdx++;
+                posIdx++;
+            }
+        }
+    }
+}
+
+void un_80319540(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    s32 count;
+    s32 col, row, remainder;
+    s32 i;
+    s32 n2;
+    PAD_STACK(0x28);
+
+    memzero(grid, 0x12E4);
+
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    count = cfg->x08;
+    if (count <= 1) {
+        remainder = 0;
+    } else {
+        remainder = count % (s8) cfg->x75;
+    }
+
+    col = 0;
+    row = 0;
+    for (i = 0; i < count; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            f32 x = 9.0f * (f32) col;
+            if (arg0 != 0 && (row % 2) != 0) {
+                x = x + 3.5f;
+            }
+            grid->pos[i].x = x;
+            grid->pos[i].z = 9.0f * (f32) row;
+        }
+
+        col += 1;
+        if (remainder != 0) {
+            remainder -= 1;
+            if (remainder == 0) {
+                col = 0;
+                row += 1;
+            }
+        } else if (col >= (s8) cfg->x75) {
+            col = 0;
+            row += 1;
+        }
+
+        {
+            f32 px = grid->pos[i].x;
+            if (px < grid->x04_min_x) {
+                grid->x04_min_x = px;
+            }
+        }
+        {
+            f32 px = grid->pos[i].x;
+            if (px > grid->x0C_max_x) {
+                grid->x0C_max_x = px;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz < grid->x08_min_z) {
+                grid->x08_min_z = pz;
+            }
+        }
+        {
+            f32 pz = grid->pos[i].z;
+            if (pz > grid->x10_max_z) {
+                grid->x10_max_z = pz;
+            }
+        }
+
+        count = cfg->x08;
+    }
+
+    un_80318B1C(count);
+
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            s32 mid = n2 / 2;
+            s32 pivot, j, n;
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                jobjArr[k] = (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[k].x;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[k].z;
+                    HSD_JObj* jobj = jobjArr[k];
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+        }
+    }
+}
+
+void un_80319994(s32 arg0)
+{
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 xoff = 0.0f;
+    s32 col = 0;
+    s32 row = 0;
+    s32 ring = 1;
+    s32 i;
+    s32 count;
+    s32 n2;
+    s32 mid;
+    s32 pivot;
+    s32 j;
+    s32 n;
+
+    PAD_STACK(0x30);
+
+    memzero(grid, 0x12E4);
+    grid->x08_min_z = -3.5f;
+    grid->x04_min_x = -3.5f;
+    grid->x10_max_z = 3.5f;
+    grid->x0C_max_x = 3.5f;
+
+    for (i = 0; i < cfg->x08; i++) {
+        if (i == 0) {
+            grid->pos[i].x = 0.0f;
+            grid->pos[i].z = 0.0f;
+        } else {
+            grid->pos[i].x = 9.0f * (f32) col + xoff;
+            if (arg0 != 0) {
+                grid->pos[i].z = -9.0f * (f32) row;
+            } else {
+                grid->pos[i].z = 9.0f * (f32) row;
+            }
+        }
+        col += 1;
+        if (col >= ring) {
+            xoff -= 4.5f;
+            col = 0;
+            row += 1;
+            ring += 1;
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x < grid->x04_min_x) {
+                grid->x04_min_x = x;
+            }
+        }
+        {
+            f32 x = grid->pos[i].x;
+            if (x > grid->x0C_max_x) {
+                grid->x0C_max_x = x;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z < grid->x08_min_z) {
+                grid->x08_min_z = z;
+            }
+        }
+        {
+            f32 z = grid->pos[i].z;
+            if (z > grid->x10_max_z) {
+                grid->x10_max_z = z;
+            }
+        }
+    }
+
+    count = cfg->x08;
+    if (arg0 != 0 && count > 1) {
+        n2 = count - 1;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = (TySortElem*) grid->pos;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val < sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->pos + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_8031830C(sort, 0, pivot - 1);
+            un_8031830C(sort, pivot + 1, n2);
+        }
+    }
+
+    un_80318B1C(cfg->x08);
+
+    count = cfg->x08;
+    if (count > 1) {
+        n2 = (count / 3) * 2;
+        if (n2 > 0) {
+            TySortElem tmp;
+            TySortElem* sort = grid->sort;
+            mid = n2 / 2;
+
+            if (mid != 0) {
+                tmp = sort[0];
+                sort[0] = sort[mid];
+                sort[mid] = tmp;
+            }
+
+            pivot = 0;
+            j = 0;
+            for (n = 1; n2 >= n; n++) {
+                if (sort[n].val > sort[0].val) {
+                    pivot += 1;
+                    j += 8;
+                    if (pivot != n) {
+                        TySortElem* s = (TySortElem*) ((u8*) grid->sort + j);
+                        tmp = *s;
+                        *s = sort[n];
+                        sort[n] = tmp;
+                    }
+                }
+            }
+
+            if (pivot != 0) {
+                TySortElem* s = &sort[pivot];
+                tmp = sort[0];
+                sort[0] = *s;
+                *s = tmp;
+            }
+
+            un_80318714(sort, 0, pivot - 1);
+            un_80318714(sort, pivot + 1, n2);
+        }
+    }
+
+    {
+        s32 k;
+        s32 off = 0;
+
+        for (k = 0; k < cfg->x08; k++) {
+            HSD_GObj* gobj;
+            HSD_JObj** jobjArr;
+            cfg->x78 = un_8031BC54(grid->sort[0].key);
+            gobj = cfg->x78;
+            if (gobj != NULL) {
+                jobjArr = un_804D6F10;
+                *(HSD_JObj**) ((u8*) jobjArr + off) =
+                    (HSD_JObj*) gobj->hsd_obj;
+                {
+                    f32 xpos = grid->pos[n].x;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateX(jobj, xpos);
+                }
+                {
+                    f32 zpos = grid->pos[n].z;
+                    HSD_JObj* jobj = *(HSD_JObj**) ((u8*) jobjArr + off);
+                    HSD_JObjSetTranslateZ(jobj, zpos);
+                }
+            }
+            off += 4;
+        }
+    }
+}
+
+void un_80319EF0(void)
+{
+    Vec3 interest;
+    Vec3 sp28;
+    Vec3 eyepos;
+    TyDspGrid* grid = un_804D6F14;
+    TyDspConfig* cfg = un_804D6F18;
+    TyDspBgData* bg = un_804D6F1C;
+    HSD_CObj* cobj;
+    f32 range;
+    f32 scale;
+
+    PAD_STACK(0x18);
+
+    cobj = (HSD_CObj*) cfg->x00->hsd_obj;
+
+    range = grid->x0C_max_x - grid->x04_min_x;
+    if (range < 0.0f) {
+        range = -range;
+    }
+    interest.x = range * 0.5f + grid->x04_min_x;
+    if (grid->x00 == 3) {
+        interest.x = 0.0f;
+    }
+    interest.y = 0.0f;
+    {
+        f32 zmin = grid->x08_min_z;
+        f32 zrange = grid->x10_max_z - zmin;
+        if (zrange < 0.0f) {
+            zrange = -zrange;
+        }
+        interest.z = zrange * 0.5f + zmin;
+    }
+    eyepos = interest;
+    interest.z -= 10.0f;
+    cfg->x5C = interest;
+    HSD_CObjGetEyePosition(cobj, &sp28);
+    sp28.x = eyepos.x;
+    sp28.z = 500.0f + eyepos.z;
+    cfg->x68 = sp28;
+    HSD_CObjSetInterest(cobj, &interest);
+    HSD_CObjSetEyePosition(cobj, &sp28);
+
+    {
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        if (xrange < 0.0f) {
+            xrange = -xrange;
+        }
+        cfg->x40 = 14.0f + xrange;
+    }
+    cfg->x44 = 1.0f;
+
+    while (500.0f * tanf(0.017453292f * (cfg->x44 * 0.5f)) < cfg->x40 * 0.5f) {
+        cfg->x44 = cfg->x44 + 0.1f;
+    }
+
+    if (cfg->x44 < 3.0f) {
+        cfg->x44 = 3.2f;
+    }
+    HSD_CObjSetFov(cobj, cfg->x44);
+
+    cfg->x4C = (f32) cfg->x08 * 0.0033333334f + 3.0f;
+    {
+        f32 fov2 = cfg->x44;
+        cfg->x50 = fov2 + fov2 / 5.0f;
+    }
+    if (cfg->x44 < 3.0f) {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 30.0f;
+    } else {
+        cfg->x48 = (cfg->x50 - cfg->x4C) / 60.0f;
+    }
+
+    {
+        s32 mode = grid->x00;
+        switch (mode) {
+        default:
+            cfg->x54 = -((14.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (14.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 2:
+            cfg->x54 = -((7.0f + cfg->x40) * 0.5f - cfg->x5C.x);
+            cfg->x58 = (7.0f + cfg->x40) * 0.5f + cfg->x5C.x;
+            break;
+        case 3:
+            cfg->x54 = -(cfg->x40 * 0.5f - cfg->x5C.x);
+            cfg->x58 = cfg->x40 * 0.5f + cfg->x5C.x;
+            break;
+        }
+    }
+
+    cfg->x1C = 57.29578f * lb_8000D008((cfg->x58 - cfg->x54) * 0.5f, 500.0f);
+    cfg->x18 = 57.29578f * lb_8000D008(cfg->x40 * 0.5f, 500.0f);
+
+    {
+        HSD_JObj* jobj = (HSD_JObj*) un_804D6F1C->gobj4->hsd_obj;
+        HSD_JObjSetTranslate(jobj, &eyepos);
+    }
+
+    {
+        f32 zrange = 14.0f + (grid->x10_max_z - grid->x08_min_z);
+        f32 xrange = grid->x0C_max_x - grid->x04_min_x;
+        scale = (f32) (cfg->x08 / 30);
+        if (zrange < xrange) {
+            zrange = 14.0f + xrange;
+        }
+        if (38.0f * scale < zrange) {
+            while (38.0f * scale < zrange) {
+                scale += 0.1f;
+            }
+        } else {
+            while (38.0f * scale > zrange) {
+                scale -= 0.1f;
+            }
+        }
+        if (scale > 2.1474836e9f || scale < -2.1474836e9f) {
+            OSReport("*** tyDisplay Table Scale Irregul!\n");
+            __assert("tydisplay.c", 0x28CU, "0");
+        }
+        if ((s32) scale != 0) {
+            HSD_JObjSetScaleX(un_804D6F1C->jobj, scale);
+            HSD_JObjSetScaleZ(un_804D6F1C->jobj, scale);
+        }
+    }
+}
+
+void fn_8031A4EC(HSD_GObj* arg0)
+{
+    float zero;
+    Vec3 interest;
+    Vec3 eye;
+    u8 _1[0x8];
+    HSD_CObj* cobj = (HSD_CObj*) arg0->hsd_obj;
+    TyDspConfig* cfg = un_804D6F18;
+    f32 fov;
+    f32 val;
+    s32 sign;
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    HSD_CObj* cobj2;
+    f32 stick;
+    u8 _2[0x10];
+
+    HSD_CObjGetInterest(cobj, &interest);
+    HSD_CObjGetEyePosition(cobj, &eye);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    zero = 0;
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > zero) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (mn_8022F218() != 0) {
+        lbAudioAx_80024030(0);
+        mn_8022F268();
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    if (un_80305B88() & 0x1200) {
+        lbAudioAx_80024030(0);
+        ((TyModeState*) un_804A284C)->x4 = 1;
+        return;
+    }
+
+    {
+        stick = cfg->x20;
+        if (stick != zero) {
+            cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+            if (cfg->x10 < -cfg->x1C) {
+                cfg->x10 = -cfg->x1C;
+            }
+            if (cfg->x10 > cfg->x1C) {
+                cfg->x10 = cfg->x1C;
+            }
+        }
+    }
+
+    {
+        stick = cfg->x24;
+        if (stick != zero) {
+            cfg->x0C = (stick * (0.02f * fov)) + cfg->x0C;
+            if (cfg->x0C < -cfg->x18) {
+                cfg->x0C = -cfg->x18;
+            }
+            if (cfg->x0C > cfg->x18) {
+                cfg->x0C = cfg->x18;
+            }
+        }
+    }
+
+    if (un_80305C44() & 0x424) {
+        fov += cfg->x48;
+        if (fov > cfg->x50) {
+            fov = cfg->x50;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305C44() & 0x848) {
+        fov -= cfg->x48;
+        if (fov < cfg->x4C) {
+            fov = cfg->x4C;
+        }
+        HSD_CObjSetFov(cobj, fov);
+    }
+
+    if (un_80305B88() & 0x100) {
+        HSD_CObjSetInterest(cobj, &cfg->x5C);
+        HSD_CObjSetFov(cobj, cfg->x44);
+        cfg->x10 = 0.0f;
+        cfg->x0C = 0.0f;
+        HSD_CObjSetEyePosition(cobj, &cfg->x68);
+    }
+
+    {
+        cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+        HSD_CObjGetInterest(cobj2, &interest2);
+        HSD_CObjGetEyePosition(cobj2, &eye2);
+        tempvec1.x = cfg->x68.x;
+        tempvec1.y = 0.0f;
+        tempvec1.z = -500.0f;
+        tempvec2.x = 0.017453292f * cfg->x0C;
+        tempvec2.y = 0.017453292f * cfg->x10;
+        tempvec2.z = 0.0f;
+        lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+        tempvec1.z = cfg->x5C.z;
+        HSD_CObjSetInterest(cobj2, &tempvec1);
+    }
+}
+
+void fn_8031A94C(HSD_GObj* arg0)
+{
+    u8 _1[0x4];
+    Vec3 sp7C;
+    Vec3 sp70;
+    u8 _3[0x8];
+    Vec3 interest2;
+    Vec3 tempvec1;
+    Vec3 eye2;
+    Vec3 tempvec2;
+    u8 _2[0x8];
+    TyDspConfig* cfg = un_804D6F18;
+    HSD_CObj* cobj = GET_COBJ(arg0);
+    HSD_JObj* trophy = GET_JOBJ( cfg->x78)->child;
+    f32 fov;
+    f32 val;
+    s32 sign;
+
+    HSD_CObjGetInterest(cobj, &sp7C);
+    HSD_CObjGetEyePosition(cobj, &sp70);
+    fov = HSD_CObjGetFov(cobj);
+
+    cfg->x20 = un_80305D00();
+    cfg->x24 = un_80305DB0();
+
+    val = cfg->x20;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x20 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x20 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x24;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x24 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x24 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    cfg->x30 = un_80305EB4();
+    cfg->x34 = un_80305FB8();
+
+    val = cfg->x30;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x30 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x30 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    val = cfg->x34;
+    if (val > -0.2f && val < 0.2f) {
+        cfg->x34 = 0.0f;
+    } else {
+        if (val > 0.0f) {
+            sign = 1;
+        } else {
+            sign = -1;
+        }
+        cfg->x34 = -(0.2f * (f32) sign - val) / 0.8f;
+    }
+
+    if (cfg->x74 != 0) {
+        cfg->x74 = cfg->x74 - 1;
+        return;
+    }
+
+    if (un_80305C44() & 0x200) {
+        un_804D6F28 += 1;
+        if (un_804D6F28 > 0x78) {
+            lbAudioAx_80024030(0);
+            ((TyModeState*) un_804A284C)->x4 = 1;
+        }
+    } else {
+        un_804D6F28 = 0;
+        if ((un_80305C44() & 0x100 && cfg->x20 < -0.8f) || (un_80305B88() & 1))
+        {
+            HSD_JObjAddTranslationX(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x20 > 0.8f) || (un_80305B88() & 2))
+        {
+            HSD_JObjAddTranslationX(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 0, HSD_JObjGetTranslationX(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 > 0.8f) || (un_80305B88() & 8))
+        {
+            HSD_JObjAddTranslationZ(trophy, -0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if ((un_80305C44() & 0x100 && cfg->x24 < -0.8f) || (un_80305B88() & 4))
+        {
+            HSD_JObjAddTranslationZ(trophy, 0.01f);
+            un_8031BA78(cfg->x7C, 2, HSD_JObjGetTranslationZ(trophy));
+        }
+        if (un_80305B88() & 0x20) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C + 1;
+                if (cfg->x7C >= 0x125) {
+                    cfg->x7C = 0;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (un_80305B88() & 0x40) {
+            HSD_GObjPLink_80390228(cfg->x78);
+            cfg->x78 = NULL;
+            while (cfg->x78 == NULL) {
+                cfg->x7C = cfg->x7C - 1;
+                if (cfg->x7C < 0) {
+                    cfg->x7C = 0x124;
+                }
+                cfg->x78 = un_8031BC54(cfg->x7C);
+            }
+            return;
+        }
+        if (!(un_80305C44() & 0x100)) {
+            f32 stick = cfg->x20;
+            f32 zero = 0.0f;
+            if (stick != zero) {
+                cfg->x10 = -(stick * (0.02f * fov) - cfg->x10);
+                if (cfg->x10 < -cfg->x1C) {
+                    cfg->x10 = -cfg->x1C;
+                }
+                if (cfg->x10 > cfg->x1C) {
+                    cfg->x10 = cfg->x1C;
+                }
+            }
+            {
+                f32 stick2 = cfg->x24;
+                if (stick2 != zero) {
+                    cfg->x0C = (stick2 * (0.02f * fov)) + cfg->x0C;
+                    if (cfg->x0C < -cfg->x18) {
+                        cfg->x0C = -cfg->x18;
+                    }
+                    if (cfg->x0C > cfg->x18) {
+                        cfg->x0C = cfg->x18;
+                    }
+                }
+            }
+        }
+        if (cfg->x34 > 0.8f) {
+            sp70.y += 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (cfg->x34 < -0.8f) {
+            sp70.y -= 1.0f;
+            HSD_CObjSetEyePosition(cobj, &sp70);
+        }
+        if (un_80305C44() & 0x400) {
+            fov += cfg->x48;
+            if (fov > cfg->x50) {
+                fov = cfg->x50;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305C44() & 0x800) {
+            fov -= cfg->x48;
+            if (fov < cfg->x4C) {
+                fov = cfg->x4C;
+            }
+            HSD_CObjSetFov(cobj, fov);
+        }
+        if (un_80305B88() & 0x1000) {
+            HSD_CObjSetInterest(cobj, &cfg->x5C);
+            HSD_CObjSetFov(cobj, cfg->x44);
+            cfg->x10 = 0.0f;
+            cfg->x0C = 0.0f;
+            HSD_CObjSetEyePosition(cobj, &cfg->x68);
+        }
+        {
+            HSD_CObj* cobj2 = (HSD_CObj*) cfg->x00->hsd_obj;
+            HSD_CObjGetInterest(cobj2, &interest2);
+            HSD_CObjGetEyePosition(cobj2, &eye2);
+            tempvec1.x = cfg->x68.x;
+            tempvec1.y = 0.0f;
+            tempvec1.z = -500.0f;
+            tempvec2.x = 0.017453292f * cfg->x0C;
+            tempvec2.y = 0.017453292f * cfg->x10;
+            tempvec2.z = 0.0f;
+            lbVector_ApplyEulerRotation(&tempvec1, &tempvec2);
+            tempvec1.z = cfg->x5C.z;
+            HSD_CObjSetInterest(cobj2, &tempvec1);
+        }
+    }
+}
+
+static char un_804D5AA8[] = "0";
+static u16 un_804D5ABC = 0x15;
 
-/// #un_80318714
+void un_8031B1FC(void)
+{
+    HSD_Joint* joint;
+    TyDspBgData* ptr = un_804D6F1C;
+    HSD_GObj* gobj4;
+    HSD_GObj* gobj;
+    int zero;
+    u8 temp;
+    HSD_JObj* jobj;
+    gobj4 = ptr->gobj4;
+    zero = 0;
+    do {
+        UNUSED unsigned char _[(0x10)];
+    } while (zero);
 
-/// #un_80318B1C
+    if (ptr->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        __assert("tydisplay.c", 0x3FD, un_804D5AA8);
+    }
 
-/// #un_80318CB4
+    gobj = ptr->gobj0;
+    if ((ptr->gobj4 && ptr->gobj4) && gobj4) {
+    }
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj0 = NULL;
+    }
 
-/// #un_80319540
+    gobj = ptr->gobj4;
+    if (gobj != NULL) {
+        HSD_GObjPLink_80390228(gobj);
+        ptr->gobj4 = NULL;
+    }
 
-/// #un_80319994
+    joint = HSD_ArchiveGetPublicAddress(ptr->archive, "ToyDspBg_Top_joint");
+    if (joint != NULL) {
+        ptr->gobj4 = GObj_Create(9, 9, zero);
+        jobj = HSD_JObjLoadJoint(joint);
+        HSD_GObjObject_80390A70(ptr->gobj4, temp = HSD_GObj_804D7849, jobj);
+        GObj_SetupGXLink(ptr->gobj4, HSD_GObj_JObjCallback, 0x3C, zero);
+        lb_8001204C(jobj, &ptr->jobj, &un_804D5ABC, 1);
+        return;
+    }
+
+    OSReport("*** Can not Load Panel Label(%s)\n", "ToyDspBg_Top_joint");
+    __assert("tydisplay.c", 0x43E, un_804D5AA8);
+}
+
+static s32 un_804DE018 = (s32) 0xC8C8C8FF;
+static f32 un_804DE01C = 0.6f;
 
-/// #un_80319EF0
+void un_8031B328(void)
+{
+    HSD_FogDesc* fogDesc;
+    TyDspBgData* ptr = un_804D6F1C;
+    TyDspSceneGfx* scene = (TyDspSceneGfx*) un_804D6ED4;
+    void* lightData;
+    TyDspBgData* temp3;
+    s8 temp2;
+    HSD_LObj* lobj;
+    HSD_GObj* temp;
+
+    PAD_STACK(24);
 
-/// #fn_8031A4EC
+    if ((temp3 = ptr)->archive == NULL) {
+        OSReport("*** BG data aren't being loaded!\n");
+        OSPanic("tydisplay.c", 0x459, un_804D5AC0);
```

## PR #2297: tydisplay
Path: src/melee/ty/tydisplay.c
URL: https://github.com/doldecomp/melee/pull/2297#discussion_r2954440838
Author: PsiLupan

This should just be used in the actual function call. Shouldn't need to declare it as a static above.

Hunk:
```diff
@@ -203,11 +1918,132 @@ s32 un_8031BBF4(s8 arg0)
     return (s32) table[arg0];
 }
 
-/// #un_8031BC54
+static char un_803FF01C[] = "ToyDspStand_Top_joint";
```
