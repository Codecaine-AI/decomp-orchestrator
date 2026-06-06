# Fast + Directed Match-Search Substrate (Spec 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable search *substrate* — five primitive interfaces + their minimal speed-first implementations + a round-trippable artifact contract — and wire decomp-permuter in as one `ArtifactProducer`, so existing permuter runs get faster (fanned across coder1/2/3) on interfaces shaped for the future directed engine.

**Architecture:** Approach-3 delivery / Approach-2 target. Five protocols (`VariantSource`, `CompileBackend`, `ArtifactProducer`, `ScorePipeline`, `Scheduler`) coordinate two converging paths — a compile-by-us path (our source → local backend) and a harvest path (permuter jobs → producer-scored source-only candidates → recompile-promote). Both converge at one `ScorePipeline.score_byte` + `SearchResult`. Spec is `docs/superpowers/specs/2026-06-01-fast-directed-search-substrate-design.md`.

**Tech Stack:** Python 3.11 (`tools/melee-agent`, pytest); wraps existing `melee-agent` internals: `mwcc_debug/permuter_remote.py` (remote jobs), `mwcc_debug/diff_capture.py:compile_source_variant` (local compile), `mwcc_debug/checkdiff_checker.py` / `convergence_loop.py` (verification), `mwcc_debug/dtk_objdump.py` (disasm).

---

## File Structure

All new code under `tools/melee-agent/src/search/` (new package); tests under `tools/melee-agent/tests/search/`.

- `search/__init__.py` — package marker, public exports.
- `search/artifact.py` — `CompileSpec`, `CompileManifest`, `Provenance`, `CandidateArtifact` (frozen dataclasses; the contract/bus).
- `search/types.py` — supporting value types: `SourceVariant`, `SourceSpec`, `TargetSpec`, `Budget`, `BackendCaps`, `ProducerHandle`, `ProducerStatus`, `SchedulePolicy`, `SearchContext`, `SearchResult`.
- `search/protocols.py` — the five `Protocol`s.
- `search/store.py` — `ArtifactStore`: content-addressed managed root, `.gitignore`d; persists `source_blob`, objects, `CompileManifest`; round-trip reconstruction; verification **lock/restore** helper.
- `search/scoring.py` — `ByteScorePipeline` (tier-1 `score_byte` over the existing objdiff scorer; tier-2 stubbed), `DefaultSchedulePolicy`.
- `search/backends.py` — `PlainLocalBackend` (wraps `diff_capture.compile_source_variant`); `FlattenedLocalBackend` (Task 10, conditional on the spike).
- `search/producers.py` — `PermuterJobProducer` (wraps `permuter_remote` submit/fetch/status/stop).
- `search/sources.py` — `SeedListSource` (and the litmus second source).
- `search/scheduler.py` — `DefaultScheduler` (two-path concurrency, dedup, promote-recompile, lock/restore, accounting).
- `search/adapters.py` — thin adapter seams (`LocalCompiler`, `RemotePermuterClient`, `ByteScorer`, `CheckdiffVerifier`) that map onto the real `melee-agent` functions; the ONE place integration is wired, so the rest is testable with fakes.
- `search/cli.py` — `debug search run` Typer command constructing a `DefaultScheduler` from defaults.

**Adapter principle:** every implementation that touches existing `melee-agent` internals does so *only* through an `adapters.py` seam (a small Protocol + a concrete impl calling the real function). Tests inject fakes for the seam; the real wiring lives in one file.

---

## Task 1: Artifact contract (pure dataclasses)

**Files:**
- Create: `tools/melee-agent/src/search/__init__.py`
- Create: `tools/melee-agent/src/search/artifact.py`
- Test: `tools/melee-agent/tests/search/__init__.py`, `tools/melee-agent/tests/search/test_artifact.py`

- [ ] **Step 1: Write the failing test**
```python
# tests/search/test_artifact.py
from pathlib import Path
from src.search.artifact import CompileSpec, CompileManifest, Provenance, CandidateArtifact, compute_candidate_id

def _spec(tmp_path) -> CompileSpec:
    return CompileSpec(
        target_id="MatToQuat@quatlib", cflags_hash="cf", base_context_hash="bc",
        toolchain_fingerprint="tc", backend_mode="plain-local",
        manifest_path=tmp_path / "manifest.json",
    )

def test_candidate_id_includes_full_compile_context(tmp_path):
    spec_a = _spec(tmp_path)
    spec_b = CompileSpec(**{**spec_a.__dict__, "cflags_hash": "DIFFERENT"})
    # same source text, different compile context -> different candidate_id (dedup must not collapse)
    assert compute_candidate_id(spec_a, "srchash") != compute_candidate_id(spec_b, "srchash")
    # identical context + source -> stable id
    assert compute_candidate_id(spec_a, "srchash") == compute_candidate_id(spec_a, "srchash")

def test_artifact_is_frozen_and_round_trip_fields_present(tmp_path):
    art = CandidateArtifact(
        candidate_id="id", source_hash="sh", source_blob=tmp_path / "s.c",
        compile_spec=_spec(tmp_path), object_path=None, producer_score=12.0,
        byte_score=None, directed_score=None, pcdump_path=None,
        compiler_stderr="", provenance=Provenance("permuter", None, None, "base", {}),
        status="harvested",
    )
    assert art.status == "harvested" and art.object_path is None and art.producer_score == 12.0
    import dataclasses
    with __import__("pytest").raises(dataclasses.FrozenInstanceError):
        art.byte_score = 5  # frozen
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_artifact.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.search'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/__init__.py
"""Reusable match-search substrate (Spec 1)."""

# src/search/artifact.py
from __future__ import annotations
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

@dataclass(frozen=True)
class CompileSpec:
    target_id: str
    cflags_hash: str
    base_context_hash: str
    toolchain_fingerprint: str
    backend_mode: str
    manifest_path: Path  # persisted CompileManifest holding the actual reconstructable inputs

@dataclass(frozen=True)
class CompileManifest:
    """Actual reconstructable inputs (persisted once per distinct CompileSpec)."""
    compile_command: list[str]
    cflags: list[str]
    include_paths: list[str]
    base_context_blob: Path
    permuter_compile_sh: Path | None = None
    permuter_settings_toml: Path | None = None

@dataclass(frozen=True)
class Provenance:
    source_name: str
    parent_id: str | None
    mutation: str | None
    base_hash: str
    producer_meta: dict

@dataclass(frozen=True)
class CandidateArtifact:
    candidate_id: str
    source_hash: str
    source_blob: Path
    compile_spec: CompileSpec
    object_path: Path | None
    producer_score: float | None
    byte_score: int | None
    directed_score: float | None
    pcdump_path: Path | None
    compiler_stderr: str
    provenance: Provenance
    status: Literal["ok", "harvested", "compile_failed", "score_failed"]

def compute_candidate_id(spec: CompileSpec, source_hash: str) -> str:
    h = hashlib.sha256()
    for part in (spec.target_id, spec.cflags_hash, spec.base_context_hash,
                 spec.toolchain_fingerprint, spec.backend_mode, source_hash):
        h.update(part.encode()); h.update(b"\0")
    return h.hexdigest()[:32]
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_artifact.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/__init__.py tools/melee-agent/src/search/artifact.py tools/melee-agent/tests/search/__init__.py tools/melee-agent/tests/search/test_artifact.py
git commit -m "feat(search): artifact contract (CompileSpec/Manifest/Provenance/CandidateArtifact)"
```

