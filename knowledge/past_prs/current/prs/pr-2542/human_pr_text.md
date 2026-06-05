## PR #2542: Add MetroTRK exception vector assembly
Author: billy-briggs-dev
URL: https://github.com/doldecomp/melee/pull/2542

Added a dedicated split for the MetroTRK exception vector table as `src/MetroTRK/__exception.s`.

Represented the exception vector table as assembly instead of C because this region is layout-sensitive.
The exception vector table in `.init` is not ordinary gameplay code. The region mixes embedded bytes, fixed-size gaps, labels, and instructions in one contiguous block. Also cleaned up the source with small assembly macros and named SPR constants.

References:
[OOT GC Decomp](https://github.com/zeldaret/oot-gc/blob/main/src/metrotrk/__exception.s)

## PR #2542: Add MetroTRK exception vector assembly
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2542#issuecomment-4547734357

@r-burns Any idea why nix is consistently failing on this but not other PRs?

## PR #2542: Add MetroTRK exception vector assembly
Author: r-burns
URL: https://github.com/doldecomp/melee/pull/2542#issuecomment-4548211900

Yeah, this adds binutils as a new build dependency. The regular build happily downloads dtk's binaries for it on-the-fly, but Nix refuses to do so because the build is sandboxed and non-networked for reproducibility. (This is a good thing IMO - it both enforces bit-reproducibility of the build process, and that I'll be able to hack on the decomp when I'm on a plane.)

Do we want to add a new binutils dependency to the build process? I'd done a similar cleanup of this exception asm in the past, but didn't push it because IMO it's not worth requiring all of binutils just for this component of MetroTRK that isn't even used.

If we decide to add this anyway, I'm happy to update the Nix expressions as needed. I think binutils is already available in the build sandbox, we just need to tell dtk's configure script to use that instead of downloading it.

## PR #2542: Add MetroTRK exception vector assembly
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2542#issuecomment-4555244726

Does dtk require all of binutils, or just the assembler? Can we just pull it from the [gc-wii-binutils](https://github.com/encounter/gc-wii-binutils) container for the Nix build?

Either way, I think it's worthwhile to make something work.

## PR #2542: Add MetroTRK exception vector assembly
Author: r-burns
URL: https://github.com/doldecomp/melee/pull/2542#issuecomment-4555655501

> Does dtk require all of binutils, or just the assembler?

Yeah, looks like it just needs the assembler. No biggie either way, I already have all of binutils in the nix shell because stuff like objdump and readelf are useful.

> Can we just pull it from the [gc-wii-binutils](https://github.com/encounter/gc-wii-binutils) container for the Nix build?

No need, I've already got it packaged for Nix. I prefer directly using upstream binutils over fetching precompiled binaries, but good to know that we can fall back to encounter's static binaries if my recipes break or turn out to be incompatible in some way.

> I think it's worthwhile to make something work.

Fair point, will fix. Looks like it's actually super simple so should just take a minute.

## PR #2542: Add MetroTRK exception vector assembly
Author: billy-briggs-dev
URL: https://github.com/doldecomp/melee/pull/2542#issuecomment-4555890746

Thanks guys! This is actually my first time contributing to any decomp project. Definitely looking forward to contributing more where I can :)
