## PR #2564: Match mn menu record functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2564

## Summary
- Match `mn_80232D4C`
- Match `AddCharacterToName` and `mnNameNew_8023E0D8`
- Match `mnDiagram2_GetStatValue` and `mnDiagram2_UpdateScrollArrows`
- Match `mnVibration_80248444`, `mnVibration_80248644`, `mnVibration_80248ED4`, and `mnVibration_80249174`
- Match `mnSoundTest_8024A790`, `mnDataDel_80250170`, `mnInfo_80251D58`, `mnInfo_80251F04`, `mnInfo_802522B8`, `mnSnap_80253BE0`, and `fn_80257D7C`
- Match `mnCount_GetRowValue_Character` and improve adjacent count-row value logic

## Verification
- `python configure.py --require-protos && ninja`

## PR #2564: Match mn menu record functions
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2564#issuecomment-4588159215

cleaning up regressions now. will mark ready once report is clean
