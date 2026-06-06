# Remote Permuter Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detached SSH/tmux orchestration for running decomp-permuter jobs on existing Ubuntu Coder/cloud instances and fetching results back for local triage.

**Architecture:** Put orchestration in `src/mwcc_debug/permuter_remote.py`: config parsing, job ids, metadata, shell command construction, and injectable command runners. Keep `src/cli/debug.py` as a thin Typer surface under `debug permute remote`, reusing existing local permuter-dir resolution and import hints.

**Tech Stack:** Python 3.11, Typer, pytest, stdlib `tomllib`, `subprocess`, `json`, `pathlib`, SSH, rsync, tmux.

---

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/permuter_remote.py`
  - Dataclasses: `RemoteTarget`, `RemoteJob`, `CommandResult`.
  - Config loading from `~/.config/decomp-me/permuter-remotes.toml`.
  - Metadata read/write under `~/.config/decomp-me/permuter-jobs/`.
  - Pure command builders for `ssh`, `rsync`, and remote `tmux`.
  - Operational functions: `submit_job`, `status_job`, `tail_job`, `fetch_job`, `stop_job`, `list_jobs`.
  - Injectable runner callable for tests.
- Modify `tools/melee-agent/src/cli/debug.py`
  - Add `remote_app = typer.Typer(...)`.
  - Register under `permute_app.add_typer(remote_app, name="remote")`.
  - Add thin commands: `targets`, `submit`, `list`, `status`, `tail`, `fetch`, `stop`.
- Create `tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py`
  - Unit tests for config parsing, command construction, metadata, submit/status/fetch/stop using fake runners.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`
  - Include `debug permute remote --help` and representative remote command help in grouped command smoke tests.

---

### Task 1: Config and Metadata Core

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/permuter_remote.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py`

- [ ] **Step 1: Write failing tests for config loading and missing config**

Add this test file:

```python
from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.mwcc_debug import permuter_remote as pr


def test_load_targets_parses_config(tmp_path: Path) -> None:
    config = tmp_path / "permuter-remotes.toml"
    config.write_text(
        """
[target.coder64]
ssh = "coder.coder64"
remote_melee_root = "/home/coder/melee"
remote_perm_root = "/home/coder/decomp-permuter"
threads = 64
session_prefix = "melee-perm"
""".strip()
        + "\n"
    )

    targets = pr.load_targets(config)

    assert targets["coder64"] == pr.RemoteTarget(
        name="coder64",
        ssh="coder.coder64",
        remote_melee_root="/home/coder/melee",
        remote_perm_root="/home/coder/decomp-permuter",
        threads=64,
        session_prefix="melee-perm",
    )


def test_load_targets_missing_config_has_example(tmp_path: Path) -> None:
    missing = tmp_path / "permuter-remotes.toml"

    with pytest.raises(pr.RemoteConfigError) as exc:
        pr.load_targets(missing)

    msg = str(exc.value)
    assert str(missing) in msg
    assert "[target.coder64]" in msg
    assert "remote_perm_root" in msg


def test_job_metadata_round_trip(tmp_path: Path) -> None:
    job = pr.RemoteJob(
        job_id="fn_80000000-coder64-20260525-143012",
        function="fn_80000000",
        target="coder64",
        ssh="coder.coder64",
        remote_perm_dir=(
            "/home/coder/decomp-permuter/remote-runs/"
            "fn_80000000-coder64-20260525-143012/nonmatchings/fn_80000000"
        ),
        remote_run_dir="/home/coder/decomp-permuter/remote-runs/fn_80000000-coder64-20260525-143012",
        local_perm_dir="/tmp/decomp-permuter/nonmatchings/fn_80000000",
        tmux_session="melee-perm-fn_80000000-coder64-20260525-143012",
        threads=64,
        mode="stock",
        created_at="2026-05-25T14:30:12",
    )

    pr.write_job(job, jobs_dir=tmp_path)
    loaded = pr.read_job(job.job_id, jobs_dir=tmp_path)

    assert loaded == job
    assert json.loads((tmp_path / f"{job.job_id}.json").read_text())["function"] == "fn_80000000"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: import failure because `src.mwcc_debug.permuter_remote` does not exist.

- [ ] **Step 3: Implement config and metadata dataclasses**

