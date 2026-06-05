## PR #2502: gr: fix Zebes Route param store
Author: itsgrimetime
URL: https://github.com/doldecomp/melee/pull/2502

## Summary
- model `grZe_Route_804D6A60` as the 8-byte Zebes Route param store
- name the currently understood route params (`camera_timer`, `zako_spawn_chance`)
- bring `grzebesroute` data sections, including `.sbss`, to 100%

## Verification
- `ninja build/GALE01/src/melee/gr/grzebesroute.o build/GALE01/report.json`
- `ninja`

## Match Notes
- TU fuzzy remains 99.98663%
- `grZebesRoute_8020B548` remains 99.96923%
- data sections are now 100%
