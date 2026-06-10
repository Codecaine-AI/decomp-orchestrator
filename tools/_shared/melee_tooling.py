#!/usr/bin/env python3
"""Shared helpers for tool-local Melee implementation APIs.

The worker-facing API entrypoints live in the category folders under
``tools/``. Their heavier implementation modules live in
``tools/_impl/melee`` so the tool code is versioned with this repository
and can be reviewed, indexed, and patched here.
"""

from __future__ import annotations

import contextlib
import importlib
import io
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence


MAX_STREAM_CHARS = 80_000


def package_root() -> Path:
    """Return the decomp-orchestrator repository root."""

    return Path(__file__).resolve().parents[2]


def tool_impl_root() -> Path:
    """Return the tool-owned Melee helper implementation root."""

    return package_root() / "tools" / "_impl" / "melee"


def tool_impl_tools_root() -> Path:
    """Return the directory containing callable Melee helper scripts."""

    return tool_impl_root() / "tools"


def looks_like_melee_root(path: Path) -> bool:
    """Return true when ``path`` has enough Melee checkout shape for tools."""

    return (path / "src").is_dir() and (
        (path / "build" / "GALE01").exists()
        or (path / "compile_commands.json").exists()
        or (path / "config" / "GALE01").exists()
    )


def resolve_repo_root(value: str | Path | None = None) -> Path:
    """Resolve the target Melee checkout root used by helper scripts."""

    if value:
        return Path(value).expanduser().resolve()
    for env_name in ("MELEE_ROOT", "CLAUDE_PROJECT_DIR"):
        env_value = os.environ.get(env_name)
        if env_value:
            return Path(env_value).expanduser().resolve()
    cwd = Path.cwd().resolve()
    if looks_like_melee_root(cwd):
        return cwd
    sibling = package_root().parent / "melee"
    return sibling.resolve()


def clip(text: str | bytes | None, max_chars: int = MAX_STREAM_CHARS) -> str:
    """Bound command output while preserving the most useful beginning."""

    if text is None:
        return ""
    if isinstance(text, bytes):
        text = text.decode("utf-8", "replace")
    elif not isinstance(text, str):
        text = str(text)
    if len(text) <= max_chars:
        return text
    omitted = len(text) - max_chars
    return f"{text[:max_chars].rstrip()}\n...<truncated {omitted} characters>...\n"


def clamp_int(value: int | None, *, default: int, minimum: int, maximum: int) -> int:
    """Clamp optional integer API values to predictable safe bounds."""

    if value is None:
        return default
    return max(minimum, min(maximum, int(value)))


