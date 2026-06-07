# Ghidra Skill Revival Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revive the `/ghidra` skill (currently broken in 5 stacked ways) and integrate Ghidra-backed xrefs into the agent decomp workflow via a fast SQLite cache.

**Architecture:** Three phases. Phase 1 fixes the bugs that prevent any command from running (auto-detect install, fix API bug, move project to central config dir). Phase 2 builds a SQLite cache (~/.config/decomp-me/ghidra.db) populated once from the project, then queried directly by the CLI — this avoids the ~20s JVM startup per call and makes the tool agent-usable. Phase 3 wires xrefs into existing skills (`/decomp-fixup`, `/understand`) so agents actually invoke it.

**Tech Stack:** Python 3.11, Typer (CLI), pyghidra 3.0.2, Ghidra 12.0.1 (Homebrew), SQLite (cache), pytest (tests). Existing patterns from `tools/melee-agent/src/cli/_common.py` (DECOMP_CONFIG_DIR, _detect_melee_root).

---

## Context for engineer with no project history

Read first before starting:

- The current state of `tools/melee-agent/src/cli/ghidra.py` — five bugs documented in `docs/superpowers/plans/2026-05-16-ghidra-skill-revival.md` (this file's "Diagnosis" section below).
- `tools/melee-agent/src/cli/_common.py` — has `DECOMP_CONFIG_DIR = ~/.config/decomp-me/`, `_detect_melee_root()`, and `BASE_DOL_PATH` patterns we'll reuse.
- `tools/melee-agent/tests/test_common.py` — example pytest fixture pattern.
- The skill itself: `.claude/skills/ghidra/SKILL.md` — sets user-facing expectations; will be updated in Phase 3.

### Diagnosis of current state (verified)

1. **`GHIDRA_INSTALL_DIR` unset**, and the obvious value `/opt/homebrew/Cellar/ghidra/12.0.1` is *wrong* — pyghidra needs `<that>/libexec`.
2. **No populated Ghidra project.** `orig/GALE01/sys/main.dol_ghidra/main.dol_ghidra.gpr` exists but contains zero programs (placeholder `~index.dat` only).
3. **API bug in 3 of 4 commands.** `ghidra_xrefs`, `ghidra_strings`, `ghidra_func` call `project.getRootFolder()` directly; only `ghidra_decompile` correctly uses `project.getProjectData().getRootFolder()`.
4. **Brittle DOL discovery.** Hardcoded `/Users/mike/code/melee` fallback in `_get_dol_path()`.
5. **GameCubeLoader headless bug still present** in Ghidra 12.0.1 — initial DOL import requires GUI (one-time step).

### Verified environment state

- pyghidra 3.0.2 installed
- Ghidra 12.0.1 installed via Homebrew at `/opt/homebrew/Cellar/ghidra/12.0.1/libexec`
- Java 21 installed at `/opt/homebrew/Cellar/openjdk@21/21.0.9`
- GameCubeLoader extension jar present at `/opt/homebrew/Cellar/ghidra/12.0.1/libexec/Ghidra/Extensions/GameCubeLoader/lib/GameCubeLoader.jar`
- DOL at `/Users/mike/code/melee/orig/GALE01/sys/main.dol`

---

## File Structure

The current `tools/melee-agent/src/cli/ghidra.py` (632 lines) will be split into a package as part of Phase 2 when we add cache code (would otherwise grow to ~900 lines).

```
tools/melee-agent/src/cli/ghidra/
├── __init__.py     # Public typer app, re-exports
├── cli.py          # Command implementations (status, setup, decompile, xrefs, strings, func, cache)
├── detect.py       # Auto-detect Ghidra install, Java, validate via application.properties
├── project.py      # Project path resolution and open helpers
└── cache.py        # SQLite cache schema, build, and query functions
```

Tests:

```
tools/melee-agent/tests/
├── test_ghidra_detect.py   # Unit tests for install/Java detection (tmpdir mocks)
├── test_ghidra_cache.py    # Cache schema + query tests (sqlite in-memory)
└── test_ghidra_project.py  # Project path resolution tests
```

Cache database: `~/.config/decomp-me/ghidra.db` (alongside `agent_state.db`).

Project location (new canonical): `~/.config/decomp-me/ghidra/melee/` (one project shared across all worktrees).

Skill files to update in Phase 3:

```
.claude/skills/ghidra/SKILL.md
.claude/skills/decomp-fixup/SKILL.md
.claude/skills/understand/SKILL.md
.claude/skills/decomp/SKILL.md
CLAUDE.md  (Getting Unstuck section)
```

---

## Phase 1: Make it work interactively

Goal: All four commands run without crashing, given a populated Ghidra project. No agent-facing changes yet.

### Task 1: Add Ghidra install detection with `application.properties` validation

**Files:**
- Create: `tools/melee-agent/src/cli/ghidra/detect.py`
- Create: `tools/melee-agent/tests/test_ghidra_detect.py`

- [ ] **Step 1: Write the failing test**

Create `tools/melee-agent/tests/test_ghidra_detect.py`:

```python
"""Tests for Ghidra install auto-detection."""
from pathlib import Path

import pytest


class TestDetectGhidraInstall:
    """Tests for detect_ghidra_install — finds a usable Ghidra install."""

    @pytest.fixture
    def detect(self):
        from src.cli.ghidra.detect import detect_ghidra_install
        return detect_ghidra_install

    def test_env_var_overrides_detection(self, detect, tmp_path, monkeypatch):
        """GHIDRA_INSTALL_DIR (if valid) takes precedence over auto-detection."""
        # Build a valid Ghidra install layout
        install = tmp_path / "ghidra_install"
        install.mkdir()
        (install / "application.properties").write_text("application.name=Ghidra\n")
        monkeypatch.setenv("GHIDRA_INSTALL_DIR", str(install))
        assert detect() == install

    def test_invalid_env_var_falls_through_to_detection(self, detect, tmp_path, monkeypatch):
        """A non-Ghidra GHIDRA_INSTALL_DIR is ignored; detection continues."""
        monkeypatch.setenv("GHIDRA_INSTALL_DIR", str(tmp_path))  # no application.properties
        # No homebrew etc. installed in test env → returns None
        # Patch the search paths to empty
        from src.cli.ghidra import detect as detect_mod
        monkeypatch.setattr(detect_mod, "_SEARCH_PATHS", [])
        assert detect() is None

    def test_finds_homebrew_install(self, detect, tmp_path, monkeypatch):
        """Detects a Ghidra install under a homebrew-shaped path."""
        # Simulate /opt/homebrew/Cellar/ghidra/12.0.1/libexec layout
        cellar = tmp_path / "Cellar" / "ghidra"
        install = cellar / "12.0.1" / "libexec"
        install.mkdir(parents=True)
        (install / "application.properties").write_text("application.name=Ghidra\n")

        monkeypatch.delenv("GHIDRA_INSTALL_DIR", raising=False)
        from src.cli.ghidra import detect as detect_mod
        monkeypatch.setattr(detect_mod, "_SEARCH_PATHS", [cellar])
        assert detect() == install

    def test_validates_via_application_properties(self, detect, tmp_path, monkeypatch):
        """A directory without application.properties is not a valid install."""
        fake = tmp_path / "fake_ghidra"
        fake.mkdir()
        monkeypatch.setenv("GHIDRA_INSTALL_DIR", str(fake))
        assert detect() is None
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_detect.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.cli.ghidra.detect'`

- [ ] **Step 3: Implement detection**

Create `tools/melee-agent/src/cli/ghidra/__init__.py`:

```python
"""Ghidra integration package."""
from .cli import ghidra_app

__all__ = ["ghidra_app"]
```

Create `tools/melee-agent/src/cli/ghidra/detect.py`:

```python
"""Auto-detect Ghidra install and Java for pyghidra."""
import os
from pathlib import Path

# Common installation root paths to search.
# A valid install has `application.properties` directly inside it.
# For Homebrew, this lives at /opt/homebrew/Cellar/ghidra/<version>/libexec
# For tarball installs, this lives at /Applications/ghidra_<version>_PUBLIC
_SEARCH_PATHS: list[Path] = [
    Path("/opt/homebrew/Cellar/ghidra"),       # macOS arm64 Homebrew
    Path("/usr/local/Cellar/ghidra"),          # macOS x86_64 Homebrew
    Path("/Applications"),                      # macOS manual install
    Path.home() / "Library" / "ghidra",        # macOS user-local
    Path("/opt"),                               # Linux manual install
    Path.home() / "ghidra",                    # user home tarball
]


def _is_valid_install(path: Path) -> bool:
    return path.is_dir() and (path / "application.properties").is_file()


def _search_path(root: Path) -> Path | None:
    """Find a valid install under `root`.

    Looks for `application.properties` directly under `root` or under
    `root/*` or `root/*/libexec` (Homebrew's nested layout).
    """
    if not root.exists():
        return None

    if _is_valid_install(root):
        return root

    for child in sorted(root.iterdir(), reverse=True):  # newest version first
        if not child.is_dir():
            continue
        if _is_valid_install(child):
            return child
        nested = child / "libexec"
        if _is_valid_install(nested):
            return nested
        # Some installs have Ghidra/Ghidra layout
        nested2 = child / "Ghidra"
        if _is_valid_install(nested2):
            return nested2

    return None


def detect_ghidra_install() -> Path | None:
    """Return path to a valid Ghidra install, or None if not found.

    Search order:
    1. $GHIDRA_INSTALL_DIR if set and valid
    2. Common installation roots
    """
    env_val = os.environ.get("GHIDRA_INSTALL_DIR")
    if env_val:
        env_path = Path(env_val)
        if _is_valid_install(env_path):
            return env_path

    for root in _SEARCH_PATHS:
        found = _search_path(root)
        if found is not None:
            return found

    return None
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_detect.py -v`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/ tools/melee-agent/tests/test_ghidra_detect.py
git commit -m "$(cat <<'EOF'
ghidra: add install auto-detection with application.properties validation

Searches Homebrew Cellar (macOS), /Applications, ~/Library/ghidra, and
/opt for valid Ghidra installs. Validates each candidate by checking
for application.properties — the file that pyghidra requires.

Honors GHIDRA_INSTALL_DIR as an override, but only if it points at a
valid install; otherwise falls through to auto-detection. This avoids
the previous failure mode where users set the env var to the wrong
homebrew path (e.g. /opt/homebrew/Cellar/ghidra/12.0.1 instead of
.../libexec).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add canonical project path resolver

**Files:**
- Create: `tools/melee-agent/src/cli/ghidra/project.py`
- Create: `tools/melee-agent/tests/test_ghidra_project.py`

- [ ] **Step 1: Write the failing test**

Create `tools/melee-agent/tests/test_ghidra_project.py`:

```python
"""Tests for Ghidra project path resolution."""
from pathlib import Path

import pytest


class TestProjectPath:
    """Tests for ghidra_project_dir and ghidra_project_name."""

    def test_project_dir_is_under_decomp_config(self, monkeypatch, tmp_path):
        """Project lives in $DECOMP_CONFIG_DIR/ghidra by default."""
        monkeypatch.setattr("src.cli.ghidra.project.DECOMP_CONFIG_DIR", tmp_path)
        from src.cli.ghidra.project import ghidra_project_dir
        assert ghidra_project_dir() == tmp_path / "ghidra"

    def test_project_name_is_melee(self):
        from src.cli.ghidra.project import GHIDRA_PROJECT_NAME
        assert GHIDRA_PROJECT_NAME == "melee"

    def test_is_project_populated_returns_false_for_missing(self, tmp_path):
        from src.cli.ghidra.project import is_project_populated
        assert is_project_populated(tmp_path) is False

    def test_is_project_populated_returns_false_for_empty(self, tmp_path):
        """A .gpr+placeholder layout with no real program is not populated."""
        (tmp_path / "melee.gpr").touch()
        rep = tmp_path / "melee.rep" / "idata"
        rep.mkdir(parents=True)
        (rep / "~index.dat").write_bytes(b"\x00" * 16)  # placeholder
        from src.cli.ghidra.project import is_project_populated
        assert is_project_populated(tmp_path) is False

    def test_is_project_populated_returns_true_with_program_data(self, tmp_path):
        """An idata folder with non-placeholder files indicates a real program."""
        (tmp_path / "melee.gpr").touch()
        rep = tmp_path / "melee.rep" / "idata"
        rep.mkdir(parents=True)
        # Real Ghidra programs leave hex-named subdirectories under idata
        (rep / "00").mkdir()
        (rep / "00" / "0000000001.f").write_bytes(b"fake program data" * 100)
        from src.cli.ghidra.project import is_project_populated
        assert is_project_populated(tmp_path) is True
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_project.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'src.cli.ghidra.project'`

- [ ] **Step 3: Implement**

Create `tools/melee-agent/src/cli/ghidra/project.py`:

```python
"""Ghidra project location and validation."""
from pathlib import Path

from .._common import DECOMP_CONFIG_DIR

GHIDRA_PROJECT_NAME = "melee"


def ghidra_project_dir() -> Path:
    """Canonical Ghidra project directory.

    Shared across all worktrees — Ghidra projects are large (hundreds of MB)
    and the analyzed DOL doesn't change.
    """
    return DECOMP_CONFIG_DIR / "ghidra"


def ghidra_project_gpr() -> Path:
    """Path to the .gpr project file."""
    return ghidra_project_dir() / f"{GHIDRA_PROJECT_NAME}.gpr"


def is_project_populated(project_dir: Path) -> bool:
    """Check whether the project actually contains imported program data.

    Distinguishes a real populated project from an empty placeholder:
    Ghidra creates `.rep/idata/~index.dat` even for empty projects, but a
    real program adds hex-named subdirectories with file data.
    """
    gpr = next(project_dir.glob("*.gpr"), None)
    if gpr is None:
        return False
    rep = project_dir / f"{gpr.stem}.rep" / "idata"
    if not rep.exists():
        return False
    for entry in rep.iterdir():
        if entry.is_dir() and entry.name != "user":
            # Hex-named subdirs indicate imported program data
            return True
    return False
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_project.py -v`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/project.py tools/melee-agent/tests/test_ghidra_project.py
git commit -m "$(cat <<'EOF'
ghidra: add canonical project path + populated check

Project now lives at ~/.config/decomp-me/ghidra/melee (alongside
agent_state.db). Shared across all worktrees — Ghidra projects are
hundreds of MB and the DOL is immutable, so duplicating per worktree
would waste disk and require redundant analysis.

is_project_populated() checks for real imported program data
(hex-named idata subdirectories), distinguishing populated projects
from the empty .gpr+placeholder layout that Ghidra creates on
project creation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Move ghidra.py contents into the package, fix API bug

**Files:**
- Delete: `tools/melee-agent/src/cli/ghidra.py`
- Create: `tools/melee-agent/src/cli/ghidra/cli.py`
- Modify: `tools/melee-agent/src/cli/__init__.py` (import path stays the same — `from .ghidra import ghidra_app`)

- [ ] **Step 1: Move cli content into the package**

The existing import in `cli/__init__.py` already says `from .ghidra import ghidra_app`. Because we've created `cli/ghidra/__init__.py` that re-exports `ghidra_app`, the import path stays the same once `cli/ghidra.py` is removed.

```bash
git mv tools/melee-agent/src/cli/ghidra.py tools/melee-agent/src/cli/ghidra/cli.py
```

- [ ] **Step 2: Update imports inside cli.py**

In `tools/melee-agent/src/cli/ghidra/cli.py`, update the relative import:

Find: `from ._common import console, get_agent_melee_root`
Replace with: `from .._common import console, get_agent_melee_root`

- [ ] **Step 3: Fix the getRootFolder() API bug**

In `tools/melee-agent/src/cli/ghidra/cli.py`, find each of the 3 occurrences of:

```python
programs = list(project.getRootFolder().getFiles())
```

(inside `ghidra_xrefs`, `ghidra_strings`, and `ghidra_func`)

Replace each with:

```python
programs = list(project.getProjectData().getRootFolder().getFiles())
```

Also, in each of the 3 callers, the line `program = domain_file.getDomainObject()` should be replaced with the same call shape used in `ghidra_decompile`:

```python
from ghidra.util.task import TaskMonitor
program = domain_file.getDomainObject(project, False, False, TaskMonitor.DUMMY)
```

(Currently `ghidra_xrefs`, `ghidra_strings`, `ghidra_func` call `getDomainObject()` with zero args; the no-arg form was deprecated. Match the call shape used in `ghidra_decompile`.)

- [ ] **Step 4: Verify the package still loads**

Run: `cd tools/melee-agent && python -c "from src.cli.ghidra import ghidra_app; print('ok')"`
Expected: `ok`

Run: `cd tools/melee-agent && melee-agent ghidra --help`
Expected: typer help output listing `status`, `setup`, `decompile`, `xrefs`, `strings`, `func`

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/
git commit -m "$(cat <<'EOF'
ghidra: split cli into package, fix getRootFolder API bug

Moves cli/ghidra.py → cli/ghidra/cli.py inside the new package. The
public import (cli/__init__.py: from .ghidra import ghidra_app) is
unchanged.

Fixes the AttributeError that broke 3 of 4 commands: xrefs, strings,
and func called project.getRootFolder() directly, which fails with
'DefaultProject has no attribute getRootFolder'. Only decompile was
using the correct project.getProjectData().getRootFolder() path.

Also fixes the deprecated no-arg getDomainObject() call in those three
commands to match the call shape used in decompile (with TaskMonitor).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire detect.py and project.py into the cli

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py`

- [ ] **Step 1: Replace `_check_ghidra_prereqs` with detection**

In `tools/melee-agent/src/cli/ghidra/cli.py`, find the existing `_check_ghidra_prereqs` function (around lines 37-52) and replace it with:

```python
from .detect import detect_ghidra_install


def _check_ghidra_prereqs() -> tuple[bool, str]:
    """Check if Ghidra prerequisites are met."""
    install = detect_ghidra_install()
    if install is None:
        env_val = os.environ.get("GHIDRA_INSTALL_DIR")
        if env_val:
            return False, (
                f"GHIDRA_INSTALL_DIR={env_val} is not a valid Ghidra install "
                f"(no application.properties). Unset it or point at the libexec dir."
            )
        return False, (
            "Ghidra not found. Install via 'brew install ghidra' or set "
            "GHIDRA_INSTALL_DIR to the directory containing application.properties."
        )

    # Ensure pyghidra finds the install via env var
    os.environ["GHIDRA_INSTALL_DIR"] = str(install)

    try:
        import pyghidra  # noqa: F401
        return True, f"Ghidra: {install}"
    except ImportError:
        return False, "pyghidra not installed. Run: pip install pyghidra"
```

- [ ] **Step 2: Replace `_get_project_path` with the canonical resolver**

In `tools/melee-agent/src/cli/ghidra/cli.py`, find `_get_project_path()` (around lines 80-90) and replace with:

```python
from .project import ghidra_project_dir, GHIDRA_PROJECT_NAME, is_project_populated


def _get_project_path() -> Path:
    """Get the canonical Ghidra project directory."""
    return ghidra_project_dir()
```

Then update every callsite where the project is opened. Find each:

```python
with pyghidra.open_project(str(project_path), "melee") as project:
```

(There are 4 such callsites — one per command.) Replace with:

```python
with pyghidra.open_project(str(project_path), GHIDRA_PROJECT_NAME) as project:
```

- [ ] **Step 3: Verify the cli still loads**

Run: `cd tools/melee-agent && melee-agent ghidra status`
Expected: `✓ Ghidra: /opt/homebrew/Cellar/ghidra/12.0.1/libexec` followed by `! No Ghidra project.` (because we haven't populated the canonical path yet)

- [ ] **Step 4: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: wire auto-detection + canonical project path into cli

_check_ghidra_prereqs() now uses detect_ghidra_install() rather than
trusting GHIDRA_INSTALL_DIR blindly. When a user has the env var set
to an invalid path, the error message tells them exactly what's
wrong instead of the cryptic "Corrupt Ghidra Installation" from
pyghidra.

Project path resolution now lives in project.py — single source of
truth at ~/.config/decomp-me/ghidra/melee, shared across worktrees.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fix DOL path discovery

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py`

- [ ] **Step 1: Replace `_get_dol_path` with one that uses existing helpers**

In `tools/melee-agent/src/cli/ghidra/cli.py`, find `_get_dol_path()` (around lines 93-108) and replace with:

```python
from .._common import get_base_dol_path, get_agent_melee_root


def _get_dol_path() -> Path:
    """Resolve the DOL binary.

    Prefers the central config location (~/.config/decomp-me/orig/...),
    then falls back to the canonical melee repo root's orig/ tree.
    Worktrees usually do NOT have orig/ populated (gitignored).
    """
    central = get_base_dol_path()
    if central is not None:
        return central

    melee_root = get_agent_melee_root()
    for candidate in (
        melee_root / "orig" / "GALE01" / "sys" / "main.dol",
        melee_root / "baserom.dol",
        melee_root / "build" / "GALE01" / "main.dol",
    ):
        if candidate.exists():
            return candidate

    # Return first candidate so the error message points somewhere useful
    return melee_root / "orig" / "GALE01" / "sys" / "main.dol"
```

- [ ] **Step 2: Run status to verify DOL is found**

Run: `cd tools/melee-agent && melee-agent ghidra status`
Expected: `✓ DOL binary: /Users/mike/code/melee/orig/GALE01/sys/main.dol` (or central path if `BASE_DOL_PATH` is configured)

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: use canonical DOL resolution

Removes the hardcoded /Users/mike/code/melee fallback. Uses
get_base_dol_path() and get_agent_melee_root() — the same helpers
the rest of the CLI uses. Works in worktrees by walking up to the
real repo root rather than relying on a username-specific path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Improve `ghidra status` output

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (the `ghidra_status` function)

- [ ] **Step 1: Replace the `ghidra_status` function**

Find `def ghidra_status()` and replace its body with:

```python
@ghidra_app.command("status")
def ghidra_status():
    """Check Ghidra installation, project, and DOL availability."""
    rows: list[tuple[str, str, str]] = []  # (state, label, detail)

    # Install
    install = detect_ghidra_install()
    if install is not None:
        rows.append(("ok", "Ghidra install", str(install)))
        os.environ["GHIDRA_INSTALL_DIR"] = str(install)
    else:
        rows.append((
            "fail", "Ghidra install",
            "not found — install with 'brew install ghidra' or download from ghidra-sre.org"
        ))

    # pyghidra
    try:
        import pyghidra
        rows.append(("ok", "pyghidra", getattr(pyghidra, "__version__", "installed")))
    except ImportError:
        rows.append(("fail", "pyghidra", "not installed — run 'pip install pyghidra'"))

    # DOL
    dol = _get_dol_path()
    if dol.exists():
        rows.append(("ok", "DOL binary", str(dol)))
    else:
        rows.append(("fail", "DOL binary", f"not found at {dol}"))

    # Project
    project_path = _get_project_path()
    gpr = project_path / f"{GHIDRA_PROJECT_NAME}.gpr"
    if gpr.exists():
        if is_project_populated(project_path):
            rows.append(("ok", "Ghidra project", f"{project_path} (populated)"))
        else:
            rows.append((
                "warn", "Ghidra project",
                f"{project_path} (empty — DOL not imported; run 'melee-agent ghidra setup')"
            ))
    else:
        rows.append((
            "warn", "Ghidra project",
            f"missing at {project_path} — run 'melee-agent ghidra setup'"
        ))

    # Cache (will be populated in Phase 2)
    cache_db = DECOMP_CONFIG_DIR / "ghidra.db"
    if cache_db.exists():
        size_mb = cache_db.stat().st_size / 1024 / 1024
        rows.append(("ok", "Cache DB", f"{cache_db} ({size_mb:.1f} MB)"))
    else:
        rows.append((
            "warn", "Cache DB",
            "not built — run 'melee-agent ghidra cache-build' for fast xrefs/strings"
        ))

    for state, label, detail in rows:
        icon = {"ok": "[green]✓[/green]", "warn": "[yellow]![/yellow]", "fail": "[red]✗[/red]"}[state]
        console.print(f"{icon} [bold]{label}[/bold]: {detail}")
```

Also add at top of file:

```python
from .._common import DECOMP_CONFIG_DIR
```

- [ ] **Step 2: Run and verify**

Run: `cd tools/melee-agent && melee-agent ghidra status`
Expected: A 5-row table with `✓` for install, pyghidra, DOL; `!` for project (until populated) and cache DB.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: rewrite status with per-component results

The previous status command treated missing-env-var as a hard error
that prevented further checks. Now each prerequisite (install,
pyghidra, DOL, project, cache) is checked independently and its
state shown with a clear icon and remediation hint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Rewrite `ghidra setup` to guide GUI import

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (the `ghidra_setup` function)

- [ ] **Step 1: Replace `ghidra_setup`**

The GameCubeLoader headless bug is still present in Ghidra 12.0.1 (verified). The setup command should ensure the canonical project directory exists, then print explicit GUI instructions and validate the result.

Find `def ghidra_setup` and replace its body with:

```python
@ghidra_app.command("setup")
def ghidra_setup():
    """Guide one-time Ghidra project creation (manual GUI import).

    The GameCubeLoader has a headless-mode bug (DOLProgramBuilder pops an
    OptionDialog) so the initial DOL import must happen via the Ghidra GUI.
    This command:
      1. Ensures the project directory exists
      2. Prints exact GUI steps to follow
      3. Validates the result
    """
    install = detect_ghidra_install()
    if install is None:
        console.print("[red]Ghidra install not found.[/red] Run 'brew install ghidra' first.")
        raise typer.Exit(1)

    dol = _get_dol_path()
    if not dol.exists():
        console.print(f"[red]DOL not found at {dol}.[/red]")
        console.print("Place the GALE01 main.dol at ~/.config/decomp-me/orig/GALE01/main.dol")
        raise typer.Exit(1)

    project_path = _get_project_path()
    project_path.mkdir(parents=True, exist_ok=True)

    expected_gpr = project_path / f"{GHIDRA_PROJECT_NAME}.gpr"

    if expected_gpr.exists() and is_project_populated(project_path):
        console.print(f"[green]✓[/green] Project already populated: {expected_gpr}")
        return

    ghidra_run = install.parent / "bin" / "ghidraRun"
    if not ghidra_run.exists():
        # Homebrew exposes ghidraRun at /opt/homebrew/bin/ghidraRun
        ghidra_run = Path("/opt/homebrew/bin/ghidraRun")

    console.print(Panel.fit(
        f"""[bold]One-time Ghidra setup required[/bold]

The GameCubeLoader has a headless-mode bug, so the initial DOL
import must be done via the Ghidra GUI.

[cyan]1.[/cyan] Launch Ghidra:
   [dim]{ghidra_run} &[/dim]

[cyan]2.[/cyan] Create the project:
   File → New Project → Non-Shared Project
   Location: [green]{project_path.parent}[/green]
   Name:     [green]{GHIDRA_PROJECT_NAME}[/green]

[cyan]3.[/cyan] Import the DOL:
   File → Import File → [green]{dol}[/green]
   Loader: [green]Nintendo GameCube/Wii Binary[/green] (the GameCubeLoader extension)
   Click [green]OK[/green] on the loader options dialog.

[cyan]4.[/cyan] Wait for analysis to complete (5-10 minutes).

[cyan]5.[/cyan] Close Ghidra, then re-run this command to validate:
   [green]melee-agent ghidra setup[/green]
""",
        title="Manual Step Required",
    ))
```

Add at top of file: `from rich.panel import Panel` (it's already imported in the original, just verify).

- [ ] **Step 2: Run to verify the guidance shows correctly**

Run: `cd tools/melee-agent && melee-agent ghidra setup`
Expected: A panel with the GUI steps.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: rewrite setup as guided one-time GUI import

The GameCubeLoader still has a headless-mode bug in Ghidra 12.0.1
(verified: DOLProgramBuilder.load() pops an OptionDialog that
deadlocks analyzeHeadless). Setup now:

  - Ensures the canonical project dir exists
  - Prints exact GUI steps
  - Validates the populated state on re-run

Idempotent: re-running after a successful import is a no-op that
confirms the project is good.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 checkpoint

After Task 7 commits, run:

```bash
cd tools/melee-agent
pytest tests/test_ghidra_detect.py tests/test_ghidra_project.py -v
melee-agent ghidra status
```

Expected: All tests pass. `status` shows install/pyghidra/DOL as `✓` and project as `!`.

**HUMAN ACTION REQUIRED before Phase 2:**

The user must run `melee-agent ghidra setup` and complete the GUI-driven import. This populates `~/.config/decomp-me/ghidra/melee.gpr` with the analyzed program. Until that's done, Phase 2 cache-build cannot run.

Confirm with `melee-agent ghidra status` showing `✓ Ghidra project: ... (populated)` before continuing.

---

## Phase 2: SQLite cache for agent-fast queries

Goal: One-time `cache-build` populates `~/.config/decomp-me/ghidra.db`. Subsequent xrefs/strings/func queries hit SQLite (<1ms), not JVM. Decompile keeps the heavy live-Ghidra path.

### Task 8: Cache schema

**Files:**
- Create: `tools/melee-agent/src/cli/ghidra/cache.py`
- Create: `tools/melee-agent/tests/test_ghidra_cache.py`

- [ ] **Step 1: Write the failing test**

Create `tools/melee-agent/tests/test_ghidra_cache.py`:

```python
"""Tests for ghidra SQLite cache schema and queries."""
import sqlite3
from pathlib import Path

import pytest


@pytest.fixture
def db(tmp_path) -> Path:
    """A freshly-initialized cache database."""
    from src.cli.ghidra.cache import init_schema
    db_path = tmp_path / "ghidra.db"
    init_schema(db_path)
    return db_path


class TestSchema:
    def test_schema_creates_expected_tables(self, db):
        conn = sqlite3.connect(db)
        try:
            tables = {
                r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
        finally:
            conn.close()
        assert {"functions", "xrefs", "strings"} <= tables

    def test_xrefs_has_address_indexes(self, db):
        conn = sqlite3.connect(db)
        try:
            idxs = {
                r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='index'"
                )
            }
        finally:
            conn.close()
        assert any("xrefs" in i and "from" in i for i in idxs)
        assert any("xrefs" in i and "to" in i for i in idxs)


class TestInsertAndQuery:
    def test_insert_and_query_callers(self, db):
        from src.cli.ghidra.cache import insert_function, insert_xref, get_callers
        insert_function(db, addr=0x80243a3c, name="fn_target", size=64)
        insert_function(db, addr=0x80100000, name="fn_caller_a", size=32)
        insert_function(db, addr=0x80200000, name="fn_caller_b", size=32)
        insert_xref(db, from_addr=0x80100004, to_addr=0x80243a3c, ref_type="CALL")
        insert_xref(db, from_addr=0x80200008, to_addr=0x80243a3c, ref_type="CALL")
        callers = get_callers(db, 0x80243a3c)
        assert len(callers) == 2
        caller_names = {c["from_function"] for c in callers}
        assert caller_names == {"fn_caller_a", "fn_caller_b"}

    def test_query_callees(self, db):
        from src.cli.ghidra.cache import insert_function, insert_xref, get_callees
        insert_function(db, addr=0x80100000, name="fn_caller", size=128)
        insert_function(db, addr=0x80200000, name="fn_a", size=16)
        insert_function(db, addr=0x80300000, name="fn_b", size=16)
        insert_xref(db, from_addr=0x80100010, to_addr=0x80200000, ref_type="CALL")
        insert_xref(db, from_addr=0x80100020, to_addr=0x80300000, ref_type="CALL")
        callees = get_callees(db, 0x80100000)
        callee_names = {c["to_function"] for c in callees}
        assert callee_names == {"fn_a", "fn_b"}

    def test_strings_in_function(self, db):
        from src.cli.ghidra.cache import insert_function, insert_string, insert_xref, get_strings_for_function
        insert_function(db, addr=0x80100000, name="fn_caller", size=128)
        insert_string(db, addr=0x80400000, value="Hello, world")
        insert_string(db, addr=0x80400020, value="Goodbye")
        insert_xref(db, from_addr=0x80100008, to_addr=0x80400000, ref_type="DATA")
        insert_xref(db, from_addr=0x80100010, to_addr=0x80400020, ref_type="DATA")
        strings = get_strings_for_function(db, 0x80100000)
        assert set(strings) == {"Hello, world", "Goodbye"}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_cache.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement schema + insert + query**

Create `tools/melee-agent/src/cli/ghidra/cache.py`:

```python
"""SQLite cache for Ghidra-derived data.

Built once via `melee-agent ghidra cache-build`; queried by xrefs/strings/func
commands without starting the JVM. Approx 200k rows total, single-file <50MB.
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .._common import DECOMP_CONFIG_DIR

CACHE_DB_PATH = DECOMP_CONFIG_DIR / "ghidra.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS functions (
    addr        INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    size        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS xrefs (
    from_addr   INTEGER NOT NULL,
    to_addr     INTEGER NOT NULL,
    ref_type    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS xrefs_to_idx   ON xrefs (to_addr);
CREATE INDEX IF NOT EXISTS xrefs_from_idx ON xrefs (from_addr);

CREATE TABLE IF NOT EXISTS strings (
    addr        INTEGER PRIMARY KEY,
    value       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);
"""


def init_schema(db_path: Path) -> None:
    """Create the schema. Idempotent."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with _connect(db_path) as conn:
        conn.executescript(_SCHEMA)


@contextmanager
def _connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def insert_function(db_path: Path, *, addr: int, name: str, size: int) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO functions(addr, name, size) VALUES (?, ?, ?)",
            (addr, name, size),
        )


def insert_xref(db_path: Path, *, from_addr: int, to_addr: int, ref_type: str) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO xrefs(from_addr, to_addr, ref_type) VALUES (?, ?, ?)",
            (from_addr, to_addr, ref_type),
        )


def insert_string(db_path: Path, *, addr: int, value: str) -> None:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO strings(addr, value) VALUES (?, ?)",
            (addr, value),
        )


def get_function(db_path: Path, addr: int) -> dict | None:
    """Get function metadata at or containing addr."""
    with _connect(db_path) as conn:
        # Try exact match first
        row = conn.execute(
            "SELECT addr, name, size FROM functions WHERE addr = ?",
            (addr,),
        ).fetchone()
        if row is not None:
            return dict(row)
        # Fall back to range scan: a function containing addr
        row = conn.execute(
            "SELECT addr, name, size FROM functions "
            "WHERE addr <= ? AND addr + size > ? "
            "ORDER BY addr DESC LIMIT 1",
            (addr, addr),
        ).fetchone()
        return dict(row) if row else None


def get_callers(db_path: Path, addr: int) -> list[dict]:
    """Functions that call `addr`.

    Returns one row per (from_addr) site, joined with the containing
    function so callers display names instead of raw addresses.
    """
    with _connect(db_path) as conn:
        return [
            dict(r) for r in conn.execute(
                """
                SELECT
                    x.from_addr AS from_addr,
                    x.ref_type  AS ref_type,
                    f.addr      AS from_function_addr,
                    COALESCE(f.name, 'unknown') AS from_function
                FROM xrefs x
                LEFT JOIN functions f
                    ON f.addr <= x.from_addr AND f.addr + f.size > x.from_addr
                WHERE x.to_addr = ?
                ORDER BY x.from_addr
                """,
                (addr,),
            )
        ]


def get_callees(db_path: Path, addr: int) -> list[dict]:
    """Functions called from inside the function at `addr`.

    Joins xref destinations back to functions; returns unique callee names.
    """
    with _connect(db_path) as conn:
        return [
            dict(r) for r in conn.execute(
                """
                SELECT DISTINCT
                    target.addr AS to_function_addr,
                    target.name AS to_function,
                    x.ref_type  AS ref_type
                FROM functions caller
                JOIN xrefs x
                    ON x.from_addr >= caller.addr
                   AND x.from_addr <  caller.addr + caller.size
                JOIN functions target
                    ON target.addr = x.to_addr
                WHERE caller.addr = ?
                ORDER BY target.addr
                """,
                (addr,),
            )
        ]


def get_strings_for_function(db_path: Path, addr: int) -> list[str]:
    """Strings referenced from inside the function at `addr`."""
    with _connect(db_path) as conn:
        return [
            r["value"] for r in conn.execute(
                """
                SELECT DISTINCT s.value AS value
                FROM functions caller
                JOIN xrefs x
                    ON x.from_addr >= caller.addr
                   AND x.from_addr <  caller.addr + caller.size
                JOIN strings s
                    ON s.addr = x.to_addr
                WHERE caller.addr = ?
                """,
                (addr,),
            )
        ]


def search_strings(db_path: Path, pattern: str, limit: int = 50) -> list[dict]:
    """Find strings whose value matches the LIKE pattern (case-insensitive)."""
    with _connect(db_path) as conn:
        like = f"%{pattern}%"
        return [
            dict(r) for r in conn.execute(
                "SELECT addr, value FROM strings WHERE value LIKE ? "
                "ORDER BY addr LIMIT ?",
                (like, limit),
            )
        ]
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_cache.py -v`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cache.py tools/melee-agent/tests/test_ghidra_cache.py
git commit -m "$(cat <<'EOF'
ghidra: add SQLite cache for fast xref/string queries

Lives at ~/.config/decomp-me/ghidra.db (alongside agent_state.db).
Schema: functions(addr, name, size), xrefs(from, to, type),
strings(addr, value), plus indexes on xrefs.from/to.

Includes insert helpers and the three queries agents need:
get_callers, get_callees, get_strings_for_function. Range-join via
functions(addr, addr+size) maps xref endpoints to containing
functions, so callers/callees display names not raw addresses.

JVM startup cost drops from ~20s per query to ~0ms; same data, just
materialized.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Cache build command

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (add `cache_build` command)
- Modify: `tools/melee-agent/src/cli/ghidra/cache.py` (add `build_from_project`)

- [ ] **Step 1: Add `build_from_project` to cache.py**

Append to `tools/melee-agent/src/cli/ghidra/cache.py`:

```python
def build_from_project(db_path: Path, project_dir: Path, project_name: str) -> dict[str, int]:
    """Populate the cache from a Ghidra project.

    Returns counts of inserted rows: {functions, xrefs, strings}.
    Caller is responsible for ensuring pyghidra is initialized.
    """
    import pyghidra
    from ghidra.util.task import TaskMonitor

    init_schema(db_path)

    counts = {"functions": 0, "xrefs": 0, "strings": 0}

    with pyghidra.open_project(str(project_dir), project_name) as project:
        files = list(project.getProjectData().getRootFolder().getFiles())
        if not files:
            raise RuntimeError(
                f"Project at {project_dir} has no programs imported. "
                f"Run 'melee-agent ghidra setup' first."
            )

        program = files[0].getDomainObject(project, False, False, TaskMonitor.DUMMY)
        try:
            func_mgr = program.getFunctionManager()
            ref_mgr = program.getReferenceManager()
            listing = program.getListing()

            # Bulk inserts: open one connection, batch
            db_path.parent.mkdir(parents=True, exist_ok=True)
            with _connect(db_path) as conn:
                conn.execute("DELETE FROM functions")
                conn.execute("DELETE FROM xrefs")
                conn.execute("DELETE FROM strings")

                # Functions
                for func in func_mgr.getFunctions(True):
                    body = func.getBody()
                    addr = int(func.getEntryPoint().getOffset())
                    size = int(body.getNumAddresses())
                    conn.execute(
                        "INSERT OR REPLACE INTO functions(addr, name, size) VALUES (?, ?, ?)",
                        (addr, str(func.getName()), size),
                    )
                    counts["functions"] += 1

                # Strings (must be cached before xrefs so we know which xref targets are strings)
                string_addrs: set[int] = set()
                for data in listing.getDefinedData(True):
                    if data.hasStringValue():
                        addr = int(data.getAddress().getOffset())
                        value = str(data.getValue())
                        conn.execute(
                            "INSERT OR REPLACE INTO strings(addr, value) VALUES (?, ?)",
                            (addr, value),
                        )
                        string_addrs.add(addr)
                        counts["strings"] += 1

                # Xrefs (only CALL/DATA — skip flow-internal stuff)
                # Iterate over functions, then over each function's body
                for func in func_mgr.getFunctions(True):
                    body = func.getBody()
                    addr_iter = body.getAddresses(True)
                    while addr_iter.hasNext():
                        cur_addr = addr_iter.next()
                        for ref in ref_mgr.getReferencesFrom(cur_addr):
                            to_addr = int(ref.getToAddress().getOffset())
                            ref_type = str(ref.getReferenceType())
                            # Keep CALL references and DATA references to strings only
                            if "CALL" in ref_type or to_addr in string_addrs:
                                conn.execute(
                                    "INSERT INTO xrefs(from_addr, to_addr, ref_type) VALUES (?, ?, ?)",
                                    (int(cur_addr.getOffset()), to_addr, ref_type),
                                )
                                counts["xrefs"] += 1

                # Mark cache as built
                from datetime import datetime, timezone
                conn.execute(
                    "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
                    ("built_at", datetime.now(timezone.utc).isoformat()),
                )
                conn.execute(
                    "INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)",
                    ("program_name", str(program.getName())),
                )
        finally:
            program.release(project)

    return counts
```

- [ ] **Step 2: Add `cache-build` typer command in cli.py**

In `tools/melee-agent/src/cli/ghidra/cli.py`, add (near the other commands):

```python
from .cache import CACHE_DB_PATH, build_from_project


@ghidra_app.command("cache-build")
def ghidra_cache_build(
    force: bool = typer.Option(False, "--force", "-f", help="Rebuild even if cache exists"),
):
    """Build the SQLite cache from the Ghidra project (one-time, ~minutes).

    Agents then query xrefs/strings/func against the cache without
    starting Ghidra each time.
    """
    if CACHE_DB_PATH.exists() and not force:
        console.print(
            f"[yellow]Cache already exists at {CACHE_DB_PATH}.[/yellow] "
            f"Use --force to rebuild."
        )
        raise typer.Exit(0)

    if not _init_ghidra():
        raise typer.Exit(1)

    project_path = _get_project_path()
    if not is_project_populated(project_path):
        console.print(
            f"[red]Project at {project_path} is not populated.[/red] "
            f"Run 'melee-agent ghidra setup' first."
        )
        raise typer.Exit(1)

    console.print(f"[dim]Building cache at {CACHE_DB_PATH} (this may take a few minutes)...[/dim]")
    counts = build_from_project(CACHE_DB_PATH, project_path, GHIDRA_PROJECT_NAME)
    console.print(
        f"[green]✓[/green] Cache built: "
        f"{counts['functions']} functions, "
        f"{counts['xrefs']} xrefs, "
        f"{counts['strings']} strings"
    )
```

- [ ] **Step 3: Verify the command appears**

Run: `cd tools/melee-agent && melee-agent ghidra cache-build --help`
Expected: typer help text for cache-build.

Run (after Phase 1 checkpoint complete, project populated): `melee-agent ghidra cache-build`
Expected: After 1-5 minutes, prints function/xref/string counts; database written at `~/.config/decomp-me/ghidra.db`.

- [ ] **Step 4: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cache.py tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: add cache-build command to populate ghidra.db from project

Single-pass walk over the Ghidra project: enumerate functions
(addr, name, size), strings (addr, value), and references (xrefs).
Only CALL refs and DATA refs that target known strings are kept —
that's what xrefs/strings queries need, no point caching every flow
arrow.

One-time cost ~minutes; subsequent queries become sub-millisecond
SQLite hits, removing the ~20s JVM startup that made the old CLI
shape unusable for agents.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Replace `ghidra xrefs` with cache-backed query

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (`ghidra_xrefs`)

- [ ] **Step 1: Replace the `ghidra_xrefs` function body**

Find `def ghidra_xrefs` and replace its body with:

```python
@ghidra_app.command("xrefs")
def ghidra_xrefs(
    address: Annotated[str, typer.Argument(help="Address to find references to/from")],
    direction: Annotated[str, typer.Option("--dir", "-d", help="'to' (callers) or 'from' (callees)")] = "to",
):
    """Find callers (--dir to) or callees (--dir from) via the cache.

    Examples:
        melee-agent ghidra xrefs 0x80243A3C            # who calls this
        melee-agent ghidra xrefs 0x80243A3C --dir from # what does this call
    """
    from .cache import CACHE_DB_PATH, get_callers, get_callees, get_function

    if not CACHE_DB_PATH.exists():
        console.print(
            "[red]Cache not built.[/red] Run [cyan]melee-agent ghidra cache-build[/cyan]."
        )
        raise typer.Exit(1)

    addr_str = address.lower().replace("0x", "")
    try:
        addr_int = int(addr_str, 16)
    except ValueError:
        console.print(f"[red]Invalid address:[/red] {address}")
        raise typer.Exit(1)

    if direction not in ("to", "from"):
        console.print(f"[red]Invalid direction:[/red] {direction} (use 'to' or 'from')")
        raise typer.Exit(1)

    func = get_function(CACHE_DB_PATH, addr_int)
    label = func["name"] if func else f"0x{addr_int:08X}"
    title = f"References {'to' if direction == 'to' else 'from'} {label}"

    table = Table(title=title)
    table.add_column("Address", style="cyan")
    table.add_column("Function", style="yellow")
    table.add_column("Type", style="dim")

    if direction == "to":
        for row in get_callers(CACHE_DB_PATH, addr_int):
            table.add_row(
                f"0x{row['from_addr']:08X}",
                row["from_function"],
                row["ref_type"],
            )
    else:
        if func is None:
            console.print(f"[yellow]No function at 0x{addr_int:08X}[/yellow]")
            raise typer.Exit(1)
        for row in get_callees(CACHE_DB_PATH, func["addr"]):
            table.add_row(
                f"0x{row['to_function_addr']:08X}",
                row["to_function"],
                row["ref_type"],
            )

    console.print(table)
```

- [ ] **Step 2: Smoke test**

Run: `cd tools/melee-agent && melee-agent ghidra xrefs 0x80243A3C`
Expected (after cache-build): a table of callers, or "No callers" if none.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: xrefs now queries the cache instead of starting the JVM

Drops query latency from ~20s (JVM cold start) to <1ms. Output
shape is identical to the previous implementation, so any tooling
or skills that parsed the table still work.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Replace `ghidra strings` with cache-backed query

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (`ghidra_strings`)

- [ ] **Step 1: Replace the function body**

Find `def ghidra_strings` and replace its body with:

```python
@ghidra_app.command("strings")
def ghidra_strings(
    address: Annotated[str | None, typer.Argument(help="Function address to search in")] = None,
    pattern: Annotated[str | None, typer.Option("--pattern", "-p", help="Search for strings matching pattern")] = None,
):
    """Find string references in a function, or search all strings by pattern."""
    from .cache import CACHE_DB_PATH, get_function, get_strings_for_function, search_strings

    if not CACHE_DB_PATH.exists():
        console.print("[red]Cache not built.[/red] Run [cyan]melee-agent ghidra cache-build[/cyan].")
        raise typer.Exit(1)

    if address:
        addr_str = address.lower().replace("0x", "")
        try:
            addr_int = int(addr_str, 16)
        except ValueError:
            console.print(f"[red]Invalid address:[/red] {address}")
            raise typer.Exit(1)
        func = get_function(CACHE_DB_PATH, addr_int)
        if func is None:
            console.print(f"[yellow]No function at 0x{addr_int:08X}[/yellow]")
            raise typer.Exit(1)
        table = Table(title=f"Strings in {func['name']}")
        table.add_column("String", style="green")
        for s in get_strings_for_function(CACHE_DB_PATH, func["addr"]):
            table.add_row(s[:120])
        console.print(table)
        return

    if pattern:
        table = Table(title=f"Strings matching '{pattern}'")
        table.add_column("Address", style="cyan")
        table.add_column("String", style="green")
        rows = search_strings(CACHE_DB_PATH, pattern, limit=50)
        for r in rows:
            table.add_row(f"0x{r['addr']:08X}", r["value"][:120])
        console.print(table)
        if len(rows) == 50:
            console.print("[dim]Showing first 50 results[/dim]")
        return

    console.print("[yellow]Specify an address or --pattern[/yellow]")
    raise typer.Exit(1)
```

- [ ] **Step 2: Smoke test**

Run: `cd tools/melee-agent && melee-agent ghidra strings --pattern assert`
Expected: A table of strings containing "assert" (case-insensitive).

Run: `melee-agent ghidra strings 0x80243A3C`
Expected: Strings referenced from inside that function, or empty.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: strings now queries the cache

Same query shapes as before — by function address, or by LIKE
pattern. Just cache-backed instead of JVM-backed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Replace `ghidra func` with cache-backed query

**Files:**
- Modify: `tools/melee-agent/src/cli/ghidra/cli.py` (`ghidra_func`)

- [ ] **Step 1: Replace the function body**

Find `def ghidra_func` and replace its body with:

```python
@ghidra_app.command("func")
def ghidra_func(
    address: Annotated[str, typer.Argument(help="Address to get function info")],
):
    """Get function metadata from the cache (name, size, callers/callees count)."""
    from .cache import CACHE_DB_PATH, get_function, get_callers, get_callees

    if not CACHE_DB_PATH.exists():
        console.print("[red]Cache not built.[/red] Run [cyan]melee-agent ghidra cache-build[/cyan].")
        raise typer.Exit(1)

    addr_str = address.lower().replace("0x", "")
    try:
        addr_int = int(addr_str, 16)
    except ValueError:
        console.print(f"[red]Invalid address:[/red] {address}")
        raise typer.Exit(1)

    func = get_function(CACHE_DB_PATH, addr_int)
    if func is None:
        console.print(f"[yellow]No function at 0x{addr_int:08X}[/yellow]")
        raise typer.Exit(1)

    n_callers = len(get_callers(CACHE_DB_PATH, func["addr"]))
    n_callees = len(get_callees(CACHE_DB_PATH, func["addr"]))

    console.print(f"\n[bold cyan]{func['name']}[/bold cyan]")
    console.print(f"  Entry: [yellow]0x{func['addr']:08X}[/yellow]")
    console.print(f"  Size:  {func['size']} bytes")
    console.print(f"  Callers: {n_callers}")
    console.print(f"  Callees: {n_callees}")
```

- [ ] **Step 2: Smoke test**

Run: `cd tools/melee-agent && melee-agent ghidra func 0x80243A3C`
Expected: Name, entry, size, callers/callees counts.

- [ ] **Step 3: Commit**

```bash
git add tools/melee-agent/src/cli/ghidra/cli.py
git commit -m "$(cat <<'EOF'
ghidra: func metadata via cache

Drops the deep parameter/signature/calling-convention introspection
from the old version — Ghidra's type inference for the melee binary
was unreliable enough that those fields produced more confusion
than value. Name, size, callers/callees counts are what agents
actually use.

If we discover real value in the dropped fields later, we can store
them in the cache and add them back; for now keep the output
minimal and obviously correct.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Smoke test the full Phase 2 workflow

**Files:** None (verification only)

- [ ] **Step 1: Verify all commands work end-to-end**

Run sequentially:

```bash
cd /Users/mike/code/melee/.claude/worktrees/intelligent-hawking-da3b78
melee-agent ghidra status                              # all ✓ except cache (if not built)
melee-agent ghidra cache-build                          # builds cache, ~minutes
melee-agent ghidra status                              # cache now ✓
melee-agent ghidra func    0x80243A3C
melee-agent ghidra xrefs   0x80243A3C
melee-agent ghidra xrefs   0x80243A3C --dir from
melee-agent ghidra strings 0x80243A3C
melee-agent ghidra strings --pattern assert
melee-agent ghidra decompile 0x80243A3C                # heavy path; should still work
```

Expected: each command produces non-error output.

- [ ] **Step 2: Run the test suite**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_*.py -v`
Expected: all tests pass.

- [ ] **Step 3: No commit needed** (verification only).

---

## Phase 3: Integrate xrefs into existing skills

Goal: Agents actually invoke `ghidra xrefs` and `ghidra strings` during the decomp loop, without the user telling them to.

### Task 14: Update `/decomp-fixup` to use xrefs when changing signatures

**Files:**
- Modify: `.claude/skills/decomp-fixup/SKILL.md`

- [ ] **Step 1: Add a "Find callers" section**

Read `.claude/skills/decomp-fixup/SKILL.md` to see current structure, then add a section near the workflow:

````markdown
## Finding all callers before changing a signature

When you change a function's signature (parameter types, return type, calling convention), every caller needs to be updated to match. Grep-only finds callers in already-decompiled source — missing callers in undecompiled functions silently break the build.

Always check Ghidra xrefs:

```bash
melee-agent ghidra xrefs 0x80<address>
```

This lists all call sites across the whole binary (decompiled or not). For each caller in already-decompiled code, update it. For each caller in undecompiled code, the change is safe as long as the symbol table entry is correct.

If the cache is not built (you'll see "Cache not built"), run `melee-agent ghidra cache-build` once. After that, xrefs is sub-millisecond.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/decomp-fixup/SKILL.md
git commit -m "$(cat <<'EOF'
decomp-fixup: use ghidra xrefs to find callers before signature changes

Grep-only caller discovery misses callers in undecompiled code,
which can silently break the build. Adds explicit guidance to run
`melee-agent ghidra xrefs <addr>` before changing a signature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Update `/understand` to use strings for naming

**Files:**
- Modify: `.claude/skills/understand/SKILL.md`

- [ ] **Step 1: Add a "String-driven naming" section**

Add near the function-naming guidance:

````markdown
## Strings as naming signal

`OSReport`, `__assert`, and other debug functions take string literals that often name the calling subsystem ("ftCo_LoadDatAttrs", "ItemDoUpdate", etc.). Use this:

```bash
melee-agent ghidra strings 0x80<address>      # strings in this function
melee-agent ghidra strings --pattern XYZ      # find functions with XYZ in any string
```

A function that does `OSReport("fghter %d hit\n", ...)` is plausibly something like `Fighter_LogHit`. Combine with xref context to confirm before naming.

If the cache is not built, run `melee-agent ghidra cache-build` once.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/understand/SKILL.md
git commit -m "$(cat <<'EOF'
understand: use ghidra strings as naming signal

Debug strings (OSReport, __assert) often name the subsystem they
fire from. Adds workflow guidance for melee-agent ghidra strings
during naming.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Rewrite `.claude/skills/ghidra/SKILL.md`

**Files:**
- Modify: `.claude/skills/ghidra/SKILL.md`

- [ ] **Step 1: Replace SKILL.md**

Replace the entire content of `.claude/skills/ghidra/SKILL.md` with:

````markdown
---
name: ghidra
description: Use cached Ghidra-derived xrefs and string lookups (fast SQLite queries) for cross-reference discovery and string-based naming. Also offers live Ghidra decompile as a heavy fallback. Use when finding callers across the whole binary or naming functions from debug strings.
---

# Ghidra Integration (cache-backed)

Two ways agents use Ghidra data, distinguished by cost:

| Need | Command | Cost |
|------|---------|------|
| Who calls this function (anywhere in the binary)? | `melee-agent ghidra xrefs 0x80<addr>` | <1ms (cache) |
| What does this function call? | `melee-agent ghidra xrefs 0x80<addr> --dir from` | <1ms |
| What strings does this function reference? | `melee-agent ghidra strings 0x80<addr>` | <1ms |
| Find functions that reference a string pattern. | `melee-agent ghidra strings --pattern XYZ` | <1ms |
| Function metadata (name, size, caller/callee counts). | `melee-agent ghidra func 0x80<addr>` | <1ms |
| Second-opinion decompilation. | `melee-agent ghidra decompile 0x80<addr>` | ~20s (JVM) |

The fast commands query a SQLite cache at `~/.config/decomp-me/ghidra.db`. The heavy `decompile` command boots a real Ghidra instance.

## Setup (one-time)

```bash
melee-agent ghidra status         # check what's missing
melee-agent ghidra setup          # guided GUI import (~5-10 min)
melee-agent ghidra cache-build    # populate the cache (~minutes)
```

After this, agent-loop commands work without further setup.

## When to use vs other tools

| Task | Preferred |
|------|-----------|
| Matching code → assembly | m2c + `tools/checkdiff.py` |
| Finding callers (whole binary) | `ghidra xrefs --dir to` |
| Finding callees | `ghidra xrefs --dir from` |
| Naming an unknown function | `ghidra strings` (debug strings) + `/understand` |
| Complex control flow, m2c output unclear | `ghidra decompile` (heavy) |
| Patterns / register tricks | `/mismatch-db`, `/discord-knowledge` |

## Limitations

- **Decompile is slow** — JVM startup is ~20s per call. Use sparingly.
- **Cache is built once** — rebuild manually if the Ghidra project gets re-analyzed.
- **Ghidra function names ≠ project symbol names** — the cache stores Ghidra's names; if our `symbols.txt` has renamed a function, look up by address, not by name.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cache not built" | `melee-agent ghidra cache-build` |
| "Project is not populated" | `melee-agent ghidra setup` (manual GUI step) |
| "Ghidra install not found" | `brew install ghidra` |
| "pyghidra not installed" | `pip install pyghidra` |
````

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/ghidra/SKILL.md
git commit -m "$(cat <<'EOF'
ghidra/SKILL: rewrite around the cache-backed workflow

The previous SKILL.md described the live-Ghidra workflow with the
GUI import as if it were the day-to-day path. In reality, the day-
to-day path is the cache: setup is one-time, queries are sub-ms.
Reframes the skill around xrefs/strings as the killer features and
demotes decompile to a heavy fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Update CLAUDE.md "Getting Unstuck" section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the `/ghidra` line in the "Getting Unstuck" list**

In `CLAUDE.md`, find the line under "### Getting Unstuck":

```markdown
- `/ghidra` - Alternative decompiler view, cross-references (callers/callees), type inference
```

Replace with:

```markdown
- `/ghidra` - Cross-references (callers/callees) and debug-string lookups via cached SQLite queries (sub-ms). Heavy `ghidra decompile` is also available as a second-opinion fallback.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
CLAUDE.md: reframe /ghidra around fast cache queries

The "alternative decompiler view" framing positioned ghidra as
something you'd only reach for when m2c was confusing. With the
cache, xrefs/strings are sub-ms and useful as routine queries
during the decomp loop, not just when stuck.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all ghidra tests**

Run: `cd tools/melee-agent && pytest tests/test_ghidra_*.py -v`
Expected: all pass.

- [ ] **Step 2: Run the broader test suite to confirm no regressions**

Run: `cd tools/melee-agent && pytest -x --ignore=tests/e2e`
Expected: all pass (e2e tests can be skipped — they require a live decomp.me server).

- [ ] **Step 3: Walk through the full workflow once**

```bash
melee-agent ghidra status                              # everything ✓
melee-agent ghidra func    0x80243A3C
melee-agent ghidra xrefs   0x80243A3C
melee-agent ghidra strings --pattern assert | head -20
```

Expected: each command works, output is sensible.

- [ ] **Step 4: No commit** (verification only).

---

## Self-Review Checklist

Run through this before claiming done:

**Spec coverage:** Phase 1 (revival) covered by Tasks 1-7. Phase 2 (cache) covered by Tasks 8-13. Phase 3 (integration) covered by Tasks 14-17. Yes.

**Placeholder scan:** No `TODO`, `TBD`, or "implement later". Every step has the actual code or command. Yes.

**Type consistency:** `ghidra_project_dir()`, `GHIDRA_PROJECT_NAME`, `is_project_populated()`, `CACHE_DB_PATH`, `init_schema`, `build_from_project`, `get_callers`, `get_callees`, `get_strings_for_function`, `search_strings`, `get_function` — used consistently across tasks. Yes.

**Manual checkpoint identified:** Phase 1 → Phase 2 transition requires user to run `melee-agent ghidra setup` and complete the GUI import. Marked clearly. Yes.

**Failure modes addressed:**
- Bad `GHIDRA_INSTALL_DIR` → auto-detect, give precise error (Task 4)
- Worktree without `orig/` → use `BASE_DOL_PATH` central fallback (Task 5)
- Stale project → `is_project_populated()` check + warning in status (Task 6)
- Missing cache → all commands fail fast with `cache-build` hint (Tasks 10-12)