---

## Task 2: Supporting value types + the five Protocols

**Files:**
- Create: `tools/melee-agent/src/search/types.py`
- Create: `tools/melee-agent/src/search/protocols.py`
- Test: `tools/melee-agent/tests/search/test_protocols.py`

- [ ] **Step 1: Write the failing test** (a trivial fake must satisfy each Protocol via `isinstance` runtime-checkable)
```python
# tests/search/test_protocols.py
from pathlib import Path
from src.search import protocols as P
from src.search.types import SourceVariant, TargetSpec, Budget, BackendCaps
from src.search.artifact import CandidateArtifact

class FakeSource:
    def name(self): return "fake"
    def seed(self, base): pass
    def next_batch(self, n): return []
    def observe(self, scored): pass

def test_fake_source_satisfies_protocol():
    assert isinstance(FakeSource(), P.VariantSource)

def test_value_types_construct():
    sv = SourceVariant(source_text="int f(){}", provenance=None)
    assert sv.source_text.startswith("int")
    assert Budget(max_iters=10, max_seconds=5.0).max_iters == 10
    assert BackendCaps(location="local", parallelism=4, supports_pcdump=False).parallelism == 4
    assert TargetSpec(function="MatToQuat", unit="quatlib", expected_obj=Path("/x")).function == "MatToQuat"
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_protocols.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.search.types'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/types.py
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Any

@dataclass(frozen=True)
class SourceVariant:
    source_text: str
    provenance: Any  # Provenance | None (avoid import cycle; artifact.Provenance at runtime)

@dataclass(frozen=True)
class SourceSpec:
    base_source: str
    target: "TargetSpec"

@dataclass(frozen=True)
class TargetSpec:
    function: str
    unit: str
    expected_obj: Path

@dataclass(frozen=True)
class Budget:
    max_iters: int | None = None
    max_seconds: float | None = None

@dataclass(frozen=True)
class BackendCaps:
    location: Literal["local", "remote"]
    parallelism: int
    supports_pcdump: bool

@dataclass(frozen=True)
class ProducerHandle:
    producer_name: str
    job_ids: list[str]

@dataclass(frozen=True)
class ProducerStatus:
    state: Literal["running", "drained", "failed"]
    detail: str = ""

@dataclass
class SearchContext:
    iters_done: int = 0
    best_byte_score: int | None = None

@dataclass(frozen=True)
class SchedulePolicy:
    """Replaceable by L3. Names the Spec-1 default behavior."""
    batch_size: int = 16
    promote_top_k: int = 8          # recompile this many best-by-producer_score harvested candidates per poll
    max_retries: int = 2
    route_pcdump_to_capable_only: bool = True

@dataclass
class SearchResult:
    best: list[CandidateArtifactRef := Any] = field(default_factory=list)  # list[CandidateArtifact]
    matched: Any = None             # CandidateArtifact | None (byte_score==0 and checkdiff-confirmed)
    accounting: dict = field(default_factory=dict)  # counters: compiled, harvested, promoted, failures...

# src/search/protocols.py
from __future__ import annotations
from pathlib import Path
from typing import Protocol, runtime_checkable
from src.search.types import (SourceVariant, SourceSpec, TargetSpec, Budget, BackendCaps,
                              ProducerHandle, ProducerStatus, SearchContext, SearchResult, SchedulePolicy)
from src.search.artifact import CandidateArtifact

@runtime_checkable
class VariantSource(Protocol):
    def name(self) -> str: ...
    def seed(self, base: SourceSpec) -> None: ...
    def next_batch(self, n: int) -> list[SourceVariant]: ...
    def observe(self, scored: list[CandidateArtifact]) -> None: ...

@runtime_checkable
class CompileBackend(Protocol):
    def name(self) -> str: ...
    def capabilities(self) -> BackendCaps: ...
    def compile(self, variant: SourceVariant, *, want_pcdump: bool = False) -> CandidateArtifact: ...

@runtime_checkable
class ArtifactProducer(Protocol):
    def name(self) -> str: ...
    def start(self, base: SourceSpec, target: TargetSpec, budget: Budget) -> ProducerHandle: ...
    def poll(self, handle: ProducerHandle) -> list[CandidateArtifact]: ...
    def status(self, handle: ProducerHandle) -> ProducerStatus: ...
    def stop(self, handle: ProducerHandle) -> None: ...

@runtime_checkable
class ScorePipeline(Protocol):
    def score_byte(self, art: CandidateArtifact, target: TargetSpec) -> CandidateArtifact: ...
    def should_escalate(self, art: CandidateArtifact, ctx: SearchContext) -> bool: ...
    def score_directed(self, art: CandidateArtifact, objective: object) -> CandidateArtifact: ...

@runtime_checkable
class Scheduler(Protocol):
    def run(self, *, sources: list[VariantSource], backends: list[CompileBackend],
            producers: list[ArtifactProducer], pipeline: ScorePipeline,
            target: TargetSpec, budget: Budget, policy: SchedulePolicy) -> SearchResult: ...
```
*(Note: simplify `SearchResult` to plain `list` fields if the walrus annotation trips the linter — replace `best: list[CandidateArtifactRef := Any]` with `best: list = field(default_factory=list)`.)*

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_protocols.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/types.py tools/melee-agent/src/search/protocols.py tools/melee-agent/tests/search/test_protocols.py
git commit -m "feat(search): value types + five runtime-checkable protocols"
```

---

## Task 3: Managed artifact store (content-addressed, gitignored, round-trip, lock/restore)

**Files:**
- Create: `tools/melee-agent/src/search/store.py`
- Test: `tools/melee-agent/tests/search/test_store.py`

- [ ] **Step 1: Write the failing test**
```python
# tests/search/test_store.py
from pathlib import Path
from src.search.store import ArtifactStore
from src.search.artifact import CompileManifest

