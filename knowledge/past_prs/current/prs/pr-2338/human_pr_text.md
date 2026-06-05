## PR #2338: ef work
Author: Savestate2A03
URL: https://github.com/doldecomp/melee/pull/2338

Match:
- ~~efdata.c~~
- ~~efalt.c (it was named special after my original MR, i started working on this after that without realizing it. to reduce merge conflict headache i just kept the original name i gave it here, although once merged in feel free to rename it back to special)~~ 
- nvm apparently these were already matched and i forgot
- did work on async
- gave descriptive naming to ef-related functions

I am not attached to any of the names I am using here, feel free to name them something more appropriate.

efalt was named special after my original MR, i started working on this after that without realizing it. to reduce merge conflict headache i just kept the original name i gave it here, although once merged in feel free to rename it back to special. if  you want to look into it though it is only ever called if efSync_Spawn is called with 0x478 >= gfx_id < 0x4BA

notes: 
```
/*
 * TODO: efAsync_Dispatch is the only function left to match, it
 *       currently sits at 98%, and its jump table sits at 53%.
 *       Unsure if we should hard code the jump table or get it
 *       matching by properly structuring things...
 *       Revisit eventually. There's a second jump table that
 *       is only 1 word long and is matching 88%, look at that
 *       too.
 */
``` 

```
/*
 * TODO: I looked at the strings in the ASM, I think there was only
 *       ever eflib.c and efasync.c (?) The files in this folder 
 *       and splits / symbols should be adjusted accordingly with time,
 *       but for the sake of matching files %, we can leave these
 *       separate for now. Also I dont know if anyone cares as long
 *       as it matches lol.
 */
```

```
/* 
 * TODO: efSync_Spawn is at 98% matching, and its associated jump
 *       table is at 60%. Unsure if we should hardcode it or try
 *       to match it as a .data-located variable.
 */
```

Notes about particle.h (temp only used in ef)

```
// Particle linkNo skip masks (bits 16+) for hsd_8039CEAC / hsd_8039EE24
// Set bit = skip processing for that linkNo
/* TODO: Get these from particles.h once that is fully fleshed out */
#define PTCL_SKIP_LINKNO_0 0x10000
#define PTCL_SKIP_LINKNO_1 0x20000
#define PTCL_SKIP_LINKNO_2 0x40000

// Particle linkNo render masks (bits 0+) for psDispParticles
// Set bit = include for rendering
/* TODO: Get these from particles.h once that is fully fleshed out */
#define PTCL_RENDER_LINKNO_0 0x1
#define PTCL_RENDER_LINKNO_1 0x2
#define PTCL_RENDER_LINKNO_2 0x4
```
