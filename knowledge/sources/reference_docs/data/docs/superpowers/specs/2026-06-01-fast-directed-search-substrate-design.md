# Fast + Directed Match-Search Substrate — Design (Spec 1)

**Status:** Draft for review
**Date:** 2026-06-01
**Scope:** Spec 1 of a multi-spec platform. This spec covers **only** the reusable
search *substrate* (the five primitive interfaces + their minimal speed-first
implementations + the artifact contract + a decomp-permuter `ArtifactProducer`). The
directed search engine, two-tier directed scoring, and directed variant generators are
**deferred** to later specs that snap onto these interfaces.

---

## 1. Motivation

Last-mile decomp "walls" in this project (e.g. `grIceMt_801F9ACC`'s `ev`/`did`
callee-save selection swap; `MatToQuat`'s stack-packing frame delta) share one root
cause: the function's *instructions* already match, but MWCC makes an internal
**layout/allocation decision** — which interfering callee-save gets the lower
register, or how locals pack on the stack — that our reconstructed C produces
differently from the original. The `force-*` diagnostics can *prove the target state
is reachable*, but they don't ship: the committed object must compile from clean C on
stock mwcc.

**The reframe that drives this design:** these are very likely *under-searched*, not
C-impossible. Permuter runs in this project that found matches routinely needed
**100–250K iterations**; the runs we used to declare these functions "terminal" were
~8K iterations — 10–30× too short. So the real blocker is **time-to-match**, which is
multiplicative:

```
time-to-match  ≈  (iterations needed)  ×  (cost per iteration)
                   └ fewer via DIRECTED search   └ cheaper via FAST compile/score + parallelism
```

Both factors must come down. This spec builds the shared substrate that *both* the
fast brute-force path and the future directed path stand on.

### Non-goals (explicitly deferred)
- The directed search **orchestrator** (seed pools, score policy, variant mixing) — later spec.
- **Directed variant generators** (select-order, stack-layout, lifetime-shape, helper-extract) — later spec.
- **Tier-2 directed/pcdump scoring** beyond defining where it plugs in — later spec.
- Any change to what counts as a valid match (still: clean C, stock mwcc, checkdiff `match=true`).

---

## 2. Architecture decision

- **Delivery strategy: Approach 3 (sequenced).** Ship the speed substrate first so
  existing permuter runs get faster immediately and project-wide.
- **Target architecture: Approach 2 (unified orchestrator).** The substrate's
  interfaces are designed *as if the orchestrator already exists*, so the later engine
  grows out of these primitives instead of replacing them.
- **decomp-permuter: Approach 1 demoted to a compatibility adapter.** It becomes *one*
  `ArtifactProducer` (§3.4), not the search loop. The directed scorer's state (decision classes,
  seed lineage, target objectives, scoring tiers, distributed execution, pcdump artifact
  management) lives in our code, never inside decomp-permuter's loop.

**The hard constraint:** the first shipped piece is **not** "permuter speed hacks." It
is the five reusable primitives below, with decomp-permuter wired in (as an
`ArtifactProducer`) as the first consumer. The main trap — "speed first" becoming
"permuter-specific speed forever" — is avoided by defining the primitive interfaces now,
even though decomp-permuter is the only day-1 producer.

### Layering
```
L1  Fast compile/score primitives    (CompileBackend, ScorePipeline tier-1)         ← Spec 1
L2  Distributed execution + producers (Scheduler fan-out/dedup/budgets; ArtifactProducer) ← Spec 1
L3  Search orchestrator               (seed pools, score policy, mixing)              ← later
L4a Candidate inputs                  (ArtifactProducer[permuter jobs] + VariantSource[seeds]) ← Spec 1; structural/mutation VariantSources later
L4b Per-decision scorers              (select-order, stack-layout objectives)         ← later (ScorePipeline tier-2 hook exists in Spec 1)
```
Note: the permuter is an **`ArtifactProducer`** (async external search), not a
`VariantSource` — see §3.4 (the P1 correction).

---

## 3. The five primitives (the contract)

These are the deliverable of Spec 1: `VariantSource`, `CompileBackend`, `ArtifactProducer`,
`ScorePipeline`, `Scheduler` (+ the artifact record). Sketches below are illustrative
(Python, matching the `melee-agent` codebase); exact signatures are finalized in the
implementation plan. The **shape** — not the exact names — is what this spec fixes.

