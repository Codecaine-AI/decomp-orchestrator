## PR #2358: Link grfzerocar
Author: jellejurre
URL: https://github.com/doldecomp/melee/pull/2358

I am unsure how to do sdata2 ordering properly, found a message earlier showing to use a fake function as such:
```
// For sdata2 ordering
static void fakeFunc(Vec3);
static void fakeFunc(Vec3 temp)
{
    f64 f = 1.0;
    temp.x = 0.0f;
    temp.y = f;
}
```

So that is how I've done it. If there is a better way to do it please let me know ^^'
