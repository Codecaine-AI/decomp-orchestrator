## PR #2268: Almost finish mngallery.c + misc matches
Author: dwilliams27
URL: https://github.com/doldecomp/melee/pull/2268

This should be much higher quality than the 100 function match PR I submitted before. Apologies on that one, included some runs where some of the agent's tools were silently broken, so output varied in quality a lot.

I think these should be good (especially mngallery.c). Let me know any issues you see, I'll incorporate feedback into next batch.

Also if you all have any clue on how to wrap up fn_802590C4 that would be amazing information to add. I had the AIs running a ton of experiments and even had them [disassemble and analyze MWCC itself](https://github.com/dwilliams27/gc-decomp/blob/main/docs/MWCC_COLORING_ANALYSIS.md), got close but couldn't close the gap. Fair warning some of the docs in that repo may contain some garbage, they were wrote by and for agents lol

mngallery.c (9 new)                                                                                            
1. mnGallery_8025896C
2. mnGallery_80258A08
3. mnGallery_80258BC4
4. mnGallery_80258DBC
5. fn_80258ED0
6. mnGallery_802591BC
7. mnGallery_80259604
8. mnGallery_8025963C
9. mnGallery_80259868
10. fn_802590C4 (at like 95% fuzzy match, this one is super difficult to finish)

gm_1601.c (4 new)
1. gm_801636D8
2. gm_80163838
3. gm_80163A3C
4. gm_80164430

grcorneria.c (1 new)
1. grCorneria_801DEC94

lbaudio_ax.c (3 new)
1. lbAudioAx_800263E8
2. lbAudioAx_80026510
3. lbAudioAx_80026F2C

## PR #2268: Almost finish mngallery.c + misc matches
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2268#issuecomment-4036474790

If it's helpful at all, a version of mwcc (not melee's but it's close) is fully matched [here](https://git.wuffs.org/MWCC/tree/?h=main).