### 3.1 Artifact record — the bus between primitives
Every compile result, success or failure, produces one stable record. This is the
single most important contract: it is the bridge from "fast permuter" to "unified
engine," and every later layer reads/writes it.

```python
@dataclass(frozen=True)
class CompileSpec:
    """Identity of everything that affects the .o besides the source text.
    The hashes are dedup/identity KEYS; the actual reconstructable inputs live in a
    persisted, content-addressed manifest keyed by these hashes (see round-trip note)."""
    target_id: str            # function + translation unit, e.g. "MatToQuat@quatlib"
    cflags_hash: str          # key → manifest: full mwcc flag list + include search paths
    base_context_hash: str    # key → manifest: the surrounding TU body the variant splices into
    toolchain_fingerprint: str# mwcc build id + wibo/wine + debug-DLL version
    backend_mode: str         # "flattened-local" | "plain-local" | "permuter-job" | …
    manifest_path: Path       # the persisted CompileManifest blob (the actual inputs below)

# CompileManifest (stored once per distinct CompileSpec, content-addressed, managed/persistent):
#   exact compile command + full cflag list, resolved include paths, the base-context source
#   blob, and — for ArtifactProducers — the permuter compile.sh + settings.toml used.
#   A record round-trips by: read manifest_path → recover inputs → recompile source_blob.

@dataclass(frozen=True)
class Provenance:
    source_name: str          # which VariantSource / ArtifactProducer produced it
    parent_id: str | None     # seed lineage (the candidate it was mutated from)
    mutation: str | None      # human-readable description of the transform
    base_hash: str            # the base body this run started from
    producer_meta: dict       # producer-specific: permuter job id, remote target, iter#, output dir

@dataclass(frozen=True)
class CandidateArtifact:
    candidate_id: str             # = hash(compile_spec, source_hash) — full compile context, not source alone
    source_hash: str              # hash of the variant source text
    source_blob: Path             # the exact source (always retained — required for round-trip)
    compile_spec: CompileSpec     # identity + manifest pointer for the rest of the compile context
    object_path: Path | None      # compiled .o; None for harvested-but-not-yet-recompiled producer candidates, or compile failure
    producer_score: float | None  # provisional score from an ArtifactProducer (e.g. permuter score.txt); None for compile-by-us
    byte_score: int | None        # tier-1 UNIFORM score (needs object_path; None until compiled/recompiled)
    directed_score: float | None  # tier-2 score (optional; None until escalated)
    pcdump_path: Path | None       # tier-2 input artifact (optional)
    compiler_stderr: str
    provenance: Provenance
    status: Literal["ok", "harvested", "compile_failed", "score_failed"]
```

**Round-trip requirement (P2):** a record must be sufficient to *reconstruct and recompile*
the candidate later — a hash can only *validate* identity, it cannot recover flags, include
paths, base context, compile command, or a producer's `compile.sh`/`settings.toml`.
Therefore round-trip is satisfied by retaining the `source_blob` **and** the persisted
`CompileManifest` (pointed to by `compile_spec.manifest_path`) that holds those actual
inputs. The hashes in `CompileSpec` are the dedup/identity keys *into* that manifest store;
the manifest blobs are persistent managed artifacts (§ below). Rebuild = manifest →
inputs → recompile `source_blob`.

**Two artifact lifetimes (P2):** distinguish
- **Persistent managed artifacts** — `source_blob`, `object_path`, `pcdump_path`, records.
  Content-addressed under one managed root, `.gitignore`d, **never** written into the repo
  source tree. (Directly fixes the prior `nonmatchings/` + `git add -A` papercuts.)
- **Transient locked staging** — verification (checkdiff-style) copies a candidate `.o`
  into the repo's `build/` path under a **lock**, runs the compare, then **restores** the
  prior object. This is unavoidable (checkdiff reads from `build/`), so the rule is not
  "never touch the repo tree" but "**stage under a lock with guaranteed restore**, and only
  for verification, never as the resting place of search artifacts." The `Scheduler` owns
  the lock + restore (and the failure-accounting if a restore is interrupted).

