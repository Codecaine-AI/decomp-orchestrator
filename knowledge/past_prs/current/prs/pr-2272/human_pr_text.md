## PR #2272: gr cleanup, internal ID fixes/additions, part 1
Author: PsiLupan
URL: https://github.com/doldecomp/melee/pull/2272

* Renames functions across several files based on callback table
* Fixes several internal stage IDs that were wrong and adds the remaining
* Switches StageData usages to correctly use the internal stage ID instead of treating the first field as a flag
