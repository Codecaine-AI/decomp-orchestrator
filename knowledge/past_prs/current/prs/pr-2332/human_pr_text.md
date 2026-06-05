## PR #2332: Link grkraid
Author: jellejurre
URL: https://github.com/doldecomp/melee/pull/2332

In data, I have a string that needs to be placed with an offset, but that offset doesnt come through (seems to be placed at 0x803E4D60)
grKr_803E4D64 = .data:0x803E4D64; // type:object size:0x9 scope:global data:string
https://files.jellejurre.dev/ShareX/Screenshot%20From%202026-03-20%2013-15-29.png

Apart from that it seems in my .sdata section it is supposed to be padded with zero bytes, and I'm curious how I would achieve that
https://files.jellejurre.dev/ShareX/Screenshot%20From%202026-03-20%2013-15-50.png

Same issue in my rodata:
https://files.jellejurre.dev/ShareX/Screenshot%20From%202026-03-20%2013-16-50.png

If someone can either tell me how to do that, or do that themselves this can be set to matching, linked and merged

Edit: All fixed (Thanks 桜 in the discord!)

Janky hack for the 4 byte offset, but if it works it works