def test_store_is_outside_repo_and_content_addressed(tmp_path):
    store = ArtifactStore(root=tmp_path / "store")
    p1 = store.put_source("int f(){return 0;}")
    p2 = store.put_source("int f(){return 0;}")
    assert p1 == p2                      # content-addressed: same text -> same path
    assert store.root in p1.parents      # under the managed root
    assert (store.root / ".gitignore").read_text().strip() == "*"

def test_manifest_round_trips(tmp_path):
    store = ArtifactStore(root=tmp_path / "store")
    man = CompileManifest(compile_command=["mwcc", "-c"], cflags=["-O4,p"],
                          include_paths=["src"], base_context_blob=tmp_path / "base.c")
    mp = store.put_manifest(man)
    got = store.read_manifest(mp)
    assert got.compile_command == ["mwcc", "-c"] and got.cflags == ["-O4,p"]

def test_locked_staging_restores_prior_object(tmp_path):
    store = ArtifactStore(root=tmp_path / "store")
    build_obj = tmp_path / "build" / "x.o"; build_obj.parent.mkdir(parents=True); build_obj.write_bytes(b"ORIG")
    cand_obj = tmp_path / "cand.o"; cand_obj.write_bytes(b"CANDIDATE")
    with store.stage_for_verify(build_obj, cand_obj):
        assert build_obj.read_bytes() == b"CANDIDATE"
    assert build_obj.read_bytes() == b"ORIG"        # restored on exit
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_store.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.search.store'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/store.py
from __future__ import annotations
import contextlib, hashlib, json, shutil
from dataclasses import asdict
from pathlib import Path
from src.search.artifact import CompileManifest

class ArtifactStore:
    def __init__(self, root: Path):
        self.root = Path(root)
        (self.root / "sources").mkdir(parents=True, exist_ok=True)
        (self.root / "manifests").mkdir(parents=True, exist_ok=True)
        (self.root / "objects").mkdir(parents=True, exist_ok=True)
        gi = self.root / ".gitignore"
        if not gi.exists():
            gi.write_text("*\n")  # nothing in the managed store is ever tracked

    def _addr(self, text: bytes) -> str:
        return hashlib.sha256(text).hexdigest()[:32]

    def put_source(self, source_text: str) -> Path:
        b = source_text.encode()
        p = self.root / "sources" / f"{self._addr(b)}.c"
        if not p.exists(): p.write_bytes(b)
        return p

    def put_manifest(self, man: CompileManifest) -> Path:
        payload = asdict(man)
        for k, v in payload.items():
            if isinstance(v, Path): payload[k] = str(v)
        blob = json.dumps(payload, sort_keys=True).encode()
        p = self.root / "manifests" / f"{self._addr(blob)}.json"
        if not p.exists(): p.write_bytes(blob)
        return p

    def read_manifest(self, path: Path) -> CompileManifest:
        d = json.loads(Path(path).read_text())
        for k in ("base_context_blob", "permuter_compile_sh", "permuter_settings_toml"):
            if d.get(k) is not None: d[k] = Path(d[k])
        return CompileManifest(**d)

    @contextlib.contextmanager
    def stage_for_verify(self, build_obj: Path, candidate_obj: Path):
        """Copy candidate into build_obj under a lock; ALWAYS restore the prior object."""
        backup = build_obj.with_suffix(build_obj.suffix + ".search-bak")
        had_prior = build_obj.exists()
        if had_prior: shutil.copy2(build_obj, backup)
        try:
            shutil.copy2(candidate_obj, build_obj)
            yield build_obj
        finally:
            if had_prior: shutil.move(str(backup), str(build_obj))
            elif build_obj.exists(): build_obj.unlink()
```
*(A real cross-process lock — `filelock` on `build_obj` — is added in Task 7 where concurrency is introduced; the context manager's restore semantics are what this task locks down.)*

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_store.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/store.py tools/melee-agent/tests/search/test_store.py
git commit -m "feat(search): managed artifact store + verify staging with guaranteed restore"
```

---

## Task 4: Adapter seams + `ByteScorePipeline` + `DefaultSchedulePolicy`

**Files:**
- Create: `tools/melee-agent/src/search/adapters.py`
- Create: `tools/melee-agent/src/search/scoring.py`
- Test: `tools/melee-agent/tests/search/test_scoring.py`

- [ ] **Step 1: Discovery — confirm the byte scorer + checkdiff verifier signatures**
Run: `cd tools/melee-agent && python -c "import inspect, src.mwcc_debug.diff_capture as d; print(inspect.signature(d.compile_source_variant))"`
Run: `grep -nE 'def |class ' src/mwcc_debug/checkdiff_checker.py | head`
Record the real signatures in a comment at the top of `adapters.py`. The adapter wraps these; if a name differs, adjust the adapter impl only (tests use fakes, so the rest is unaffected).

- [ ] **Step 2: Write the failing test** (scoring works against a fake `ByteScorer`)
```python
# tests/search/test_scoring.py
from pathlib import Path
from src.search.scoring import ByteScorePipeline, DefaultSchedulePolicy
from src.search.types import TargetSpec, SearchContext
from src.search.artifact import CandidateArtifact, CompileSpec, Provenance

def _art(tmp_path, obj):
    return CandidateArtifact("id","sh",tmp_path/"s.c",
        CompileSpec("f@u","c","b","t","plain-local",tmp_path/"m.json"),
        obj, None, None, None, None, "", Provenance("seed",None,None,"base",{}), "ok")

class FakeScorer:
    def byte_distance(self, obj_path, target): return 0 if obj_path and obj_path.name=="match.o" else 7

def test_score_byte_sets_score_from_scorer(tmp_path):
    pipe = ByteScorePipeline(scorer=FakeScorer())
    art = pipe.score_byte(_art(tmp_path, tmp_path/"x.o"), TargetSpec("f","u",tmp_path/"e.o"))
    assert art.byte_score == 7

def test_score_byte_none_object_is_score_failed(tmp_path):
    pipe = ByteScorePipeline(scorer=FakeScorer())
    art = pipe.score_byte(_art(tmp_path, None), TargetSpec("f","u",tmp_path/"e.o"))
    assert art.byte_score is None and art.status == "score_failed"

def test_should_escalate_false_in_spec1(tmp_path):
    pipe = ByteScorePipeline(scorer=FakeScorer())
    assert pipe.should_escalate(_art(tmp_path, tmp_path/"x.o"), SearchContext()) is False

def test_default_policy_values():
    assert DefaultSchedulePolicy().promote_top_k == 8
```

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/adapters.py
"""The ONE place that touches existing melee-agent internals. Everything else uses these seams."""
from __future__ import annotations
from pathlib import Path
from typing import Protocol
from src.search.types import TargetSpec

class ByteScorer(Protocol):
    def byte_distance(self, obj_path: Path, target: TargetSpec) -> int: ...