### 3.2 `VariantSource` — vends *uncompiled* candidate sources (the compile-by-us path)
```python
class VariantSource(Protocol):
    def name(self) -> str: ...
    def seed(self, base: SourceSpec) -> None: ...          # initialize from a base body
    def next_batch(self, n: int) -> list[SourceVariant]: ...# up to n (source_text, Provenance)
    def observe(self, scored: list[CandidateArtifact]) -> None: ...  # optional feedback (no-op for stateless sources)
```
- A `VariantSource` produces **source text we then compile** via a `CompileBackend`. It is
  *not* how decomp-permuter is integrated (see the P1 note below and §3.4).
- **Day-1 implementation: `SeedListSource`** (hand-written candidate bodies). It is the
  *only* `VariantSource` in Spec 1, and it exists specifically to prove the abstraction
  (§6.3 litmus test).
- **Deferred (NOT Spec 1): `PermuterMutationSource`** — drive decomp-permuter's randomizer
  to *vend uncompiled variants* into our fast `CompileBackend`. This is attractive (it puts
  permuter mutations on the flattened compile path, where flatten helps most) but requires
  hooking decomp-permuter's randomizer rather than its run loop — real work, deferred until
  the flatten spike (§5) shows it pays off. **Do not assume Spec 1 can vend uncompiled
  permuter variants** — the existing integration only exposes candidates *after*
  decomp-permuter has compiled+scored them; that path is `ArtifactProducer` (§3.4), not
  `VariantSource`.
- `observe` lets future directed sources climb; stateless sources ignore it.

### 3.3 `CompileBackend` — compile ONE given source → object + metadata (synchronous)
```python
class BackendCaps(NamedTuple):
    location: Literal["local", "remote"]
    parallelism: int
    supports_pcdump: bool

class CompileBackend(Protocol):
    def name(self) -> str: ...
    def capabilities(self) -> BackendCaps: ...
    def compile(self, variant: SourceVariant, *, want_pcdump: bool = False) -> CandidateArtifact: ...
```
- A `CompileBackend` compiles **one source we handed it**, synchronously. This is the path
  for `VariantSource` output (seeds today; structural/directed later).
- **Day-1 implementations are LOCAL ONLY: `FlattenedLocalBackend`** (see §5 — gated on the
  measurement spike) and **`PlainLocalBackend`** (current per-iter compile — the spike's
  control + the byte-identical correctness oracle for flattening).
- **There is NO remote per-candidate `CompileBackend` in Spec 1 (P1).** The existing remote
  tooling submits *detached batch permuter jobs* and fetches output directories — it has no
  per-source compile endpoint. Building a remote compile worker/queue is real new infra and
  is **deferred**; in Spec 1 the remote story is handled by `ArtifactProducer` (§3.4), and a
  future async remote `CompileBackend` (submit/poll/fetch lifecycle) is the natural later
  extension for putting *our* variants on remote cores.
- `want_pcdump` is honored only by backends whose `supports_pcdump` is true; Spec 1
  backends may return `pcdump_path=None`. The flag exists now so tier-2 plugs in later
  without an interface change.

### 3.4 `ArtifactProducer` — async external searches that emit *producer-scored, source-only* candidates
```python
class ArtifactProducer(Protocol):
    def name(self) -> str: ...
    def start(self, base: SourceSpec, target: TargetSpec, budget: Budget) -> ProducerHandle: ...
    def poll(self, handle: ProducerHandle) -> list[CandidateArtifact]: ...  # new candidates since last poll
    def status(self, handle: ProducerHandle) -> ProducerStatus: ...          # running | drained | failed
    def stop(self, handle: ProducerHandle) -> None: ...
```
- This is the honest model for **decomp-permuter (local and remote): it runs its OWN
  compile/score loop and emits candidates over time** — we harvest them, we do not feed it
  one source at a time. It is asynchronous and job-shaped, matching the existing
  detached-tmux remote runner + `fetch`.
- **Day-1 implementation: `PermuterJobProducer`** — wraps the existing permuter submit/tail/
  fetch machinery; `start` launches jobs (one per remote, fanned across **coder1/2/3** =
  ~48 threads; or local), `status`/`stop` map to the job lifecycle. **Don't-clobber:** `stop`
  only ever targets jobs whose `local_perm_dir` is ours.