Create `tools/melee-agent/src/mwcc_debug/permuter_remote.py` with:

```python
from __future__ import annotations

import dataclasses
import json
import os
import tomllib
from dataclasses import dataclass
from pathlib import Path


CONFIG_PATH = Path("~/.config/decomp-me/permuter-remotes.toml").expanduser()
JOBS_DIR = Path("~/.config/decomp-me/permuter-jobs").expanduser()


CONFIG_EXAMPLE = """\
[target.coder64]
ssh = "coder.coder64"
remote_melee_root = "/home/coder/melee"
remote_perm_root = "/home/coder/decomp-permuter"
threads = 64
session_prefix = "melee-perm"
"""


class RemoteConfigError(RuntimeError):
    """Raised when remote permuter target config is missing or invalid."""


class RemoteJobError(RuntimeError):
    """Raised when a requested remote permuter job cannot be found or used."""


@dataclass(frozen=True)
class RemoteTarget:
    name: str
    ssh: str
    remote_melee_root: str
    remote_perm_root: str
    threads: int
    session_prefix: str = "melee-perm"


@dataclass(frozen=True)
class RemoteJob:
    job_id: str
    function: str
    target: str
    ssh: str
    remote_perm_dir: str
    remote_run_dir: str
    local_perm_dir: str
    tmux_session: str
    threads: int
    mode: str
    created_at: str


def load_targets(config_path: Path = CONFIG_PATH) -> dict[str, RemoteTarget]:
    if not config_path.exists():
        raise RemoteConfigError(
            "Remote permuter config not found: "
            f"{config_path}\n\nCreate it with:\n{CONFIG_EXAMPLE}"
        )

    try:
        data = tomllib.loads(config_path.read_text())
    except tomllib.TOMLDecodeError as exc:
        raise RemoteConfigError(f"Invalid TOML in {config_path}: {exc}") from exc

    raw_targets = data.get("target")
    if not isinstance(raw_targets, dict) or not raw_targets:
        raise RemoteConfigError(
            f"{config_path} must define at least one [target.<name>] table.\n\n"
            f"Example:\n{CONFIG_EXAMPLE}"
        )

    targets: dict[str, RemoteTarget] = {}
    for name, raw in raw_targets.items():
        if not isinstance(raw, dict):
            raise RemoteConfigError(f"[target.{name}] must be a TOML table")
        missing = [
            key for key in ("ssh", "remote_melee_root", "remote_perm_root")
            if not raw.get(key)
        ]
        if missing:
            raise RemoteConfigError(
                f"[target.{name}] missing required key(s): {', '.join(missing)}"
            )
        threads = int(raw.get("threads", max(1, (os.cpu_count() or 1))))
        targets[name] = RemoteTarget(
            name=name,
            ssh=str(raw["ssh"]),
            remote_melee_root=str(raw["remote_melee_root"]).rstrip("/"),
            remote_perm_root=str(raw["remote_perm_root"]).rstrip("/"),
            threads=threads,
            session_prefix=str(raw.get("session_prefix", "melee-perm")),
        )
    return targets


def write_job(job: RemoteJob, *, jobs_dir: Path = JOBS_DIR) -> Path:
    jobs_dir.mkdir(parents=True, exist_ok=True)
    path = jobs_dir / f"{job.job_id}.json"
    if path.exists():
        raise RemoteJobError(f"job metadata already exists: {path}")
    path.write_text(json.dumps(dataclasses.asdict(job), indent=2) + "\n")
    return path


def read_job(job_id: str, *, jobs_dir: Path = JOBS_DIR) -> RemoteJob:
    path = jobs_dir / f"{job_id}.json"
    if not path.exists():
        raise RemoteJobError(f"remote permuter job not found: {job_id}")
    return RemoteJob(**json.loads(path.read_text()))


def list_jobs(*, jobs_dir: Path = JOBS_DIR) -> list[RemoteJob]:
    if not jobs_dir.exists():
        return []
    jobs = []
    for path in sorted(jobs_dir.glob("*.json")):
        try:
            jobs.append(RemoteJob(**json.loads(path.read_text())))
        except (TypeError, json.JSONDecodeError):
            continue
    return jobs
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/permuter_remote.py tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py
git commit -m "feat: add remote permuter config model"
```

---