class LocalCompiler(Protocol):
    def compile(self, source_text: str, target: TargetSpec) -> tuple[Path | None, str]: ...  # (obj_or_None, stderr)

class RemotePermuterClient(Protocol):
    def submit(self, base_dir: Path, function: str, remote: str) -> str: ...           # job_id
    def fetch(self, job_id: str) -> list[tuple[Path, float]]: ...                       # [(source.c, score)]
    def status(self, job_id: str) -> str: ...                                          # running|drained|failed
    def stop(self, job_id: str) -> None: ...

class CheckdiffVerifier(Protocol):
    def is_match(self, function: str, obj_path: Path) -> bool: ...

# src/search/scoring.py
from __future__ import annotations
from dataclasses import replace
from src.search.adapters import ByteScorer
from src.search.artifact import CandidateArtifact
from src.search.types import TargetSpec, SearchContext, SchedulePolicy

def DefaultSchedulePolicy() -> SchedulePolicy:
    return SchedulePolicy()  # documented defaults live on the dataclass (Task 2)

class ByteScorePipeline:
    def __init__(self, scorer: ByteScorer):
        self._scorer = scorer

    def score_byte(self, art: CandidateArtifact, target: TargetSpec) -> CandidateArtifact:
        if art.object_path is None:
            return replace(art, status="score_failed")
        dist = self._scorer.byte_distance(art.object_path, target)
        return replace(art, byte_score=dist, status="ok")

    def should_escalate(self, art: CandidateArtifact, ctx: SearchContext) -> bool:
        return False  # tier-2 disabled in Spec 1

    def score_directed(self, art, objective):
        raise NotImplementedError("tier-2 directed scoring is a later spec")
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_scoring.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/adapters.py tools/melee-agent/src/search/scoring.py tools/melee-agent/tests/search/test_scoring.py
git commit -m "feat(search): adapter seams + ByteScorePipeline (tier-1) + default policy"
```

---

## Task 5: `PlainLocalBackend` (wraps `diff_capture.compile_source_variant` via the `LocalCompiler` seam)

**Files:**
- Create: `tools/melee-agent/src/search/backends.py`
- Test: `tools/melee-agent/tests/search/test_backends.py`

- [ ] **Step 1: Write the failing test** (backend uses a fake `LocalCompiler`; no real mwcc in unit tests)
```python
# tests/search/test_backends.py
from pathlib import Path
from src.search.backends import PlainLocalBackend
from src.search.store import ArtifactStore
from src.search.types import SourceVariant, TargetSpec, BackendCaps
from src.search.artifact import CompileSpec

class FakeCompiler:
    def __init__(self, tmp): self.tmp = tmp; self.calls = 0
    def compile(self, source_text, target):
        self.calls += 1
        obj = self.tmp / "out.o"; obj.write_bytes(b"OBJ:" + source_text.encode())
        return obj, ""

def _spec(tmp): return CompileSpec("f@u","c","b","t","plain-local",tmp/"m.json")

def test_plain_local_backend_compiles_and_persists(tmp_path):
    store = ArtifactStore(tmp_path/"store"); comp = FakeCompiler(tmp_path)
    be = PlainLocalBackend(compiler=comp, store=store, compile_spec_factory=lambda v: _spec(tmp_path))
    art = be.compile(SourceVariant("int f(){return 1;}", None), )
    assert art.status == "ok" and art.object_path is not None
    assert store.root in art.source_blob.parents      # source persisted in managed store
    assert be.capabilities() == BackendCaps("local", 1, False)

def test_compile_failure_yields_compile_failed(tmp_path):
    store = ArtifactStore(tmp_path/"store")
    class FailComp:
        def compile(self, s, t): return None, "error: boom"
    be = PlainLocalBackend(compiler=FailComp(), store=store, compile_spec_factory=lambda v: _spec(tmp_path))
    art = be.compile(SourceVariant("bad", None))
    assert art.status == "compile_failed" and art.object_path is None and "boom" in art.compiler_stderr
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_backends.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'src.search.backends'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/backends.py
from __future__ import annotations
import hashlib
from pathlib import Path
from typing import Callable
from src.search.adapters import LocalCompiler
from src.search.artifact import CandidateArtifact, CompileSpec, Provenance, compute_candidate_id
from src.search.store import ArtifactStore
from src.search.types import SourceVariant, TargetSpec, BackendCaps

class PlainLocalBackend:
    def __init__(self, *, compiler: LocalCompiler, store: ArtifactStore,
                 compile_spec_factory: Callable[[SourceVariant], CompileSpec],
                 target: TargetSpec | None = None):
        self._compiler = compiler; self._store = store
        self._spec_factory = compile_spec_factory; self._target = target

    def name(self) -> str: return "plain-local"
    def capabilities(self) -> BackendCaps: return BackendCaps("local", 1, False)

    def compile(self, variant: SourceVariant, *, want_pcdump: bool = False) -> CandidateArtifact:
        spec = self._spec_factory(variant)
        source_blob = self._store.put_source(variant.source_text)
        source_hash = hashlib.sha256(variant.source_text.encode()).hexdigest()[:32]
        cid = compute_candidate_id(spec, source_hash)
        prov = variant.provenance or Provenance("unknown", None, None, "", {})
        obj, stderr = self._compiler.compile(variant.source_text, self._target)
        status = "ok" if obj is not None else "compile_failed"
        return CandidateArtifact(cid, source_hash, source_blob, spec, obj, None, None, None,
                                 None, stderr, prov, status)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_backends.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/backends.py tools/melee-agent/tests/search/test_backends.py
git commit -m "feat(search): PlainLocalBackend over the LocalCompiler seam"
```

---

## Task 6: `PermuterJobProducer` (wraps `permuter_remote`; emits source-only harvested candidates)

**Files:**
- Create: `tools/melee-agent/src/search/producers.py`
- Test: `tools/melee-agent/tests/search/test_producers.py`

- [ ] **Step 1: Write the failing test** (fake `RemotePermuterClient`; assert poll yields harvested, object-less, producer-scored candidates)
```python
# tests/search/test_producers.py
from pathlib import Path
from src.search.producers import PermuterJobProducer
from src.search.store import ArtifactStore
from src.search.types import SourceSpec, TargetSpec, Budget
from src.search.artifact import CompileSpec

class FakeRemote:
    def __init__(self, tmp): self.tmp = tmp; self.stopped = []
    def submit(self, base_dir, function, remote): return f"{function}-{remote}-job"
    def fetch(self, job_id):
        sc = self.tmp / f"{job_id}.c"; sc.write_text("int f(){return 9;}")
        return [(sc, 1560.0)]
    def status(self, job_id): return "running"
    def stop(self, job_id): self.stopped.append(job_id)

def _spec(tmp): return CompileSpec("f@u","c","b","t","permuter-job",tmp/"m.json")