- **`poll` semantics (P1 — decomp-permuter does NOT emit objects):** a permuter output dir is
  `source.c` + `score.txt` + `diff.txt` (verified — no `.o`). So `poll` yields
  `CandidateArtifact`s with `source_blob` = the harvested `source.c`, `producer_score` = the
  permuter's own `score.txt`, **`object_path = None`, `status = "harvested"`, `byte_score =
  None`.** Uniform `ScorePipeline.score_byte` requires an object, so the Scheduler
  **recompiles promising harvested candidates** (selected by `producer_score`) through a
  local `CompileBackend` to obtain the `.o`, which is then scored uniformly via
  `ScorePipeline.score_byte` and is the object checkdiff needs (§3.6). (`CompileBackend`
  produces the object; `byte_score` always comes from `ScorePipeline`, never the backend.) We do **not** recompile every harvested candidate — the permuter's own score
  is the cheap triage; recompile is the promotion step. (A future "preserve-object" permuter
  wrapper could skip the recompile, but is out of scope.)
- **Where the speed win comes from for the permuter (P1):** (a) `start` fans jobs across all
  remotes instead of one — a guaranteed throughput win, no per-candidate remote compile;
  (b) **if** the §5 spike validates flattening, the base handed to `start` is the flattened
  `base.c`, which would also speed decomp-permuter's *internal* compiles — but that is
  contingent on the spike, not assumed.
- The `Scheduler` (§3.6) runs `ArtifactProducer`s and the `VariantSource→CompileBackend`
  path concurrently; both converge into the same `ScorePipeline` + `SearchResult`.

### 3.5 `ScorePipeline` — tiered scoring
```python
class ScorePipeline(Protocol):
    def score_byte(self, art: CandidateArtifact, target: TargetSpec) -> CandidateArtifact: ...
    def should_escalate(self, art: CandidateArtifact, ctx: SearchContext) -> bool: ...
    def score_directed(self, art: CandidateArtifact, objective: DecisionObjective) -> CandidateArtifact: ...
```
- Spec 1 implements **`score_byte`** (cheap objdiff/byte compare of *only the target
  function*, not the whole object) and a **default `should_escalate` that returns
  `False`** (tier-2 disabled). `score_directed` is defined but Spec 1 ships a stub that
  raises `NotImplementedError`.
- This is the two-tier seam: byte on everything; directed only on promising / ties /
  plateau neighborhoods / structurally-targeted batches — implemented in a later spec by
  swapping in a real `should_escalate` + `score_directed`, with **no** change to the
  other primitives.

### 3.6 `Scheduler` — fan-out, dedup, budgets, accounting
```python
class Scheduler(Protocol):
    def run(self, *, sources: list[VariantSource], backends: list[CompileBackend],
            producers: list[ArtifactProducer], pipeline: ScorePipeline,
            target: TargetSpec, budget: Budget, policy: SchedulePolicy) -> SearchResult: ...
```
- Owns (mechanism): running both paths concurrently — the
  `VariantSource→CompileBackend` compile path *and* the `ArtifactProducer` harvest path —
  feeding both into the `ScorePipeline`; **promotion of harvested candidates** (P1:
  `status="harvested"` candidates carry only a `producer_score`; the Scheduler recompiles
  the promising ones via a local `CompileBackend` for the `.o`, then scores them uniformly
  via `ScorePipeline.score_byte` (the `.o` is also what verification needs) — triaged by
  `producer_score`, not recompiled wholesale);
  **dedup**; **budgets** (max iters / wall-clock / token-equivalent); artifact-root
  management + the verification **lock/restore** (§3.1); and **failure accounting** (compile
  failures, remote drops, timeouts, interrupted restores — surfaced as counters, never
  silent).
- **Dedup key (P2): `candidate_id = hash(CompileSpec, source_hash)`**, not `source_hash`
  alone. The same source text compiled for a different target / cflags / base context /
  backend mode / toolchain is a *different* candidate and must not be deduped away.
- **Default policy, named (P3):** the Scheduler owns *mechanism* but ships one explicit,
  replaceable `SchedulePolicy`: **deterministic round-robin across sources/producers +
  backend-capability filtering** (route `want_pcdump` only to pcdump-capable backends; cap
  per-backend in-flight at `parallelism`) + **bounded retry** (N attempts on transient
  remote/compile failure, then record as failed) + call `observe` once per drained batch.
  It does **not** own seed *strategy* or score *policy* — those are the L3 orchestrator's,
  which replaces `SchedulePolicy` wholesale. Naming the default now is what lets L3 swap it
  cleanly later.

---

## 4. Data flow (Spec 1 wiring — two converging paths)

```
 COMPILE-BY-US PATH                          HARVEST PATH
 VariantSource.next_batch(n)                 ArtifactProducer.start()  [permuter jobs, fanned coder1/2/3]
      │ SourceVariant[]                            │  (async; runs its OWN compile/score loop)
      ▼                                            │ poll() → CandidateArtifact[]  (source_blob + producer_score;
 Scheduler.dedup(candidate_id)                     │                                object_path=None, status="harvested")
      │                                            ▼
      │                              Scheduler: promote promising (by producer_score)
      │                                            │  recompile via local CompileBackend → .o
      ▼                                            ▼
 CompileBackend.compile()  [local: flattened/plain]│
      │ CandidateArtifact (+object_path)           │ CandidateArtifact (+object_path)
      ▼                                            ▼
      └─────────────►  ScorePipeline.score_byte(target)  ◄────────────┘
                       (score_byte is the SOLE source of byte_score, both paths)
                              │ CandidateArtifact (+byte_score)
        should_escalate? ── False (Spec 1) ─┘     (True path → score_directed: later spec)
                              ▼
                 SearchResult (best by byte_score, full artifact records, accounting)
                              │
                              └─► VariantSource.observe(scored)   (feedback; no-op for stateless sources)