### Task 2: Command Builders and Submit Orchestration

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/permuter_remote.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py`

- [ ] **Step 1: Write failing submit tests with fake runner**

Append:

```python
def test_submit_job_builds_rsync_ssh_tmux_and_metadata(tmp_path: Path) -> None:
    local_perm = tmp_path / "local-perm" / "nonmatchings" / "fn_80000000"
    local_perm.mkdir(parents=True)
    (local_perm / "base.c").write_text("void fn_80000000(void) {}\n")
    jobs_dir = tmp_path / "jobs"
    calls: list[list[str]] = []

    def fake_runner(argv: list[str], *, cwd: Path | None = None, check: bool = True) -> pr.CommandResult:
        calls.append(argv)
        return pr.CommandResult(returncode=0, stdout="", stderr="")

    target = pr.RemoteTarget(
        name="coder64",
        ssh="coder.coder64",
        remote_melee_root="/home/coder/melee",
        remote_perm_root="/home/coder/decomp-permuter",
        threads=64,
        session_prefix="melee-perm",
    )

    job = pr.submit_job(
        function="fn_80000000",
        target=target,
        local_perm_dir=local_perm,
        jobs_dir=jobs_dir,
        runner=fake_runner,
        now=lambda: "2026-05-25T14:30:12",
    )

    assert job.job_id == "fn_80000000-coder64-20260525-143012"
    assert job.threads == 64
    assert job.mode == "stock"
    assert (jobs_dir / f"{job.job_id}.json").exists()
    assert calls[0][0] == "rsync"
    assert str(local_perm) + "/" in calls[0]
    assert (
        "coder.coder64:/home/coder/decomp-permuter/remote-runs/"
        "fn_80000000-coder64-20260525-143012/nonmatchings/fn_80000000/"
    ) in calls[0]
    assert calls[1][:2] == ["ssh", "coder.coder64"]
    remote_script = calls[1][2]
    assert "tmux new-session -d" in remote_script
    assert (
        "./permuter.py remote-runs/fn_80000000-coder64-20260525-143012/"
        "nonmatchings/fn_80000000 --threads 64"
    ) in remote_script
    assert "metadata.json" in remote_script


def test_submit_job_rejects_missing_local_perm_dir(tmp_path: Path) -> None:
    target = pr.RemoteTarget(
        name="coder64",
        ssh="coder.coder64",
        remote_melee_root="/home/coder/melee",
        remote_perm_root="/home/coder/decomp-permuter",
        threads=64,
    )

    with pytest.raises(pr.RemoteJobError) as exc:
        pr.submit_job(
            function="fn_80000000",
            target=target,
            local_perm_dir=tmp_path / "missing",
            jobs_dir=tmp_path / "jobs",
        )

    assert "local permuter dir not found" in str(exc.value)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: failures for missing `CommandResult` and `submit_job`.

- [ ] **Step 3: Implement command runner, quoting, job id, and submit**

Add to `permuter_remote.py`:

```python
import re
import shlex
import subprocess
from collections.abc import Callable


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


Runner = Callable[[list[str]], CommandResult]


def run_command(
    argv: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
) -> CommandResult:
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True)
    wrapped = CommandResult(result.returncode, result.stdout, result.stderr)
    if check and result.returncode != 0:
        raise RemoteJobError(
            f"command failed ({result.returncode}): {shlex.join(argv)}\n"
            f"{result.stderr.strip()}"
        )
    return wrapped


def _compact_timestamp(iso_timestamp: str) -> str:
    return re.sub(r"[^0-9]", "", iso_timestamp)[:14]


def _make_job_id(function: str, target_name: str, iso_timestamp: str) -> str:
    safe_fn = re.sub(r"[^A-Za-z0-9_.-]+", "_", function)
    safe_target = re.sub(r"[^A-Za-z0-9_.-]+", "_", target_name)
    return f"{safe_fn}-{safe_target}-{_compact_timestamp(iso_timestamp)}"


def _shell_json(data: dict[str, object]) -> str:
    return shlex.quote(json.dumps(data, sort_keys=True))


def _remote_submit_script(job: RemoteJob, target: RemoteTarget) -> str:
    run_log = f"{job.remote_run_dir}/permuter.log"
    metadata = {
        "job_id": job.job_id,
        "function": job.function,
        "target": job.target,
        "mode": job.mode,
        "threads": job.threads,
        "created_at": job.created_at,
    }
    if job.mode != "stock":
        raise RemoteJobError("only stock remote permuter mode is implemented")
    perm_rel = f"remote-runs/{job.job_id}/nonmatchings/{job.function}"
    command = (
        f"cd {shlex.quote(target.remote_perm_root)} && "
        f"./permuter.py {shlex.quote(perm_rel)} --threads {job.threads} "
        f"> {shlex.quote(run_log)} 2>&1"
    )
    return " && ".join([
        f"test -d {shlex.quote(target.remote_perm_root)}",
        f"test -d {shlex.quote(target.remote_melee_root)}",
        "command -v tmux >/dev/null",
        f"mkdir -p {shlex.quote(job.remote_run_dir)}",
        f"printf '%s\\n' {_shell_json(metadata)} > {shlex.quote(job.remote_run_dir + '/metadata.json')}",
        (
            "tmux new-session -d "
            f"-s {shlex.quote(job.tmux_session)} "
            f"{shlex.quote(command)}"
        ),
    ])


def submit_job(
    *,
    function: str,
    target: RemoteTarget,
    local_perm_dir: Path,
    jobs_dir: Path = JOBS_DIR,
    threads: int | None = None,
    mode: str = "stock",
    runner=run_command,
    now=None,
) -> RemoteJob:
    if not local_perm_dir.exists():
        raise RemoteJobError(f"local permuter dir not found: {local_perm_dir}")
    if mode != "stock":
        raise RemoteJobError("remote mode 'mwcc' is not implemented yet")

    import datetime

    created_at = now() if now else datetime.datetime.now().replace(microsecond=0).isoformat()
    job_id = _make_job_id(function, target.name, created_at)
    remote_run_dir = f"{target.remote_perm_root}/remote-runs/{job_id}"
    remote_perm_dir = f"{remote_run_dir}/nonmatchings/{function}"
    job = RemoteJob(
        job_id=job_id,
        function=function,
        target=target.name,
        ssh=target.ssh,
        remote_perm_dir=remote_perm_dir,
        remote_run_dir=remote_run_dir,
        local_perm_dir=str(local_perm_dir),
        tmux_session=f"{target.session_prefix}-{job_id}",
        threads=threads or target.threads,
        mode=mode,
        created_at=created_at,
    )

    runner([
        "rsync", "-az", "--delete",
        "--rsync-path",
        f"mkdir -p {shlex.quote(remote_perm_dir)} && rsync",
        str(local_perm_dir) + "/",
        f"{target.ssh}:{remote_perm_dir}/",
    ])
    runner(["ssh", target.ssh, _remote_submit_script(job, target)])
    write_job(job, jobs_dir=jobs_dir)
    return job
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/permuter_remote.py tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py
git commit -m "feat: submit remote permuter jobs"
```

---

### Task 3: Status, Fetch, Tail, Stop Operations

**Files:**
- Modify: `tools/melee-agent/src/mwcc_debug/permuter_remote.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py`

- [ ] **Step 1: Write failing tests**

Append:

```python
def _sample_job(tmp_path: Path) -> pr.RemoteJob:
    return pr.RemoteJob(
        job_id="fn_80000000-coder64-20260525-143012",
        function="fn_80000000",
        target="coder64",
        ssh="coder.coder64",
        remote_perm_dir=(
            "/home/coder/decomp-permuter/remote-runs/"
            "fn_80000000-coder64-20260525-143012/nonmatchings/fn_80000000"
        ),
        remote_run_dir="/home/coder/decomp-permuter/remote-runs/fn_80000000-coder64-20260525-143012",
        local_perm_dir=str(tmp_path / "local-perm" / "nonmatchings" / "fn_80000000"),
        tmux_session="melee-perm-fn_80000000-coder64-20260525-143012",
        threads=64,
        mode="stock",
        created_at="2026-05-25T14:30:12",
    )


def test_status_job_reports_active_from_tmux(tmp_path: Path) -> None:
    job = _sample_job(tmp_path)
    calls: list[list[str]] = []

    def fake_runner(argv: list[str], *, cwd: Path | None = None, check: bool = True) -> pr.CommandResult:
        calls.append(argv)
        return pr.CommandResult(returncode=0, stdout="active\n", stderr="")

    status = pr.status_job(job, runner=fake_runner)

    assert status.state == "active"
    assert calls == [["ssh", "coder.coder64", "tmux has-session -t melee-perm-fn_80000000-coder64-20260525-143012 2>/dev/null && printf active || printf stopped"]]


def test_fetch_job_rsyncs_outputs_to_run_dir(tmp_path: Path) -> None:
    job = _sample_job(tmp_path)
    calls: list[list[str]] = []

    def fake_runner(argv: list[str], *, cwd: Path | None = None, check: bool = True) -> pr.CommandResult:
        calls.append(argv)
        return pr.CommandResult(returncode=0, stdout="", stderr="")

    dest = pr.fetch_job(job, runner=fake_runner)

    assert dest == Path(job.local_perm_dir) / "remote-runs" / job.job_id
    assert calls[0][0] == "rsync"
    assert calls[0][-2] == "coder.coder64:/home/coder/decomp-permuter/nonmatchings/fn_80000000/"
    assert calls[0][-1] == str(dest) + "/"


def test_stop_job_kills_tmux_session(tmp_path: Path) -> None:
    job = _sample_job(tmp_path)
    calls: list[list[str]] = []

    def fake_runner(argv: list[str], *, cwd: Path | None = None, check: bool = True) -> pr.CommandResult:
        calls.append(argv)
        return pr.CommandResult(returncode=0, stdout="", stderr="")

    pr.stop_job(job, runner=fake_runner)

    assert calls == [["ssh", "coder.coder64", "tmux kill-session -t melee-perm-fn_80000000-coder64-20260525-143012"]]
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: failures for missing status/fetch/stop APIs.

- [ ] **Step 3: Implement operation APIs**

Add:

```python
@dataclass(frozen=True)
class RemoteStatus:
    job_id: str
    state: str
    detail: str = ""


def status_job(job: RemoteJob, *, runner=run_command) -> RemoteStatus:
    script = (
        f"tmux has-session -t {shlex.quote(job.tmux_session)} 2>/dev/null "
        "&& printf active || printf stopped"
    )
    result = runner(["ssh", job.ssh, script], check=False)
    state = result.stdout.strip() or "unknown"
    if result.returncode not in (0, 1):
        state = "unknown"
    return RemoteStatus(job_id=job.job_id, state=state, detail=result.stderr.strip())