def test_poll_yields_harvested_sourceonly_candidates(tmp_path):
    store = ArtifactStore(tmp_path/"store"); rem = FakeRemote(tmp_path)
    prod = PermuterJobProducer(client=rem, store=store, remotes=["coder1","coder3"],
                               compile_spec_factory=lambda txt: _spec(tmp_path))
    h = prod.start(SourceSpec("base", TargetSpec("f","u",tmp_path/"e.o")),
                   TargetSpec("f","u",tmp_path/"e.o"), Budget(max_iters=1000))
    assert len(h.job_ids) == 2                      # fanned across both remotes
    cands = prod.poll(h)
    assert cands, "expected harvested candidates"
    c = cands[0]
    assert c.status == "harvested" and c.object_path is None and c.byte_score is None
    assert c.producer_score == 1560.0
    assert store.root in c.source_blob.parents

def test_stop_only_targets_our_jobs(tmp_path):
    store = ArtifactStore(tmp_path/"store"); rem = FakeRemote(tmp_path)
    prod = PermuterJobProducer(client=rem, store=store, remotes=["coder1"],
                               compile_spec_factory=lambda txt: _spec(tmp_path))
    h = prod.start(SourceSpec("base", TargetSpec("f","u",tmp_path/"e.o")),
                   TargetSpec("f","u",tmp_path/"e.o"), Budget())
    prod.stop(h)
    assert rem.stopped == h.job_ids
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_producers.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'src.search.producers'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/producers.py
from __future__ import annotations
import hashlib
from pathlib import Path
from typing import Callable
from src.search.adapters import RemotePermuterClient
from src.search.artifact import CandidateArtifact, CompileSpec, Provenance, compute_candidate_id
from src.search.store import ArtifactStore
from src.search.types import SourceSpec, TargetSpec, Budget, ProducerHandle, ProducerStatus

class PermuterJobProducer:
    def __init__(self, *, client: RemotePermuterClient, store: ArtifactStore,
                 remotes: list[str], compile_spec_factory: Callable[[str], CompileSpec]):
        self._client = client; self._store = store
        self._remotes = remotes; self._spec_factory = compile_spec_factory
        self._seen: set[str] = set()

    def name(self) -> str: return "permuter-job"

    def start(self, base: SourceSpec, target: TargetSpec, budget: Budget) -> ProducerHandle:
        base_dir = self._store.root / "permuter-bases" / target.function
        base_dir.mkdir(parents=True, exist_ok=True)
        (base_dir / "base.c").write_text(base.base_source)
        job_ids = [self._client.submit(base_dir, target.function, r) for r in self._remotes]
        return ProducerHandle(self.name(), job_ids)

    def poll(self, handle: ProducerHandle) -> list[CandidateArtifact]:
        out: list[CandidateArtifact] = []
        for jid in handle.job_ids:
            for src_path, producer_score in self._client.fetch(jid):
                text = Path(src_path).read_text()
                shash = hashlib.sha256(text.encode()).hexdigest()[:32]
                spec = self._spec_factory(text)
                cid = compute_candidate_id(spec, shash)
                if cid in self._seen:        # producer-level dedup (Scheduler dedups again on candidate_id)
                    continue
                self._seen.add(cid)
                blob = self._store.put_source(text)
                prov = Provenance("permuter-job", None, None, "base",
                                  {"job_id": jid, "permuter_score": producer_score})
                out.append(CandidateArtifact(cid, shash, blob, spec, None, producer_score,
                                             None, None, None, "", prov, "harvested"))
        return out

    def status(self, handle: ProducerHandle) -> ProducerStatus:
        states = {self._client.status(j) for j in handle.job_ids}
        if "running" in states: return ProducerStatus("running")
        if states == {"drained"}: return ProducerStatus("drained")
        return ProducerStatus("failed", detail=",".join(sorted(states)))

    def stop(self, handle: ProducerHandle) -> None:
        for jid in handle.job_ids:           # don't-clobber: only our own job ids
            self._client.stop(jid)
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_producers.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/producers.py tools/melee-agent/tests/search/test_producers.py
git commit -m "feat(search): PermuterJobProducer (source-only harvest, fanned remotes)"
```

---

## Task 7: `DefaultScheduler` (two paths, dedup, promote-recompile, score, accounting)

**Files:**
- Create: `tools/melee-agent/src/search/scheduler.py`
- Test: `tools/melee-agent/tests/search/test_scheduler.py`

- [ ] **Step 1: Write the failing test** (compose fakes from earlier tasks; assert harvested candidates are recompiled+scored and the match short-circuits)
```python
# tests/search/test_scheduler.py
from pathlib import Path
from src.search.scheduler import DefaultScheduler
from src.search.scoring import ByteScorePipeline
from src.search.store import ArtifactStore
from src.search.backends import PlainLocalBackend
from src.search.producers import PermuterJobProducer
from src.search.types import SourceSpec, TargetSpec, Budget, SchedulePolicy
from src.search.artifact import CompileSpec
from tests.search.test_producers import FakeRemote
from tests.search.test_backends import FakeCompiler

def _spec(tmp, mode): return CompileSpec("f@u","c","b","t",mode,tmp/"m.json")

class MatchScorer:
    # any recompiled object scores 0 (a match)
    def byte_distance(self, obj_path, target): return 0

def test_scheduler_promotes_harvested_then_scores_and_matches(tmp_path):
    store = ArtifactStore(tmp_path/"store")
    backend = PlainLocalBackend(compiler=FakeCompiler(tmp_path), store=store,
                                compile_spec_factory=lambda v: _spec(tmp_path,"plain-local"))
    producer = PermuterJobProducer(client=FakeRemote(tmp_path), store=store, remotes=["coder1"],
                                   compile_spec_factory=lambda t: _spec(tmp_path,"permuter-job"))
    pipe = ByteScorePipeline(scorer=MatchScorer())
    sched = DefaultScheduler(store=store, verifier=None)  # verifier=None => trust byte_score==0
    res = sched.run(sources=[], backends=[backend], producers=[producer], pipeline=pipe,
                    target=TargetSpec("f","u",tmp_path/"e.o"), budget=Budget(max_iters=1),
                    policy=SchedulePolicy(promote_top_k=4))
    assert res.matched is not None and res.matched.byte_score == 0
    assert res.accounting["harvested"] >= 1 and res.accounting["promoted"] >= 1

