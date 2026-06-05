## PR #2451: Add ninja format targets
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2451

Adds Ninja targets for formatting changed C/C++ lines:

- `ninja format` runs the same changed-line workflow as `git clang-format`
- `ninja format-check` checks the changed-line diff without modifying files
- updates the contributing docs to point contributors at the new targets

The target uses a small Python wrapper around `git clang-format` so it keeps the existing staged/diff-based behavior instead of trying to reformat the whole repository.

Testing:
- `brew install ninja clang-format`
- `ninja --version` -> `1.13.2`
- `clang-format --version` -> `clang-format version 22.1.4`
- `python3 -m py_compile tools/format.py tools/project.py configure.py`
- `python3 configure.py`
- `git diff --check`
- `python3 tools/format.py --help`
- `python3 tools/format.py --check HEAD~1`
- `python3 tools/format.py HEAD~1`
- `ninja -t targets | rg '^(format|format-check):'`
- `ninja format-check`
- `ninja format`

Closes #1543

## PR #2451: Add ninja format targets
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2451#issuecomment-4359409090

Extra local validation after installing `ninja` and `clang-format`:

- confirmed the generated `build.ninja` has `format` and `format-check` targets
- confirmed the branch diff is clean with `git diff --check`
- confirmed `python3 tools/format.py --check HEAD~1` and `python3 tools/format.py HEAD~1` both complete cleanly
- checked missing-tool and outside-worktree failure paths so they print direct errors instead of tracebacks
- checked the PR only changes `.github/CONTRIBUTING.md`, `tools/format.py`, and `tools/project.py`

CI is also green on the latest pushed commit.

## PR #2451: Add ninja format targets
Author: dberweger2017
URL: https://github.com/doldecomp/melee/pull/2451#issuecomment-4359427450

Update: after extracting the expected GALE01 Rev 2 `main.dol` locally, I reran the generated Ninja targets directly:

- `ninja format-check` passes
- `ninja format` passes

Both report `no modified files to format`. I updated the PR description accordingly.

## PR #2451: Add ninja format targets
Author: ribbanya
URL: https://github.com/doldecomp/melee/pull/2451#issuecomment-4391744803

I don't see the utility of this implementation. The idea of #1543 was to run each file through `clang-format` individually so that ninja can keep track of dirty files and efficiently format them. Compared to outsourcing the entire format operation to `git-clang-format` through a Python script, a commit hook would make more sense and is already set up through [`.pre-commit-config.yaml`](https://github.com/doldecomp/melee/blob/d97eb882de59110b888547a79ea4901286b7e1fd/.pre-commit-config.yaml). Maybe we should just document the [setup of pre-commit](https://pre-commit.com/#install) and add it to `requirements.in`.
