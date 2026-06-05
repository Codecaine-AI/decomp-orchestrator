## PR #2419: Add transmuter
Author: macabeus
URL: https://github.com/doldecomp/melee/pull/2419

I purposely break the function `ifTime_GetCountdownSeconds` to demo Transmuter.

How to call transmuter to fix it:

1. Generate the preprocessed single-TU source

```
tools/transmuter-prepare.sh src/melee/if/iftime.c ifTime_GetCountdownSeconds
```

2. Call transmuter

```sh
node ~/path/for/transmuter/packages/cli/dist/index.js match \
    build/GALE01/src/melee/if/iftime.ctx.c \
    --target build/GALE01/obj/melee/if/iftime.o \
    --function ifTime_GetCountdownSeconds \
    --compiler "tools/transmuter-compile.sh {{inputPath}} {{outputPath}}" \
    --cwd "$(pwd)" \
    --isolate \
    --no-reduce \
    --no-cleanup \
    --concurrency 4 \
    --max-iterations 2000 \
    --timeout 180000 \
    --seed 42
```

## PR #2419: Add transmuter
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2419#issuecomment-4460648278

Please resubmit this when it's in a more complete state and with a clearer explanation of its usage.