def test_scheduler_dedups_on_candidate_id(tmp_path):
    store = ArtifactStore(tmp_path/"store")
    class DupProducer(PermuterJobProducer): pass
    # two polls returning the same candidate must compile once
    comp = FakeCompiler(tmp_path)
    backend = PlainLocalBackend(compiler=comp, store=store,
                                compile_spec_factory=lambda v: _spec(tmp_path,"plain-local"))
    producer = PermuterJobProducer(client=FakeRemote(tmp_path), store=store, remotes=["coder1"],
                                   compile_spec_factory=lambda t: _spec(tmp_path,"permuter-job"))
    pipe = ByteScorePipeline(scorer=MatchScorer())
    sched = DefaultScheduler(store=store, verifier=None)
    sched.run(sources=[], backends=[backend], producers=[producer], pipeline=pipe,
              target=TargetSpec("f","u",tmp_path/"e.o"), budget=Budget(max_iters=2),
              policy=SchedulePolicy(promote_top_k=4))
    assert comp.calls == 1   # same harvested candidate recompiled exactly once across polls
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_scheduler.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'src.search.scheduler'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/scheduler.py
from __future__ import annotations
from dataclasses import replace
from pathlib import Path
from src.search.adapters import CheckdiffVerifier
from src.search.artifact import CandidateArtifact
from src.search.store import ArtifactStore
from src.search.types import (SearchResult, TargetSpec, Budget, SchedulePolicy, SourceSpec, SourceVariant)

class DefaultScheduler:
    def __init__(self, *, store: ArtifactStore, verifier: CheckdiffVerifier | None):
        self._store = store; self._verifier = verifier

    def run(self, *, sources, backends, producers, pipeline, target, budget, policy) -> SearchResult:
        acct = {"compiled": 0, "harvested": 0, "promoted": 0, "compile_failed": 0,
                "score_failed": 0, "deduped": 0}
        seen: set[str] = set()
        best: list[CandidateArtifact] = []
        matched: CandidateArtifact | None = None
        base = SourceSpec("", target)  # producers carry their own base in practice; empty here for fakes

        def ingest(art: CandidateArtifact) -> CandidateArtifact | None:
            nonlocal matched
            if art.candidate_id in seen:
                acct["deduped"] += 1; return None
            seen.add(art.candidate_id)
            if art.status == "compile_failed": acct["compile_failed"] += 1; return None
            scored = pipeline.score_byte(art, target)
            if scored.status == "score_failed": acct["score_failed"] += 1; return None
            best.append(scored)
            if scored.byte_score == 0 and (self._verifier is None
                    or self._verifier.is_match(target.function, scored.object_path)):
                matched = scored
            return scored

        handles = [(p, p.start(base, target, budget)) for p in producers]
        backend = backends[0] if backends else None
        iters = budget.max_iters or 1
        for _ in range(iters):
            # compile-by-us path
            for src in sources:
                for variant in src.next_batch(policy.batch_size):
                    if backend is None: break
                    art = backend.compile(variant); acct["compiled"] += 1
                    ingest(art)
                    if matched: break
            # harvest path: poll producers, promote top-K by producer_score via recompile
            for producer, handle in handles:
                harvested = producer.poll(handle)
                acct["harvested"] += len(harvested)
                harvested = [h for h in harvested if h.candidate_id not in seen]
                harvested.sort(key=lambda a: (a.producer_score is None, a.producer_score))
                for cand in harvested[: policy.promote_top_k]:
                    if backend is None: break
                    recompiled = backend.compile(SourceVariant(cand.source_blob.read_text(), cand.provenance))
                    recompiled = replace(recompiled, candidate_id=cand.candidate_id,
                                         producer_score=cand.producer_score, provenance=cand.provenance)
                    acct["promoted"] += 1; acct["compiled"] += 1
                    ingest(recompiled)
                    if matched: break
            if matched: break
        for producer, handle in handles:
            producer.stop(handle)
        best.sort(key=lambda a: (a.byte_score is None, a.byte_score))
        return SearchResult(best=best[:25], matched=matched, accounting=acct)
```
*(Note: `ingest` dedups on `candidate_id`; the promote loop pre-filters `not in seen` so a harvested candidate already compiled isn't recompiled — that's what `comp.calls == 1` asserts.)*

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_scheduler.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/scheduler.py tools/melee-agent/tests/search/test_scheduler.py
git commit -m "feat(search): DefaultScheduler (two-path, dedup, promote-recompile, accounting)"
```

---

## Task 8: `SeedListSource` + the abstraction litmus test (§6.3)

**Files:**
- Create: `tools/melee-agent/src/search/sources.py`
- Test: `tools/melee-agent/tests/search/test_sources_litmus.py`

- [ ] **Step 1: Write the failing test** (a second, trivial VariantSource runs through the SAME scheduler/backend/pipeline with zero changes)
```python
# tests/search/test_sources_litmus.py
from pathlib import Path
from src.search.sources import SeedListSource
from src.search.scheduler import DefaultScheduler
from src.search.scoring import ByteScorePipeline
from src.search.store import ArtifactStore
from src.search.backends import PlainLocalBackend
from src.search.types import TargetSpec, Budget, SchedulePolicy, SourceSpec, SourceVariant
from src.search.artifact import CompileSpec
from tests.search.test_backends import FakeCompiler

def _spec(tmp): return CompileSpec("f@u","c","b","t","plain-local",tmp/"m.json")

class ConstSource:  # the "second source" — proves the abstraction (different shape than SeedListSource)
    def name(self): return "const"
    def seed(self, base): self._b = base
    def next_batch(self, n): return [SourceVariant("int f(){return 0;}", None)]
    def observe(self, scored): pass

def _run(tmp_path, source):
    store = ArtifactStore(tmp_path/"store")
    backend = PlainLocalBackend(compiler=FakeCompiler(tmp_path), store=store,
                                compile_spec_factory=lambda v: _spec(tmp_path))
    class S:  # scores 5 for everything (no match) — we just check it flows through
        def byte_distance(self, o, t): return 5
    sched = DefaultScheduler(store=store, verifier=None)
    source.seed(SourceSpec("base", TargetSpec("f","u",tmp_path/"e.o")))
    return sched.run(sources=[source], backends=[backend], producers=[],
                     pipeline=ByteScorePipeline(scorer=S()),
                     target=TargetSpec("f","u",tmp_path/"e.o"),
                     budget=Budget(max_iters=1), policy=SchedulePolicy())

def test_seedlist_source_flows(tmp_path):
    res = _run(tmp_path, SeedListSource(["int f(){return 1;}", "int f(){return 2;}"]))
    assert res.accounting["compiled"] == 2 and len(res.best) == 2

def test_second_source_drops_in_with_no_engine_change(tmp_path):
    # The LITMUS: a different VariantSource implementation runs through the identical scheduler call.
    res = _run(tmp_path, ConstSource())
    assert res.accounting["compiled"] == 1 and res.best[0].byte_score == 5
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_sources_litmus.py -v`
Expected: FAIL `ModuleNotFoundError: No module named 'src.search.sources'`.