def fetch_job(job: RemoteJob, *, runner=run_command, dest: Path | None = None) -> Path:
    out_dir = dest or (Path(job.local_perm_dir) / "remote-runs" / job.job_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    runner([
        "rsync", "-az",
        "--include", "output-*/***",
        "--include", "best.c",
        "--include", "*.log",
        "--exclude", "*",
        f"{job.ssh}:{job.remote_perm_dir}/",
        str(out_dir) + "/",
    ])
    return out_dir


def tail_job(job: RemoteJob, *, runner=run_command, lines: int = 80) -> CommandResult:
    log_path = f"{job.remote_run_dir}/permuter.log"
    script = f"tail -n {int(lines)} -f {shlex.quote(log_path)}"
    return runner(["ssh", job.ssh, script], check=False)


def stop_job(job: RemoteJob, *, runner=run_command) -> CommandResult:
    return runner([
        "ssh",
        job.ssh,
        f"tmux kill-session -t {shlex.quote(job.tmux_session)}",
    ], check=False)
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py -q
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/mwcc_debug/permuter_remote.py tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py
git commit -m "feat: manage remote permuter jobs"
```

---

### Task 4: CLI Wiring

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`
- Test: `tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py`

- [ ] **Step 1: Write failing CLI tests**

In `test_debug_cli_reorg.py`, add remote help commands to `commands`:

```python
        ["debug", "permute", "remote", "--help"],
        ["debug", "permute", "remote", "submit", "--help"],
        ["debug", "permute", "remote", "fetch", "--help"],
```

Append to `test_mwcc_debug_permuter_remote.py`:

```python
from typer.testing import CliRunner
from src.cli import app


def test_remote_targets_cli_missing_config_mentions_example(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(pr, "CONFIG_PATH", tmp_path / "missing.toml")
    result = CliRunner().invoke(app, ["debug", "permute", "remote", "targets"])

    assert result.exit_code == 2
    combined = result.stdout + result.stderr
    assert "Remote permuter config not found" in combined
    assert "[target.coder64]" in combined
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_mwcc_debug_permuter_remote.py::test_remote_targets_cli_missing_config_mentions_example -q
```

Expected: missing `remote` command.

- [ ] **Step 3: Add remote Typer app and commands**

In `debug.py`, import the module:

```python
from ..mwcc_debug import permuter_remote
```

After `permute_app = typer.Typer(...)`, add:

```python
remote_app = typer.Typer(
    help="Run decomp-permuter jobs on configured SSH remotes."
)
```

After `debug_app.add_typer(permute_app, name="permute")`, add:

```python
permute_app.add_typer(remote_app, name="remote")
```

Near other permute commands, add:

```python
def _remote_error(exc: Exception) -> None:
    typer.echo(str(exc), err=True)
    raise typer.Exit(2)


@remote_app.command("targets")
def remote_targets() -> None:
    try:
        targets = permuter_remote.load_targets()
    except permuter_remote.RemoteConfigError as exc:
        _remote_error(exc)
    for target in targets.values():
        typer.echo(
            f"{target.name}: ssh={target.ssh} "
            f"perm={target.remote_perm_root} melee={target.remote_melee_root} "
            f"threads={target.threads}"
        )


@remote_app.command("submit")
def remote_submit(
    function: Annotated[str, typer.Option("--function", "-f", help="Function name")],
    target_name: Annotated[str, typer.Option("--target", help="Configured remote target name")],
    threads: Annotated[Optional[int], typer.Option("--threads", help="Override configured thread count")] = None,
    mode: Annotated[str, typer.Option("--mode", help="Remote run mode: stock only for first version")] = "stock",
    perm_root: Annotated[Path, typer.Option("--perm-root", help="Local decomp-permuter root")] = Path("~/code/decomp-permuter").expanduser(),
) -> None:
    try:
        targets = permuter_remote.load_targets()
        target = targets[target_name]
    except KeyError:
        typer.echo(f"remote target not found: {target_name}", err=True)
        raise typer.Exit(2)
    except permuter_remote.RemoteConfigError as exc:
        _remote_error(exc)

    local_perm_dir = _resolve_permuter_function_dir(
        function,
        perm_root=perm_root,
        melee_root=DEFAULT_MELEE_ROOT,
    )
    if not local_perm_dir.exists():
        typer.echo(_permuter_import_hint(function, perm_root=perm_root, melee_root=DEFAULT_MELEE_ROOT), err=True)
        raise typer.Exit(2)
    try:
        job = permuter_remote.submit_job(
            function=function,
            target=target,
            local_perm_dir=local_perm_dir,
            threads=threads,
            mode=mode,
        )
    except permuter_remote.RemoteJobError as exc:
        _remote_error(exc)
    typer.echo(f"Submitted remote permuter job: {job.job_id}")
    typer.echo(f"Remote: {job.ssh}:{job.remote_perm_dir}")
    typer.echo(f"Log:    {job.remote_run_dir}/permuter.log")


@remote_app.command("list")
def remote_list() -> None:
    for job in permuter_remote.list_jobs():
        typer.echo(f"{job.job_id} {job.function} {job.target} {job.mode} threads={job.threads}")


@remote_app.command("status")
def remote_status(job_id: Annotated[str, typer.Argument(help="Remote job id")]) -> None:
    try:
        job = permuter_remote.read_job(job_id)
        status = permuter_remote.status_job(job)
    except permuter_remote.RemoteJobError as exc:
        _remote_error(exc)
    typer.echo(f"{status.job_id}: {status.state}")
    if status.detail:
        typer.echo(status.detail, err=True)


@remote_app.command("fetch")
def remote_fetch(
    job_id: Annotated[str, typer.Argument(help="Remote job id")],
    triage: Annotated[bool, typer.Option("--triage", help="Print the follow-up triage command")] = False,
) -> None:
    try:
        job = permuter_remote.read_job(job_id)
        dest = permuter_remote.fetch_job(job)
    except permuter_remote.RemoteJobError as exc:
        _remote_error(exc)
    typer.echo(f"Fetched: {dest}")
    if triage:
        typer.echo(
            "Run triage manually against the fetched directory:\n"
            f"  melee-agent debug permute triage {dest} -f {job.function}"
        )


@remote_app.command("tail")
def remote_tail(
    job_id: Annotated[str, typer.Argument(help="Remote job id")],
    lines: Annotated[int, typer.Option("--lines", "-n", help="Initial lines to show")] = 80,
) -> None:
    try:
        job = permuter_remote.read_job(job_id)
        result = permuter_remote.tail_job(job, lines=lines)
    except permuter_remote.RemoteJobError as exc:
        _remote_error(exc)
    if result.stdout:
        typer.echo(result.stdout, nl=False)
    if result.stderr:
        typer.echo(result.stderr, err=True, nl=False)


@remote_app.command("stop")
def remote_stop(job_id: Annotated[str, typer.Argument(help="Remote job id")]) -> None:
    try:
        job = permuter_remote.read_job(job_id)
        result = permuter_remote.stop_job(job)
    except permuter_remote.RemoteJobError as exc:
        _remote_error(exc)
    if result.returncode == 0:
        typer.echo(f"Stopped: {job.job_id}")
    else:
        typer.echo(result.stderr.strip() or f"tmux session not stopped: {job.tmux_session}", err=True)
        raise typer.Exit(2)
```

- [ ] **Step 4: Run CLI tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works tests/test_mwcc_debug_permuter_remote.py::test_remote_targets_cli_missing_config_mentions_example -q
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_debug_cli_reorg.py tools/melee-agent/tests/test_mwcc_debug_permuter_remote.py
git commit -m "feat: expose remote permuter CLI"
```

---

### Task 5: Final Verification and Docs Update

**Files:**
- Modify: `docs/mwcc-debug-permuter-integration.md`

- [ ] **Step 1: Add concise docs**

Add a section after Tier 2.5 or near the workflow:

```markdown
## Remote CPU runs

For long CPU-bound permuter runs, `debug permute remote` can submit the
function's permuter directory to an existing SSH-accessible Ubuntu instance and
start a detached tmux job:

```bash
melee-agent debug permute remote targets
melee-agent debug permute remote submit -f my_stuck_fn --target coder64
melee-agent debug permute remote status my_stuck_fn-coder64-YYYYMMDD-HHMMSS
melee-agent debug permute remote fetch my_stuck_fn-coder64-YYYYMMDD-HHMMSS
```

Targets are configured locally in `~/.config/decomp-me/permuter-remotes.toml`.
The remote host must already have a Melee checkout, a decomp-permuter checkout,
`rsync`, and `tmux`; SSH connection is enough to wake idle Coder instances.
Fetched outputs can be triaged with the existing local `debug permute triage`
workflow.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py tests/test_debug_cli_reorg.py::test_representative_grouped_command_help_works -q
```

Expected: pass.

- [ ] **Step 3: Run broader relevant test slice**

Run:

```bash
cd tools/melee-agent
pytest tests/test_mwcc_debug_permuter_remote.py tests/test_debug_cli_reorg.py tests/test_mwcc_debug_permuter_config.py -q
```

Expected: pass.

- [ ] **Step 4: Run repository pre-commit/build sanity if time permits**

Run from repo root:

```bash
python configure.py && ninja build/GALE01/report.json
```

Expected: configure succeeds and report target builds. If this is too slow or blocked by environment, record the exact failure in the final response.

- [ ] **Step 5: Commit**

```bash
git add docs/mwcc-debug-permuter-integration.md
git commit -m "docs: document remote permuter runs"
```

---

## Self-Review

- Spec coverage:
  - SSH targets: Task 1 config.
  - Detached default: Task 2 `tmux new-session -d`.
  - Submit/fetch/status/tail/stop/list: Tasks 2-4.
  - Ubuntu remote vs arm macOS local: Task 2 uses POSIX shell, tests use fake runner, docs state remote prerequisites.
  - No Coder API: config stores SSH target only.
  - No live SSH tests: all tests use fake runner.
- Placeholder scan: no `TBD`, `TODO`, or unspecified "add tests" steps.
- Type consistency:
  - `RemoteTarget`, `RemoteJob`, `CommandResult`, and `RemoteStatus` are introduced before use.
  - CLI calls match module functions.
  - Fake runner signature accepts `cwd` and `check`, matching `run_command`.
