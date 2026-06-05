## PR #2339: ef work
Author: Savestate2A03
URL: https://github.com/doldecomp/melee/pull/2339

# ef work
- `efSpecial` -> `efAlt`
  - this is due to having started work on this after the change to `efSpecial` was made.
- `efdata.c` New file that holds static data for `ef`, moved from `eflib_alloc` and other data regions.
- `efsync.c` `.sdata` now matches
- `efasync.c` `efAsync_Spawn` now matches
- `efasync.c` `.sdata` now matches
- `efSync_Spawn`: slightly better match
- `efAsync_Dispatch`: slightly better match

- Gave descriptive naming to ef-related functions
  - Feel free to change any of these, I am not attached to them

## PR #2339: ef work
Author: Savestate2A03
URL: https://github.com/doldecomp/melee/pull/2339#issuecomment-4102277867

> <img width="494" height="108" alt="image" src="https://github.com/user-attachments/assets/8b37aa4c-678b-4c09-9e2f-10b537053bfb" />

this is jumptable related, it will be inherently fixed once the associated function matches i believe