- [ ] **Step 3: Write minimal implementation**
```python
# src/search/sources.py
from __future__ import annotations
from src.search.types import SourceVariant, SourceSpec
from src.search.artifact import Provenance

class SeedListSource:
    def __init__(self, seeds: list[str]):
        self._seeds = list(seeds); self._i = 0; self._base = None
    def name(self) -> str: return "seed-list"
    def seed(self, base: SourceSpec) -> None: self._base = base
    def next_batch(self, n: int) -> list[SourceVariant]:
        out = []
        while self._i < len(self._seeds) and len(out) < n:
            txt = self._seeds[self._i]; self._i += 1
            out.append(SourceVariant(txt, Provenance("seed-list", None, f"seed#{self._i}", "base", {})))
        return out
    def observe(self, scored) -> None: pass
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_sources_litmus.py -v`
Expected: PASS (2 passed) — the litmus (second source, zero engine change) holds.

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/sources.py tools/melee-agent/tests/search/test_sources_litmus.py
git commit -m "feat(search): SeedListSource + abstraction litmus (second source, zero engine change)"
```

---

## Task 9: Real adapter wiring + `debug search run` CLI + end-to-end (§6.1, §6.2, §6.4)

**Files:**
- Modify: `tools/melee-agent/src/search/adapters.py` (add concrete impls wiring the real functions)
- Create: `tools/melee-agent/src/search/cli.py`
- Modify: the Typer app registration (find with the discovery step)
- Test: `tools/melee-agent/tests/search/test_cli_smoke.py`

- [ ] **Step 1: Discovery — find the CLI app + the real function signatures**
Run: `grep -rnE "add_typer|Typer\(|@app.command|@debug_app" src/cli/*.py | grep -i debug | head`
Run: `python -c "import inspect,src.mwcc_debug.permuter_remote as r; print(inspect.signature(r.submit_job)); print(inspect.signature(r.fetch_job)); print(inspect.signature(r.status_job)); print(inspect.signature(r.stop_job))"`
Run: `python -c "import inspect,src.mwcc_debug.diff_capture as d; print(inspect.signature(d.compile_source_variant))"`
Run: `grep -nE "def |class " src/mwcc_debug/checkdiff_checker.py`
Record signatures in `adapters.py` comments; the concrete adapters below call exactly these.

- [ ] **Step 2: Write the failing smoke test** (CLI builds a scheduler and reports accounting on a dry run with `--no-remote`, using a stub seed)
```python
# tests/search/test_cli_smoke.py
from typer.testing import CliRunner
from src.search.cli import search_app

def test_search_run_dry(tmp_path):
    runner = CliRunner()
    seed = tmp_path / "seed.c"; seed.write_text("int MatToQuat(){return 0;}")
    result = runner.invoke(search_app, ["run", "--function", "MatToQuat", "--unit", "quatlib",
                                        "--no-remote", "--seed", str(seed), "--store", str(tmp_path/"store"),
                                        "--max-iters", "1", "--dry-compiler"])
    assert result.exit_code == 0
    assert "accounting" in result.stdout.lower()
```

- [ ] **Step 3: Implement concrete adapters + the CLI**
```python
# src/search/adapters.py  (append concrete impls — these are the ONLY real-API calls)
from pathlib import Path
import src.mwcc_debug.permuter_remote as _pr
import src.mwcc_debug.diff_capture as _dc

class RealLocalCompiler:
    """Wraps diff_capture.compile_source_variant. Adjust the call to its real signature (Task 9 step 1)."""
    def __init__(self, melee_root: Path): self._root = melee_root
    def compile(self, source_text: str, target):
        # compile_source_variant(...) -> Compile/obj per its signature; map to (obj_path|None, stderr).
        res = _dc.compile_source_variant(source_text, target.function, self._root)  # confirm args in step 1
        obj = getattr(res, "object_path", None) or getattr(res, "obj", None)
        return (Path(obj) if obj else None, getattr(res, "stderr", ""))

class RealRemotePermuterClient:
    def submit(self, base_dir: Path, function: str, remote: str) -> str:
        return _pr.submit_job(function=function, target=remote, local_perm_dir=base_dir).job_id  # confirm in step 1
    def fetch(self, job_id: str):
        outs = _pr.fetch_job(job_id)             # returns fetched output dirs; map to [(source.c, score)]
        pairs = []
        for d in outs:
            sc = Path(d) / "source.c"; st = Path(d) / "score.txt"
            if sc.exists() and st.exists():
                pairs.append((sc, float(st.read_text().strip())))
        return pairs
    def status(self, job_id: str) -> str:
        s = _pr.status_job(job_id); return "running" if getattr(s, "active", False) else "drained"
    def stop(self, job_id: str) -> None: _pr.stop_job(job_id)

class RealCheckdiffVerifier:
    def __init__(self, melee_root: Path): self._root = melee_root
    def is_match(self, function: str, obj_path: Path) -> bool:
        from src.mwcc_debug.checkdiff_checker import CheckdiffChecker  # confirm class/args in step 1
        return CheckdiffChecker(function, self._root, obj_path).is_match()
```
```python
# src/search/cli.py
from __future__ import annotations
from pathlib import Path
import json, typer
from src.search.store import ArtifactStore
from src.search.scoring import ByteScorePipeline, DefaultSchedulePolicy
from src.search.scheduler import DefaultScheduler
from src.search.sources import SeedListSource
from src.search.backends import PlainLocalBackend
from src.search.producers import PermuterJobProducer
from src.search.types import TargetSpec, Budget
from src.search.artifact import CompileSpec

search_app = typer.Typer(help="Fast+directed match-search substrate (Spec 1).")

@search_app.command()
def run(function: str = typer.Option(...), unit: str = typer.Option(...),
        store: Path = typer.Option(Path.home()/".cache"/"melee-search"),
        seed: list[Path] = typer.Option(None), no_remote: bool = typer.Option(False),
        remotes: str = typer.Option("coder1,coder2,coder3"),
        max_iters: int = typer.Option(1000), dry_compiler: bool = typer.Option(False)):
    st = ArtifactStore(store)
    melee_root = Path.cwd()
    target = TargetSpec(function, unit, st.root / f"{function}.expected.o")
    spec_factory = lambda *_: CompileSpec(f"{function}@{unit}", "cf", "bc", "tc", "plain-local",
                                          st.put_manifest_stub() if hasattr(st, "put_manifest_stub") else st.root/"m.json")
    if dry_compiler:
        class _Dry:  # smoke-test compiler: emits a stub object
            def compile(self, text, tgt):
                p = st.root/"objects"/"dry.o"; p.write_bytes(b"DRY"); return p, ""
        compiler = _Dry(); scorer = type("S", (), {"byte_distance": lambda self,o,t: 1})()
    else:
        from src.search.adapters import RealLocalCompiler
        from src.mwcc_debug.dtk_objdump import score_bytes  # confirm the real scorer in Task 9 step 1
        compiler = RealLocalCompiler(melee_root)
        scorer = type("S", (), {"byte_distance": staticmethod(lambda o,t: score_bytes(o, t.expected_obj))})()
    backend = PlainLocalBackend(compiler=compiler, store=st, compile_spec_factory=spec_factory, target=target)
    sources = [SeedListSource([p.read_text() for p in (seed or [])])] if seed else []
    producers = []
    if not no_remote:
        from src.search.adapters import RealRemotePermuterClient
        producers = [PermuterJobProducer(client=RealRemotePermuterClient(), store=st,
                     remotes=remotes.split(","), compile_spec_factory=spec_factory)]
    sched = DefaultScheduler(store=st, verifier=None)
    res = sched.run(sources=sources, backends=[backend], producers=producers,
                    pipeline=ByteScorePipeline(scorer=scorer), target=target,
                    budget=Budget(max_iters=max_iters), policy=DefaultSchedulePolicy())
    typer.echo(json.dumps({"matched": bool(res.matched), "best_byte_score":
               (res.best[0].byte_score if res.best else None), "accounting": res.accounting}, indent=2))
```
Register `search_app` under the debug CLI (the discovery step names the exact file/line, e.g. `src/cli/debug.py`): `debug_app.add_typer(search_app, name="search")`.

- [ ] **Step 4: Run smoke test + a real throughput check**
Run: `cd tools/melee-agent && python -m pytest tests/search/test_cli_smoke.py -v` → Expected: PASS.
Run (manual, records §6.2 number): `melee-agent debug search run --function grIceMt_801F9ACC --unit gricemt --remotes coder1,coder2,coder3 --max-iters 200` and confirm jobs fan across all three remotes (`debug permute remote list`); record iter/sec vs a single-remote baseline in the commit message.

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/src/search/adapters.py tools/melee-agent/src/search/cli.py tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/search/test_cli_smoke.py
git commit -m "feat(search): real adapter wiring + debug search run CLI (fanned remotes)"
```

---

## Task 10: Flatten spike (§5) → `FlattenedLocalBackend` (conditional)

**Files:**
- Create: `tools/melee-agent/scripts/flatten_spike.py` (measurement, not shipped behavior)
- Create (only if the spike justifies): `tools/melee-agent/src/search/backends.py:FlattenedLocalBackend`
- Test (only if built): `tools/melee-agent/tests/search/test_flatten_backend.py`

- [ ] **Step 1: Build the spike harness**
Write `scripts/flatten_spike.py` that, for one representative function (`MatToQuat@quatlib`):
(a) compiles the normal per-iter way N=200 times (control); (b) pre-expands includes into one self-contained `.c` (via the project's mwcc/cpp preprocessor with the real cflags from the discovery step) and compiles that N times; (c) compiles via a warm/forked mwcc process N times. Print iter/sec for each.

- [ ] **Step 2: Validation gate — byte-identical `.o`**
In the spike, assert the flattened compile produces a `.o` **byte-identical** to the control for the same source. Run: `python scripts/flatten_spike.py --function MatToQuat --unit quatlib`. Expected: prints three iter/sec numbers + `BYTE-IDENTICAL: True`. If `False`, flattening is invalid — stop, record why, keep `PlainLocalBackend` only.

- [ ] **Step 3: Decide + (conditionally) implement**
If flattened iter/sec ≥ ~1.3× control AND byte-identical holds: implement `FlattenedLocalBackend` (same interface as `PlainLocalBackend`, compiling the pre-expanded TU) with a unit test mirroring `test_backends.py` but asserting the flattened path yields a byte-identical object via a fake expander. If the warm-process variant wins instead, implement that as the fast backend. If neither beats control meaningfully, record the result in the spike output and the spec, and **do not** add a fast backend (remote fan-out remains the guaranteed win).

- [ ] **Step 4: Run tests**
Run: `cd tools/melee-agent && python -m pytest tests/search/ -v`. Expected: all PASS (the flatten backend test only exists if step 3 built it).

- [ ] **Step 5: Commit**
```bash
git add tools/melee-agent/scripts/flatten_spike.py tools/melee-agent/src/search/backends.py tools/melee-agent/tests/search/test_flatten_backend.py
git commit -m "feat(search): flatten spike + FlattenedLocalBackend (gated on measured speedup)"
```

---

## Closing checks (Spec §6 success criteria)

- [ ] **§6.1 both paths end-to-end:** `tests/search/test_scheduler.py` + `test_sources_litmus.py` + `test_producers.py` all green; `debug search run` exercises producer + compile-by-us paths.
- [ ] **§6.2 measured throughput:** the Task 9 step-4 number is recorded in a commit; remote fan-out shows ≈3×.
- [ ] **§6.3 litmus:** `test_second_source_drops_in_with_no_engine_change` passes with no Scheduler/Backend edit.
- [ ] **§6.4 no leaks / restore:** add `tests/search/test_no_leak.py` asserting `git status --porcelain` is empty after a dry run and that `ArtifactStore.stage_for_verify` restores on an injected exception (`with pytest.raises: ...` inside the context). Commit.

---

## Self-Review (run before handoff)

**Spec coverage:** five protocols (Task 2) ✓; artifact + manifest round-trip (Tasks 1,3) ✓; persistent-managed vs locked-staging (Task 3) ✓; dedup on `candidate_id=hash(CompileSpec,source_hash)` (Tasks 1,7) ✓; ArtifactProducer source-only + recompile-promote (Tasks 6,7) ✓; ByteScorePipeline tier-1 + `should_escalate=False` seam (Task 4) ✓; named default policy (Tasks 2,4) ✓; remote fan-out first win (Task 9) ✓; flatten spike gated + byte-identical (Task 10) ✓; §6 criteria (Closing checks) ✓. Two-tier directed scoring, orchestrator, directed generators are out of scope per spec ✓ (seam present, not implemented).

**Placeholder scan:** the only deliberately-deferred bodies are `score_directed` (raises `NotImplementedError`, per spec) and the `FlattenedLocalBackend` (conditional on Task 10's measurement). The three `# confirm in step 1` notes are real discovery steps that resolve exact existing-function signatures, not hand-waves.

**Type consistency:** `CandidateArtifact`/`CompileSpec`/`Provenance` field names are used identically across Tasks 1,5,6,7,9; `compute_candidate_id(spec, source_hash)` signature is stable; the five Protocol method names match their fake/real impls; `SchedulePolicy.promote_top_k` is referenced consistently in Tasks 2,7,8.