def command_payload(
    *,
    operation: str,
    command: Sequence[str],
    cwd: Path,
    repo_root: Path,
    exit_code: int | None,
    stdout: str,
    stderr: str,
    status: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the common JSON payload returned by command-style APIs."""

    payload: dict[str, Any] = {
        "status": status or ("ok" if exit_code == 0 else "failed"),
        "operation": operation,
        "repo_root": str(repo_root),
        "tool_impl_root": str(tool_impl_root()),
        "cwd": str(cwd),
        "command": list(command),
        "exit_code": exit_code,
        "stdout": clip(stdout),
        "stderr": clip(stderr),
    }
    if extra:
        payload.update(extra)
    return payload


def tool_env(repo_root: Path) -> dict[str, str]:
    """Create an environment that points helper scripts at the target repo."""

    env = dict(os.environ)
    env["MELEE_ROOT"] = str(repo_root)
    env.setdefault("CLAUDE_PROJECT_DIR", str(repo_root))
    paths = [str(tool_impl_tools_root()), str(tool_impl_root() / "m2c")]
    existing = env.get("PYTHONPATH")
    env["PYTHONPATH"] = os.pathsep.join(paths + ([existing] if existing else []))
    return env


def compiler_runner_status(repo_root: Path) -> dict[str, Any]:
    """Report whether a usable MWCC process runner is available.

    Linux setups often provide ``build/tools/wibo``. This macOS checkout can
    also run MWCC through Wine, so status checks must not treat wibo as the only
    valid runner.
    """

    project_wibo = repo_root / "build/tools/wibo"
    env_wibo = os.environ.get("MWCC_WIBO", "")
    path_wibo = shutil.which("wibo")
    wine = next(
        (
            candidate
            for candidate in (
                os.environ.get("WINE"),
                shutil.which("wine"),
                "/usr/local/bin/wine",
                "/opt/homebrew/bin/wine",
            )
            if candidate and (Path(candidate).exists() or shutil.which(candidate))
        ),
        None,
    )
    runner_available = project_wibo.exists() or bool(env_wibo) or bool(path_wibo) or bool(wine)
    return {
        "status": "ok" if runner_available else "missing",
        "project_wibo": str(project_wibo) if project_wibo.exists() else None,
        "env_mwcc_wibo": env_wibo or None,
        "path_wibo": path_wibo,
        "wine": wine,
        "missing_label": "MWCC runner: build/tools/wibo, MWCC_WIBO, wibo, or wine",
    }


def script_declares_dependencies(script: Path) -> bool:
    """Return true when a helper script has a PEP 723 dependency block."""

    try:
        head = script.read_text(errors="ignore")[:2048]
    except OSError:
        return False
    return "# /// script" in head and "dependencies" in head


def run_tool_script(
    script_name: str,
    args: Sequence[str],
    *,
    repo_root: Path,
    operation: str,
    timeout_seconds: int = 60,
) -> dict[str, Any]:
    """Run a tool-local helper script and return a bounded command result."""

    script = tool_impl_tools_root() / script_name
    if not script.exists():
        return {
            "status": "missing_tool_impl_script",
            "operation": operation,
            "script": str(script),
            "repo_root": str(repo_root),
            "tool_impl_root": str(tool_impl_root()),
        }
    uv = shutil.which("uv")
    command = [uv, "run", "--no-project", "--script", str(script), *args] if uv and script_declares_dependencies(script) else [sys.executable, str(script), *args]
    cwd = repo_root if repo_root.exists() else package_root()
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            env=tool_env(repo_root),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        return command_payload(
            operation=operation,
            command=command,
            cwd=cwd,
            repo_root=repo_root,
            exit_code=None,
            stdout=error.stdout or "",
            stderr=error.stderr or "",
            status="timed_out",
            extra={"timeout_seconds": timeout_seconds},
        )
    except OSError as error:
        return command_payload(
            operation=operation,
            command=command,
            cwd=cwd,
            repo_root=repo_root,
            exit_code=None,
            stdout="",
            stderr=str(error),
            status="spawn_failed",
        )
    return command_payload(
        operation=operation,
        command=command,
        cwd=cwd,
        repo_root=repo_root,
        exit_code=result.returncode,
        stdout=result.stdout,
        stderr=result.stderr,
    )


def import_tool_module(module_name: str, repo_root: Path) -> Any:
    """Import one tool-local helper module after binding ``MELEE_ROOT``."""

    os.environ["MELEE_ROOT"] = str(repo_root)
    os.environ.setdefault("CLAUDE_PROJECT_DIR", str(repo_root))
    tools_root = str(tool_impl_tools_root())
    m2c_root = str(tool_impl_root() / "m2c")
    for path in (tools_root, m2c_root):
        if path not in sys.path:
            sys.path.insert(0, path)
    return importlib.import_module(module_name)


@contextlib.contextmanager
def captured_stdio() -> Iterable[tuple[io.StringIO, io.StringIO]]:
    """Capture stdout/stderr from imported helper calls."""

    stdout = io.StringIO()
    stderr = io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        yield stdout, stderr


def tool_impl_status(
    *,
    tool: str,
    scripts: Sequence[str],
    repo_root: Path,
    required_paths: Sequence[str] = (),
    optional_paths: Sequence[str] = (),
    message: str,
) -> dict[str, Any]:
    """Report tool-local implementation availability without heavy work."""

    script_status = [
        {
            "script": script,
            "path": str(tool_impl_tools_root() / script),
            "exists": (tool_impl_tools_root() / script).exists(),
        }
        for script in scripts
    ]
    required = [
        {"path": path, "absolute_path": str(repo_root / path), "exists": (repo_root / path).exists()}
        for path in required_paths
    ]
    optional = [
        {"path": path, "absolute_path": str(repo_root / path), "exists": (repo_root / path).exists()}
        for path in optional_paths
    ]
    missing_required = [item["path"] for item in required if not item["exists"]]
    missing_scripts = [item["script"] for item in script_status if not item["exists"]]
    return {
        "tool": tool,
        "status": "ok" if not missing_scripts and not missing_required else "missing_prerequisite",
        "operation_mode": "tool_local_impl",
        "repo_root": str(repo_root),
        "repo_root_exists": repo_root.exists(),
        "looks_like_melee_root": looks_like_melee_root(repo_root),
        "tool_impl_root": str(tool_impl_root()),
        "tool_impl_root_exists": tool_impl_root().exists(),
        "scripts": script_status,
        "required_paths": required,
        "optional_paths": optional,
        "missing_scripts": missing_scripts,
        "missing_required_paths": missing_required,
        "message": message,
    }


def print_json(payload: dict[str, Any]) -> None:
    """Emit a deterministic JSON payload for Pi tool consumption."""

    print(json.dumps(payload, indent=2, sort_keys=True))
