## PR #2217: Match ~100 functions
Author: dwilliams27
URL: https://github.com/doldecomp/melee/pull/2217

Hello!

I've been working the past ~2 weeks on developing a system for leveraging AI to automate finding matches for this repo. I ran it overnight a few times, and I think this first batch here should be ready for review. Repo I created for this [here](https://github.com/dwilliams27/gc-decomp)

I saw a few other commits in the repo co-authered by Claude, so assuming this is fair game.

I do not have much experience working on decompilation projects like this, so I apologize if some of what is in my PR here is "low quality". I've filtered out all of the "matches" that included any regression, and this seems to legitimately raise the global match rate by ~0.2%, so to me seems good.
I've also filtered out most of the cheats I've seen the LLMs use (inlining assembly lol), but totally possible there is more garbage here I did not catch.

More than happy to respond to feedback here; I'm sure there is a lot that could be done to improve the harness I've set up. Hoping to scale this up if maintainers agree that these results seem useful.

## PR #2217: Match ~100 functions
Author: PsiLupan
URL: https://github.com/doldecomp/melee/pull/2217#issuecomment-4002765642

You can look at the Issues run and see most of the things that would need to be addressed, like missing function prototypes, C99 rule violations (variables must be declared at the top level of scope), etc. to give you an idea of what would need to be fixed.

## PR #2217: Match ~100 functions
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2217#issuecomment-4004675214

AI usage isn't a problem, as long as it matches and doesn't do anything too weird. You should join the [discord](https://discord.gg/hKx3FJJgrV), there's `#smash-bros-melee` and `#ai` as well.
