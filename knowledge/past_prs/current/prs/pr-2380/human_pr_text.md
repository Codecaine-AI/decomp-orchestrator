## PR #2380: Link mngallery
Author: jellejurre
URL: https://github.com/doldecomp/melee/pull/2380#issuecomment-4181029574

90% done, just needs some messyness with the
typedef struct mnGallery_t {
    HSD_Joint* x0;
    HSD_AnimJoint* x4;
    HSD_MatAnimJoint* x8;
    HSD_ShapeAnimJoint* xC;
} mnGallery_t;
struct, and I believe someone needs to figure out what the mnGallery_804D6C88 struct is
