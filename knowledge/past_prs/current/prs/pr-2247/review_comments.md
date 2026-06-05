## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2909326516
Author: mchen91

I was getting this error during the build: `ERROR Size mismatch for @260 (type Object) at 0x804D5790: Expected 0x4, found 0x1`
I'm not certain this is the proper fix, so please let me know if there is a better way to deal with it

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```

## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2912615941
Author: PsiLupan

In this case, it's the `symbols.txt` file has the symbols, their address, their associated size, and type. The auto-size was just 4 and if it's corrected, it should be resolved.

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```

## PR #2247: Match `devcom` and `iftime`
Path: src/melee/if/iftime.c
URL: https://github.com/doldecomp/melee/pull/2247#discussion_r2912767319
Author: mchen91

Thank you, I've updated the size in the symbols file

Hunk:
```diff
@@ -189,6 +189,8 @@ void ifTime_FreeCountdown(void)
     }
 }
 
+static char ifTime_804D5790[4] = "";
```