```

Both paths converge at `ScorePipeline` + `SearchResult` + the artifact contract — that
convergence is what makes them one system rather than two tools. A `match=true` candidate
(byte_score == 0 *and* checkdiff confirms via the locked staging in §3.1) short-circuits
and is reported immediately with its reproducible `source_blob` + `CompileSpec` +
provenance.

---

## 5. Sharpening 1 — flatten is a hypothesis; spec a measurement spike

Pre-expanding the base TU's includes into one self-contained `.c` (so each iteration
parses minimal text instead of re-resolving the whole include tree from disk) is
*expected* to be the single biggest per-iter win — **but only if per-iter cost is
include-resolution-bound rather than parse-bound.** If mwcc's parse of the expanded text
dominates, flattening helps little and the real win is a **warm/forked mwcc process** or
a PCH-equivalent.

**Therefore the implementation plan must begin with a spike**, before building
`FlattenedLocalBackend` for real:
1. Measure iter/sec for three variants on a representative function: **plain** per-iter
   compile (control), **flattened** TU, **warm-process** (mwcc kept resident / forked).
2. **Validation gate:** the flattened compile must produce a **byte-identical `.o`** to
   the plain compile for the same source — flattening may never change results.
3. Pick the backend implementation that the measurement justifies; record the numbers in
   the plan. Do not commit the flatten path on faith.

Remote fan-out (`PermuterJobProducer` launching jobs across coder1/2/3) is **not** gated on
this spike — distributing across ~48 threads instead of 16 is an independent,
high-confidence ~3× throughput win and can land first. (The flatten win and the fan-out win
are orthogonal: fan-out helps the harvest path, flatten helps both decomp-permuter's
internal compiles and our compile-by-us path.)

---

## 6. Sharpening 2 — "the abstraction holds" is a success criterion, not a hope

Spec 1 is **done** only when all of these hold:

1. **Both paths run end-to-end through the primitives:** (a) decomp-permuter runs as a
   `PermuterJobProducer` (`ArtifactProducer`) with no decomp-permuter internals patched,
   and (b) a `SeedListSource` → `CompileBackend` → `ScorePipeline` compile-by-us path runs
   — both converging into one `ScorePipeline.score_byte` + `SearchResult` + artifact
   contract, driven by the `Scheduler`.
2. **Measured throughput gain:** a permuter run fans across coder1/2/3 and shows a real
   iter/sec improvement over the current single-target baseline (number recorded; remote
   fan-out alone should show ≈3×). The flatten spike (§5) reports its own number; the
   flattened path is committed only if the number justifies it.
3. **A second `VariantSource` drops in with ZERO engine/Scheduler/Backend changes:** after
   `SeedListSource`, a second trivial `VariantSource` runs through the exact same pipeline.
   This is the litmus that the interfaces are A2-ready, not permuter-shaped. If wiring it
   touches the `Scheduler` or a `CompileBackend`, the boundary is wrong and must be fixed
   before Spec 1 closes. (Symmetric expectation for `ArtifactProducer`: a second producer
   kind would drop in without engine changes — not built in Spec 1, but the interface must
   not preclude it.)
4. **No artifact leaks, verification restores cleanly:** search scratch is content-addressed
   under one managed, `.gitignore`d root and never lands in the repo source tree; a
   `git status` after a run is clean; and the checkdiff verification staging (§3.1) restores
   the prior `build/` object even on interrupt (tested by killing mid-verify). (Directly
   addresses the prior `nonmatchings/` / `git add -A` papercuts *and* the staging conflict
   from review.)

---

## 7. Where it lives & how it ships

- Code under `tools/melee-agent/src/` alongside the existing `debug permute` / mwcc-debug
  machinery; it **reuses** the shipped pieces (mwcc scoring, remote-permuter job runner,
  candidate verification, wrapper/harvest integration) rather than replacing them. Honest
  accounting of "wrapper vs new work": `PermuterJobProducer` and `score_byte` are genuinely
  thin over existing machinery; `PlainLocalBackend` is thin; `FlattenedLocalBackend` is new
  (gated on §5); the `Scheduler`'s two-path coordination + lock/restore + dedup is new; and
  a **remote per-candidate compile worker is real new infra, deliberately deferred** out of
  Spec 1.
- Surfaced through the existing CLI (e.g. a `debug search run ...` entry that constructs
  a Scheduler + the default sources/backends/pipeline), so it's usable the moment L1+L2
  land.
- Each primitive is independently testable with a fake/in-memory implementation of the
  others (the reason for the Protocol boundaries).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Flatten gives no real speedup (parse-bound) | §5 spike + byte-identical gate before committing the path; remote fan-out wins independently |
| Re-inventing decomp-permuter's solid parts | `ArtifactProducer` harvests its existing job loop; we never reimplement its randomizer/scorer |
| "Thin wrapper" hides real integration work (P1) | §7 names what's thin (producer, byte score, plain-local) vs new (flatten backend, scheduler two-path + lock/restore); remote per-candidate compile worker deferred, not hand-waved |
| Interfaces leak permuter assumptions | §6.3 second-source litmus test is a hard gate; permuter isolated behind `ArtifactProducer`, not baked into `VariantSource`/`CompileBackend` |
| pcdump/directed scoring becomes the new bottleneck later | Two-tier seam designed now (`should_escalate` gate); tier-2 only on promising/tie/plateau/targeted candidates |
| Distributed runs corrupt/stall (seen before) | Scheduler owns failure accounting + dedup + per-job artifact roots; honor the don't-clobber rule (only stop jobs whose `local_perm_dir` is ours) |
| Artifact scratch swept into git | Content-addressed, `.gitignore`d managed root; §6.4 clean-`git status` gate |

---

## 9. Sequence within Spec 1

1. Define the artifact record (`CandidateArtifact`/`CompileSpec`/`Provenance`) + the **five
   Protocols** (`VariantSource`, `CompileBackend`, `ArtifactProducer`, `ScorePipeline`,
   `Scheduler`) + in-memory fakes (pure interfaces, no behavior).
2. `PermuterJobProducer` (fan permuter jobs across coder1/2/3) + `Scheduler`
   (dedup/budgets/accounting + lock/restore) + `ScorePipeline.score_byte`. **→ first
   practical win: faster, distributed existing permuter runs — no per-candidate remote
   compile required.**
3. Flatten spike (§5): measure plain vs flattened vs warm-process with the byte-identical
   gate; build `FlattenedLocalBackend` only if justified (else record why and keep
   `PlainLocalBackend`). **Only if the spike validates flattening**, also feed the flattened
   base to `PermuterJobProducer.start` to speed decomp-permuter's internal compiles. The
   guaranteed Spec 1 speed win remains remote fan-out (step 2), independent of the spike.
4. `SeedListSource` → `CompileBackend` compile-by-us path + the §6.3 litmus test
   (second-source drop-in) + the §6.4 clean-`git status` / restore-on-interrupt check;
   close Spec 1.

Later specs (not here): L3 orchestrator; a `PermuterMutationSource` and/or async remote
`CompileBackend` worker (put *our* variants on remote cores); directed structural
`VariantSource`s; tier-2 `should_escalate` + `score_directed` with per-decision objectives
(select-order, stack-layout).
