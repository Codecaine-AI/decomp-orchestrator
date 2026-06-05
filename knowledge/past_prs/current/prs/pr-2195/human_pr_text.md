## PR #2195: itbombhei
Author: jurrejelle
URL: https://github.com/doldecomp/melee/pull/2195

Draft PR for now to track progress

## PR #2195: itbombhei
Author: jurrejelle
URL: https://github.com/doldecomp/melee/pull/2195#issuecomment-3980344893

Mostly done, still a few funcs I struggled with a bit but already a good improvement
```
(.venv) ubuntu@ubuntu:~/Desktop/Melee/melee$ python3 tools/easy_funcs.py melee/it/items/itbombhei.c -S 100000 -M 99.999
Address         Unit                                  Function                               Size        Matched        
80280974        src/melee/it/items/itbombhei.c        fn_80280974                       420 bytes         91.04%        
8027F270        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion2_Coll         444 bytes         94.14%        
8027EB7C        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion3_Anim         580 bytes         96.15%        
802806CC        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion10_Anim        604 bytes         90.32%        
8027E3E4        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion8_Anim         608 bytes         90.36%        
8027EFD0        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion2_Anim         668 bytes         94.64%        
8027F5E8        src/melee/it/items/itbombhei.c        itBombhei_UnkMotion4_Anim         692 bytes         95.26%        
8028007C        src/melee/it/items/itbombhei.c        fn_8028007C                       700 bytes         92.53%     
```
