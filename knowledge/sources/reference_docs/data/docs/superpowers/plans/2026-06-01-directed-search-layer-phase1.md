# Directed Search Layer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the validated directed-search *mechanism* (Phase 1 of the directed-layer spec) — a pcdump-guided tier-2 scorer + 9ACC select-order typed-mutator source + scheduler directed-mode + a trustworthy validity harness — and run the machine-checked Phase-1 gate on `grIceMt_801F9ACC`.

**Architecture:** New package `tools/melee-agent/src/search/directed/` reuses the `mwcc_debug` convergence analysis as a library (never `run_convergence_loop`) and plugs into the substrate (`tools/melee-agent/src/search/`). Phase 2 (LLM Editor) excluded.

**Tech Stack:** Python 3, pytest, `mwcc_debug` analysis modules, the substrate seams, `mwcc` via `debug dump local`.

**Spec:** `docs/superpowers/specs/2026-06-01-directed-search-layer-design.md` (frozen, 3 Codex rounds). Work on `master` in `/Users/mike/code/melee`. NEVER `git add -A` (permuter scratch under `nonmatchings/`); stage explicit paths. Commits auto-push. Run tests: `cd /Users/mike/code/melee/tools/melee-agent && python -m pytest tests/search/ -q`.

**CRITICAL CONTEXT (Codex plan-review P0-8):** the current committed `grIceMt_801F9ACC` is at **98.84%** and ALREADY contains the 96.3→98.8 levers (int-return, `grIceMt_GetUserData`, `new_var=&gp->gv.icemt2.xC8`). The remaining residual is the **ev/did select-order coloring swap**. Phase-1 mutators therefore target SELECT-ORDER from the 98.84% base (decl-order, counter width, did-read placement) — NOT the already-applied levers. Per memory those manual levers do not move the coloring, so the Phase-1 gate's expected honest outcome is `no_smooth_gradient` (mechanism validated; wall confirmed to need the Phase-2 LLM). Phase 1's value is the *trustworthy validated mechanism + infrastructure* Phase 2 reuses.

---

## Ground-truth API reference (verified — use these EXACT shapes)

```python
# convergence.py:19 — analyze_iteration_full(target, new_compile, class_id=0) -> (IterationState, FirstDivergenceReport|None, ReanchorResult)
# progress_classifier.py — IterationState(fact: FactView, identity, role_order_rank, gone_roles); FactView(case: DivergenceCase ENUM, ig_idx)
#   classify_progress(prev, curr, *, edit_was_order_change: bool, history: list, checkdiff_clean: bool) -> ProgressLabel(.value)
# first_divergence.py — DivergenceCase ENUM (.value: "none","abstained","A","B","B-inverse","C","C2","D","E","absent")
#   analyze_first_divergence(...).source is ALWAYS None; attach_source_ideas(fact: AllocatorFact, source_text, fn_name, pre_pass) -> SourceIdea
#   SourceIdea(ig_idx, var_name, confidence, alternates, ideas, rejected, first_def, blocker_*...)
# role_reanchor.py — ReanchorResult(class_id, force_phys, diagnostics, matched={new_ig:original_ig}); reanchor(target, new_compile, class_id=0)
# role_descriptor.py — Compile.from_text(pcdump_text, function, source) -> Compile(name, fev, fn, source, ir_facts)
#   TargetSpec(function, target_kind, target_coverage, causal_closure, provenance, roles)  # MWCC_DEBUG one (≠ search.TargetSpec)
#   build_target_spec(c: Compile, force_phys: dict, class_id, target_kind, provenance, causal_closure=False) -> TargetSpec
# colorgraph_parser.py — parse_hook_events(text)->list[FunctionEvents]; find_function(events,name); FunctionEvents.colorgraph_sections[].decisions:list[ColorgraphDecision]
#   ColorgraphDecision(iter_idx, ig_idx, assigned_reg, degree, n_interferers, flags, interferers)
# suggest_coalesce.py:70 — run(function,*,pair=None,discover=False,top=3,include_low_confidence=False,pcdump_text,source_text="") -> Report(pairs:[PairReport(from_virt,to_virt,suggestions:[Suggestion(pattern_name,source_hint,...)])])
# search/artifact.py — CandidateArtifact(candidate_id,source_hash,source_blob,compile_spec,object_path,producer_score,byte_score,directed_score,pcdump_path,compiler_stderr,provenance,status); compute_candidate_id(spec,source_hash)
# search/protocols.py — CompileBackend.compile(variant,*,want_pcdump=False)->CandidateArtifact; ScorePipeline.score_byte(art,target)/.should_escalate(art,ctx)/.score_directed(art,objective); VariantSource.name()/.seed(base)/.next_batch(n)/.observe(scored)
# search/backends.py — PlainLocalBackend(compiler, store, compile_spec_factory, target); .compile delegates to LocalCompiler.compile(source_text,target)->(Path|None,str)
# search/scheduler.py — DefaultScheduler(*, store, verifier); .run(*, sources,backends,producers,pipeline,target,budget,policy,progress); backend=backends[0]; ingest dedups on candidate_id, score_byte, win-check; observe per source batch
# search/scoring.py — ByteScorePipeline(scorer); DefaultSchedulePolicy() is a FACTORY fn -> SchedulePolicy(batch_size=16,...)
# search/store.py — ArtifactStore.put_source(text)->Path, put_manifest(m)->Path  (NO put_object/put_pcdump — backend owns obj/pcdump temp files via mkstemp)
# pcdump compile: shell `python -m src.cli debug dump local <c_file> --function <fn> --output <pcdump> --keep-obj <obj> --no-cache-sync` with cwd=melee_root/"tools"/"melee-agent"
# class_id=0 (GPR) ONLY. 9ACC ev/did are GPRs -> class_id=0.
HELPER (use everywhere a case is compared): _case_str(c) = c.value if hasattr(c, "value") else str(c)
```

## File structure
`src/search/directed/{__init__,contracts,pcdump_backend,objective,metric,scorer,diagnosis,anchors,mutators,source,gate,run,config}.py`; modify `src/search/{artifact,types,scheduler}.py` and `src/search/cli.py` (register `directed`); tests under `tests/search/directed/`; 9ACC fixture pcdumps under `tests/search/directed/fixtures/`.

---

## STAGE P1.A — Contracts + compile/objective infra

### Task 1: Contracts + artifact/types additions (must land first)
**Files:** Create `src/search/directed/__init__.py`, `contracts.py`; modify `src/search/artifact.py`, `src/search/types.py`; Test `tests/search/directed/__init__.py`, `tests/search/directed/test_contracts.py`

- [ ] **Step 1: Failing test**
```python
# tests/search/directed/test_contracts.py
from dataclasses import replace
from src.search.directed.contracts import DirectedObjective, DirectedSearchState, DirectedDiagnosis, DirectedMeta, DirectedScoringCall, DirectedSchedulerConfig
from src.search.artifact import CandidateArtifact
from src.search.types import SearchContext, SearchResult

def test_meta_linkage_and_artifact_invalid(_bare_artifact):
    m = DirectedMeta(candidate_id="c1", source_hash="s", iteration=2, parent_id="p", parent_state_id="ps",
        valid=True, invalid_reason=None, case="B", label="SAME", order_distance=1, displacement=0.5,
        displacement_delta=0.1, reanchor_matched=2, reanchor_total=2, diagnosis_chars=9,
        applied_mutator="reorder_local_decls", directed_scalar=0.5)
    a = replace(_bare_artifact, status="invalid", directed_meta=m)
    assert a.status == "invalid" and a.directed_meta.parent_state_id == "ps"

def test_ctx_byte_history_and_result_telemetry():
    assert SearchContext().byte_history == [] and SearchResult().directed_telemetry == []

def test_scheduler_config_fields():
    cfg = DirectedSchedulerConfig(objective=None, score_pipeline=None, backend=None, plateau_n=3)
    assert cfg.plateau_n == 3
```
(`_bare_artifact` fixture builds a minimal `CandidateArtifact` with all current fields + `directed_meta=None`.)

- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `contracts.py` defines `DirectedObjective(search_target, role_target, baseline_compile, baseline_pcdump_path, baseline_source_hash, class_id, objective_iter_by_original_ig: dict, proof_force_phys: dict)`, `DirectedSearchState(prev_state, history: tuple, last_lever, current_best, state_id)`, `DirectedDiagnosis(case, target_igs, source_idea, coalesce_pair, mutator_key, resolved_anchor, analysis_valid, actionable, invalid_reason)`, `DirectedMeta(...all fields above...)`, `DirectedScoringCall(objective, parent_state)`, `DirectedSchedulerConfig(objective, score_pipeline, backend, plateau_n)`. In `artifact.py`: add `directed_meta: Any = None` (last field, default) and extend `status` Literal with `"invalid"`. In `types.py`: add `byte_history: list = field(default_factory=list)` to `SearchContext` and `directed_telemetry: list = field(default_factory=list)` to `SearchResult`.
- [ ] **Step 4: Run → PASS** + `python -m pytest tests/search/ -q` (existing 29 green)
- [ ] **Step 5: Commit** `feat(directed): contracts + artifact directed_meta/"invalid" + ctx byte_history + result telemetry`

### Task 2: `PcdumpLocalBackend`
**Files:** Create `src/search/directed/pcdump_backend.py`; Test `tests/search/directed/test_pcdump_backend.py`

- [ ] **Step 1: Failing test** (fake runner; no mwcc)
```python
def test_compile_binds_obj_and_pcdump_and_restores(tmp_path):
    (tmp_path/"src/melee/gr").mkdir(parents=True); (tmp_path/"src/melee/gr/gricemt.c").write_text("orig")
    def runner(argv, **k):
        Path(argv[argv.index("--keep-obj")+1]).write_bytes(b"\x00"*4)
        Path(argv[argv.index("--output")+1]).write_text("PCDUMP")
        class R: returncode=0; stdout=""; stderr=""
        return R()
    be = PcdumpLocalBackend(melee_root=tmp_path, unit="melee/gr/gricemt",
        target=TargetSpec("grIceMt_801F9ACC","melee/gr/gricemt",tmp_path/"e.o"),
        store=_FakeStore(tmp_path), compile_spec_factory=lambda v: _spec(), runner=runner)
    assert be.capabilities() == BackendCaps("local", 1, True)
    art = be.compile(SourceVariant("CAND", None), want_pcdump=True)
    assert art.object_path.exists() and art.pcdump_path.read_text()=="PCDUMP" and art.status=="ok"
    assert (tmp_path/"src/melee/gr/gricemt.c").read_text()=="orig"
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — constructor `(melee_root, unit, target, store, compile_spec_factory, runner=subprocess.run)`. `compile(variant, *, want_pcdump=False)`: under `_acquire_repo_build_lock(melee_root)` (import from `src.search.adapters`), save TU `.c` (+ pre-existing `.o`), write `variant.source_text` to `src/<unit>.c`, build argv `[sys.executable,"-m","src.cli","debug","dump","local",str(tu_c),"--function",target.function,"--output",pcdump_tmp,"--keep-obj",obj_tmp,"--no-cache-sync"]`, run via `runner(argv, cwd=melee_root/"tools"/"melee-agent", capture_output=True, text=True)`, restore in `finally`. Own obj/pcdump as `mkstemp` temp files (the backend, not the store, owns them — store has no put_object). Build `CandidateArtifact` via `compile_spec_factory(variant)` + `compute_candidate_id`; `status="ok"` iff both files exist+nonempty else `"compile_failed"`. `capabilities()->BackendCaps("local",1,True)`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): PcdumpLocalBackend (one-invocation .o+pcdump, lock+restore)`

### Task 3: `DirectedObjective` builder + pre-flight
**Files:** Create `src/search/directed/objective.py`; Test `tests/search/directed/test_objective.py`

- [ ] **Step 1: Failing test**
```python
def test_preflight_aborts_on_empty_roles():
    with pytest.raises(PreflightError):
        preflight_objective(_objective(roles=[], analyze=lambda *a, **k:(_state("none"),None,_re({}))))
def test_preflight_aborts_on_enum_case_none():
    obj = _objective(roles=[_role(37)], analyze=lambda *a, **k:(_state_enum(DivergenceCase.NONE),_rep(),_re({1:37})))
    with pytest.raises(PreflightError):
        preflight_objective(obj)            # enum, not string — must still abort
def test_preflight_passes_on_valid():
    obj = _objective(roles=[_role(37),_role(34)], analyze=lambda *a, **k:(_state_enum(DivergenceCase.B_TARGET_HIGHER),_rep(),_re({1:37,2:34})))
    preflight_objective(obj)
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `build_directed_objective(melee_root, search_target, function, unit, proof_force_phys: dict, class_id=0, backend=None)`: compile the current TU baseline via `backend` (PcdumpLocalBackend) to get `baseline_pcdump_path`; `c = Compile.from_text(pcdump_text, function, source)`; `role_target = build_target_spec(c, proof_force_phys, class_id, "force_proof_proxy", provenance={"src":"directed"})`; `objective_iter_by_original_ig = {role.original_ig: _decisions_by_ig(c, class_id)[role.original_ig].iter_idx for role in role_target.roles if role.original_ig in _decisions_by_ig(c, class_id)}` (the objective order is read from the baseline/proof compile's decisions); return `DirectedObjective(...)`. `_decisions_by_ig(compile, class_id)` = `{d.ig_idx: d for d in find_function(compile.fev... ).colorgraph_sections[last for class_id].decisions}`. **`proof_force_phys` for 9ACC is supplied explicitly** (the desired ev/did regs — from the target coloring; capture it as a constant `GRICEMT_9ACC_FORCE_PHYS` with a comment, derived via `debug` analysis). `preflight_objective(obj)`: `state, report, reanchor = obj.analyze(obj.role_target, obj.baseline_compile, obj.class_id)`; raise `PreflightError` unless `obj.role_target.roles` AND `_case_str(state.fact.case) not in {"none","abstained"}` AND `report is not None`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): DirectedObjective builder (explicit proof force_phys) + enum-safe pre-flight`

---

## STAGE P1.B — Fixtures, metric, scorer

### Task 4: 9ACC fixture pcdumps + ordering metric
**Files:** Create `tests/search/directed/fixtures/` (captured pcdumps), `src/search/directed/metric.py`; Test `tests/search/directed/test_metric.py`

- [ ] **Step 1: Capture fixtures** — `melee-agent debug dump local src/melee/gr/gricemt.c --function grIceMt_801F9ACC --output tests/search/directed/fixtures/9acc_base.pcdump.txt --no-cache-sync` (the 98.84% base). Record the ev/did ig + iter positions in a `fixtures/README.md` (e.g. `ev→ig34@iter3 r28`, `did→ig37@iter103 r4`).
- [ ] **Step 2: Failing test**
```python
def test_reanchor_mapping():
    assert candidate_iter_by_original_ig({1:37,2:34}, {1:_dec(103),2:_dec(3)}) == {37:103,34:3}
def test_order_distance_binary():
    obj={37:3,34:103}
    assert order_distance({37:103,34:3},obj)==1 and order_distance({37:3,34:103},obj)==0
def test_displacement_measures_pre_flip_movement():
    obj={37:3,34:103}                                  # objective: 37 earlier (gap -100)
    far  = displacement({37:103,34:3},  obj)           # fully inverted (gap +100)
    near = displacement({37:60, 34:50}, obj)           # STILL wrong order (gap +10) but closer
    assert near > far                                  # raw-position metric moves before the flip
```
- [ ] **Step 3: Implement `metric.py`**
```python
from itertools import combinations
def candidate_iter_by_original_ig(matched, decisions_by_new_ig):
    return {orig: decisions_by_new_ig[new].iter_idx for new, orig in matched.items() if new in decisions_by_new_ig}
def order_distance(cand, objective):
    igs=[i for i in objective if i in cand]; inv=0
    for a,b in combinations(igs,2):
        if (objective[a]<objective[b]) != (cand[a]<cand[b]): inv+=1
    return inv
def displacement(cand, objective):
    """Smooth pre-flip signal: closeness of each pair's SIGNED iter-gap to the objective's,
    normalized by the maximum gap magnitude so partial movement registers even without a flip."""
    igs=[i for i in objective if i in cand]
    if len(igs)<2: return 0.0
    tot=0.0; n=0
    for a,b in combinations(igs,2):
        og=objective[a]-objective[b]; cg=cand[a]-cand[b]
        scale=max(abs(og),abs(cg),1)
        tot += 1.0 - abs(og-cg)/(2*scale)   # 1.0 when gaps equal; decreasing with distance; never identically 0 for partial moves
        n+=1
    return tot/n
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): 9ACC fixtures + ordering metric (binary order_distance, pre-flip displacement)`

### Task 5: `DirectedScorePipeline`
**Files:** Create `src/search/directed/scorer.py`; Test `tests/search/directed/test_scorer.py`

- [ ] **Step 1: Failing test** (inject fakes)
```python
def test_invalid_on_enum_abstained(make_art, make_call):
    pipe = DirectedScorePipeline(analyze=lambda t,c,class_id=0:(_state_enum(DivergenceCase.ABSTAINED),_rep(),_re({1:37})),
        compile_from_text=lambda art:_compile(), decisions_of=lambda c:{1:_dec(3)}, coverage_floor=0.5)
    out = pipe.score_directed(make_art(pcdump="X"), make_call())
    assert out.status=="invalid" and out.directed_meta.invalid_reason=="case_abstained"
def test_pure_same_parent_same_score(make_art, make_call):
    pipe = _valid_pipe()
    a=pipe.score_directed(make_art(pcdump="X"),make_call()); b=pipe.score_directed(make_art(pcdump="X"),make_call())
    assert a.directed_meta.order_distance==b.directed_meta.order_distance and a.directed_meta.valid
def test_displacement_delta_vs_parent(make_art):
    parent = _state_with_displacement(0.3)
    out = _valid_pipe().score_directed(make_art(pcdump="X"), _call(parent=parent))
    assert out.directed_meta.displacement_delta == pytest.approx(out.directed_meta.displacement - 0.3)
def test_should_escalate_best_so_far_plateau():
    p=DirectedScorePipeline(analyze=None,compile_from_text=None,decisions_of=None,plateau_n=3)
    ctx=SearchContext(); ctx.byte_history=[5,5,5]; assert p.should_escalate(None,ctx) is True
    ctx.byte_history=[7,6,5]; assert p.should_escalate(None,ctx) is False
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `DirectedScorePipeline(analyze, compile_from_text, decisions_of, coverage_floor=0.5, plateau_n=3, parent_displacement_of=lambda ps: getattr(ps,'displacement',0.0))`. Real adapters: `analyze=analyze_iteration_full`; `compile_from_text=lambda art: Compile.from_text(art.pcdump_path.read_text(), objective.role_target.function, art.source_blob.read_text())`; `decisions_of=lambda c: {d.ig_idx: d for d in find_function(c.fev_or_events, name).colorgraph_sections[-1-for-class].decisions}` — **"last colorgraph section for class_id, keyed by `decision.ig_idx`"**. `score_directed(art, call)`: `compile=compile_from_text(art)`; `state,report,reanchor=analyze(call.objective.role_target,compile,call.objective.class_id)`; validity → `"invalid"` with `invalid_reason` in {`no_roles`,`case_none`,`case_abstained`,`no_report`,`low_coverage`} using `_case_str(state.fact.case)` and coverage `len(reanchor.matched)/max(len(roles),1) < coverage_floor`; metric via `candidate_iter_by_original_ig` + `order_distance` + `displacement`; `label=classify_progress(call.parent_state.prev_state, state, edit_was_order_change=(call.parent_state.last_lever in ORDER_CHANGE_MUTATORS), history=list(call.parent_state.history), checkdiff_clean=False).value`; `displacement_delta = disp - parent_displacement_of(call.parent_state)`; build `DirectedMeta` (`directed_scalar=disp`); `return replace(art, directed_score=disp, directed_meta=meta, status="ok")`. No global mutation. `should_escalate(art,ctx)`: best-so-far plateau — `len(ctx.byte_history)>=plateau_n and min(ctx.byte_history[-plateau_n:])==min(ctx.byte_history)` (no NEW best in the last N). `ORDER_CHANGE_MUTATORS = {"reorder_local_decls"}`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): DirectedScorePipeline (pure, enum-safe validity, displacement_delta, best-so-far escalate)`

---

## STAGE P1.C — Scheduler directed-mode

### Task 6: Scheduler directed-mode (real refactor)
**Files:** Modify `src/search/scheduler.py`, `src/search/protocols.py` (add `directed` to `Scheduler.run`), `src/search/cli.py` (the one `DefaultScheduler(...)` call passes `directed=None`); Test `tests/search/directed/test_scheduler_directed.py`

- [ ] **Step 1: Failing test** (all fakes)
```python
def test_directed_escalates_routes_pcdump_scores_per_parent_selects_one(fakes):
    res = run_directed(fakes)   # byte plateaus -> escalate
    assert fakes.pcdump_backend.compiled_with_pcdump
    assert all(m.parent_state_id == fakes.root_state_id for m in res.directed_telemetry)
    assert fakes.observed_count == 1                      # exactly one best observed
def test_invalid_surfaced_not_progress(fakes_invalid):
    res = run_directed(fakes_invalid)
    assert any(m.valid is False for m in res.directed_telemetry) and res.accounting["directed_invalid"]>=1
def test_tier1_unchanged_when_directed_absent():
    # directed=None -> identical to existing behavior (existing substrate tests still green)
    ...
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — add keyword `directed: DirectedSchedulerConfig | None = None` to `DefaultScheduler.run` (and the `Scheduler` protocol). When `directed is None`, the loop is byte-identical to today (guards keep the 29 tests green). When set: maintain `ctx.byte_history` (append each accepted byte_score); **before each batch** compute `escalate = directed.score_pipeline.should_escalate(None, ctx)`; pick `backend = directed.backend if escalate else backends[0]`; compile `backend.compile(variant, want_pcdump=escalate)`; after `score_byte`, if `escalate`: `scored = directed.score_pipeline.score_directed(art, DirectedScoringCall(directed.objective, parent_state))`, append `scored.directed_meta` to `directed_telemetry`, and if `not scored.directed_meta.valid` → `acct["directed_invalid"]+=1` (skip as progress) else keep; **directed dedup key = `(candidate_id, parent_state_id)`**; after the batch **select ONE best** by `key=lambda a:(a.byte_score if a.byte_score is not None else 1<<30, -(a.directed_meta.displacement if a.directed_meta else 0.0))` and call `src.observe([best])`. Return `SearchResult(best=..., matched=..., accounting=acct, directed_telemetry=directed_telemetry)`.
- [ ] **Step 4: Run → PASS** + full substrate suite green.
- [ ] **Step 5: Commit** `feat(directed): scheduler directed-mode (pre-batch escalate, pcdump route, per-parent score, select-one-best)`

---

## STAGE P1.D — Diagnosis + select-order resolver + mutators

### Task 7: `build_diagnosis` (with suggest_coalesce + pre_pass)
**Files:** Create `src/search/directed/diagnosis.py`; Test `tests/search/directed/test_diagnosis.py`

- [ ] **Step 1: Failing test**
```python
def test_analysis_valid_vs_actionable_split():
    d = build_diagnosis(state=_state_enum(DivergenceCase.B_TARGET_HIGHER), report=_rep(), reanchor=_re({1:37}),
        compile=_compile_with_fn(), function="grIceMt_801F9ACC", source_text=SRC,
        suggest=lambda **k:_report_no_pairs(), attach=lambda fact,src,fn,pre_pass:_idea("did"),
        resolve=lambda idea,src: None)
    assert d.analysis_valid is True and d.actionable is False and d.mutator_key is None
def test_actionable_with_anchor_and_pair():
    d = build_diagnosis(state=_state_enum(DivergenceCase.B_TARGET_HIGHER), report=_rep(), reanchor=_re({1:37}),
        compile=_compile_with_fn(), function="grIceMt_801F9ACC", source_text=SRC,
        suggest=lambda **k:_report_with_pair(34,37), attach=lambda *a,**k:_idea("did"),
        resolve=lambda idea,src:_anchor("reorder_local_decls"))
    assert d.actionable and d.mutator_key=="reorder_local_decls" and d.coalesce_pair==(34,37)
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `build_diagnosis(state, report, reanchor, compile, function, source_text, suggest=suggest_coalesce.run, attach=attach_source_ideas, resolve=anchors.resolve_anchor)`: `case=_case_str(state.fact.case)`; `analysis_valid = bool(reanchor.matched) and case not in {"none","abstained"} and report is not None`; `pre_pass = compile.fn` (the pre-pass binding source — **pass it, not None**); `idea = report.source or (attach(report.fact, source_text, function, pre_pass) if report else None)`; `coalesce_pair` = first pair from `suggest(function, discover=True, pcdump_text=compile_pcdump_text, source_text=source_text).pairs` (or None); `anchor = resolve(idea, source_text)`; `actionable = anchor is not None`; `mutator_key = anchor.mutator_key if anchor else None`; return `DirectedDiagnosis(case, target_igs=(state.fact.ig_idx,), source_idea=idea, coalesce_pair=coalesce_pair, mutator_key=mutator_key, resolved_anchor=anchor, analysis_valid=analysis_valid, actionable=actionable, invalid_reason=None if analysis_valid else case)`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): build_diagnosis (suggest_coalesce pair + pre_pass source ideas + valid/actionable split)`

### Task 8: Select-order source-anchor resolver
**Files:** Create `src/search/directed/anchors.py`; Test `tests/search/directed/test_anchors.py`

Resolves anchors for the SELECT-ORDER levers on the current 98.84% 9ACC body (NOT the already-applied 96.3→98.8 levers). `Anchor(mutator_key, span: tuple[int,int], payload: dict)`.

- [ ] **Step 1: Failing test** (real 98.84%-shaped source)
```python
SRC = ("int grIceMt_801F9ACC(Ground_GObj* gobj, float y, GrIceMtSegmentLookup ev,\n"
       "                     Ground_GObj* arg3)\n{\n    s16* seg = (s16*) gobj;\n    s32 did = 0;\n"
       "    HSD_GObj* mgobj;\n    HSD_JObj* jobj;\n    HSD_JObj** new_var;\n    ...\n}\n")
def test_reorder_local_decls_anchor_exact():
    a = resolve_anchor(_idea(var_name="did", first_def="s32 did = 0;"), SRC)
    assert a is not None and a.mutator_key=="reorder_local_decls"
    assert SRC[a.span[0]:a.span[1]] == "s32 did = 0;" and a.payload["var"]=="did"
def test_unresolvable_returns_none():
    assert resolve_anchor(_idea(var_name="zzz", first_def="nope"), SRC) is None
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `resolve_anchor(source_idea, source_text) -> Anchor|None`: exact string/regex search keyed on `source_idea.first_def`/`var_name`. Three select-order levers: (a) a local declaration line (`s32 <v> = 0;` / `<T> <v>;`) whose span enables `reorder_local_decls` (payload `{"var":v, "decl_span":span}`); (b) the parameter list (`GrIceMtSegmentLookup ev` / a local of width `s16`/`s32`) for `change_counter_width` (payload `{"var":v}`); (c) the `did`/flag read site for `move_did_read` (payload `{"var":v, "read_span":span}`). Return the first lever whose span string-matches the source, else `None`. NEVER return a span that doesn't `source_text[start:end]`-match the cited text.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): select-order anchor resolver (decl-order/counter-width/did-read on the 98.84% body)`

### Task 9: Select-order typed mutators
**Files:** Create `src/search/directed/mutators.py`; Test `tests/search/directed/test_mutators.py`

- [ ] **Step 1: Failing test** (golden — exact patched source + exact Anchor)
```python
def test_reorder_local_decls_exact():
    src="{\n    s32 did = 0;\n    HSD_GObj* mgobj;\n}\n"
    a=Anchor("reorder_local_decls",(6,18),{"var":"did","other":"mgobj"})
    out=apply_mutator("reorder_local_decls", a, src)
    assert out=="{\n    HSD_GObj* mgobj;\n    s32 did = 0;\n}\n"   # the two decls swapped, exact
def test_mutator_returns_none_when_payload_absent():
    assert apply_mutator("reorder_local_decls", Anchor("reorder_local_decls",(0,1),{"var":"nope"}), "x")==None
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `apply_mutator(key, anchor, source_text) -> str|None`, dispatch over: `reorder_local_decls` (swap two adjacent local declaration lines named in the payload), `change_counter_width` (`s16`↔`s32` on the named local/counter), `move_did_read` (relocate the flag-read line to the alternate documented position). Each is an exact, anchor-bounded string transform; returns `None` if the payload's cited text isn't found (never emit broken source). `ORDER_CHANGE_MUTATORS = {"reorder_local_decls"}` (re-exported for the scorer).
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): select-order typed mutators (golden-tested, exact)`

### Task 10: `DirectedSource`
**Files:** Create `src/search/directed/source.py`; Test `tests/search/directed/test_source.py`

- [ ] **Step 1: Failing test**
```python
def test_next_batch_applies_untried_then_exhausts(fake_diag):
    s=DirectedSource(diagnose=lambda best:fake_diag(mutators=["reorder_local_decls"]),
        apply=lambda k,a,src:src+f"/*{k}*/")
    s.seed(_spec("BASE"))
    assert len(s.next_batch(8))==1 and s.next_batch(8)==[]
def test_observe_selects_best_and_counts_stalls():
    s=DirectedSource(diagnose=lambda best:_diag(["m1","m2"]), apply=lambda k,a,src:src)
    s.seed(_spec("BASE")); s.observe([_scored(byte=5,disp=0.4)]); s.observe([_scored(byte=5,disp=0.4)])
    assert s.stalls>=1
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `DirectedSource(diagnose, apply=apply_mutator)`: `seed(base)` sets `current_best=base.base_source`, `tried=set()`, `stalls=0`, `best_disp=None`. `next_batch(n)`: `d=diagnose(current_best)`; if not `d.actionable` → `[]`; for each untried mutator with a resolvable anchor (up to n) → `apply(key, d.resolved_anchor, current_best)` → `SourceVariant(text, Provenance(source_name="directed", parent_id=..., mutation=key, base_hash=..., producer_meta={}))`; mark tried; return list (or `[]` when exhausted). `observe(scored)`: pick best by `(byte_score, -displacement)`; if its displacement not greater than `best_disp` → `stalls+=1` else reset stalls + update `current_best`/`best_disp`. Expose `self.stalls`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): DirectedSource (select-order mutator vending + stall tracking)`

---

## STAGE P1.E — Gate + end-to-end

### Task 11: `evaluate_phase1_gate`
**Files:** Create `src/search/directed/gate.py`; Test `tests/search/directed/test_gate.py`

- [ ] **Step 1: Failing test**
```python
def test_pass_on_attributable_displacement():
    t=[_meta(valid=True,case="B",applied_mutator="reorder_local_decls",displacement=0.6,displacement_delta=0.2,byte_regressed=False,coverage_ok=True)]
    assert evaluate_phase1_gate(preflight_ok=True, telemetry=t, control_displacement=0.0).passed
def test_fail_void_and_unattributed():
    assert not evaluate_phase1_gate(True, [], 0.0).passed
    assert not evaluate_phase1_gate(True, [_meta(valid=True,case="B",applied_mutator=None,displacement_delta=0.2)], 0.0).passed
def test_no_gradient_is_distinct_reason():
    flat=[_meta(valid=True,case="B",applied_mutator="reorder_local_decls",displacement_delta=0.0,byte_regressed=False,coverage_ok=True)]
    v=evaluate_phase1_gate(True, flat, 0.0); assert not v.passed and v.reason=="no_smooth_gradient"
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `evaluate_phase1_gate(preflight_ok, telemetry, control_displacement) -> GateVerdict(passed, reason, evidence)`. Each meta carries per-candidate `byte_regressed`/`coverage_ok`. Fail `not_preflight` if not preflight_ok; treatment = `[m for m in telemetry if m.valid and _case_str(m.case) not in {"none","abstained"}]`; fail `void_no_treatment` if empty; PASS if any `m` in treatment has `m.applied_mutator and m.displacement_delta>0 and not m.byte_regressed and m.coverage_ok and m.displacement>control_displacement`; elif treatment is attributed but all `displacement_delta<=0` → `reason="no_smooth_gradient"` (the honest transposition outcome → routes to Phase 2); else `reason="unattributed_or_regressing"`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(directed): phase-1 gate (attributable displacement; honest no_smooth_gradient)`

### Task 12: End-to-end `run_directed` + CLI on `search_app`
**Files:** Create `src/search/directed/run.py`, `src/search/directed/config.py` (the `GRICEMT_9ACC_FORCE_PHYS` constant + 9ACC wiring); register `directed` on `search_app` in `src/search/cli.py`; Test `tests/search/directed/test_run_smoke.py`

- [ ] **Step 1: Failing test** (dry, faked)
```python
def test_run_directed_dry(tmp_path):
    res = run_directed(function="grIceMt_801F9ACC", unit="melee/gr/gricemt",
                       melee_root=tmp_path, store_dir=tmp_path/"store", dry=True)
    assert "gate" in res and "directed_telemetry" in res and "accounting" in res
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `run_directed(...)`: when `dry=True`, assemble with fake analyze/compile so no mwcc runs; else build the real `DirectedObjective` (using `config.GRICEMT_9ACC_FORCE_PHYS`), `preflight_objective`, real `PcdumpLocalBackend`/`DirectedScorePipeline`/`DirectedSource`, run `DefaultScheduler(store,verifier).run(..., directed=DirectedSchedulerConfig(objective, score_pipeline, pcdump_backend, plateau_n=3))`, then `evaluate_phase1_gate(preflight_ok=True, telemetry=result.directed_telemetry, control_displacement=...)`; return `{gate: {...}, directed_telemetry: [...], accounting: {...}}`. Register `@search_app.command("directed")` in `src/search/cli.py` (NOT ad hoc in debug.py — `debug search` already mounts `search_app`), with `--function --unit [--dry] [--store]`, printing JSON.
- [ ] **Step 4: Run → PASS** + full suite green.
- [ ] **Step 5: Commit** `feat(directed): debug search directed run + e2e assembly (registered on search_app)`
- [ ] **Step 6: LIVE 9ACC gate run (manual)** — `cd /Users/mike/code/melee && melee-agent debug search directed --function grIceMt_801F9ACC --unit melee/gr/gricemt`; record the gate verdict (`passed` / `no_smooth_gradient` + mechanism evidence) in the commit message. This IS the Phase-1 gate; its result decides Phase-2-plan vs reassess.

---

## Self-Review (run before handoff)

**Spec coverage:** §4 contracts/objective → Tasks 1,3; §5.3 pcdump backend → Task 2; §5.2 metric+scorer → Tasks 4,5; §6.1 scheduler refactor → Task 6; §5.1 diagnosis/resolver/mutators/source → Tasks 7–10; §6.2.3 gate → Task 11; §7/e2e → Task 12. ✓

**Codex plan-review incorporated (all P0+P1):** contracts/artifact additions land in Task 1 before any use (P0-3); `_case_str` enum normalization everywhere (P0-2); objective takes explicit `proof_force_phys` (P0-1); `edit_was_order_change` from `last_lever ∈ ORDER_CHANGE_MUTATORS` (P0-4); `DirectedSchedulerConfig` + `run(directed=)` single API + protocol update (P0-5,6); `attach_source_ideas` gets `pre_pass=compile.fn` (P0-7); **mutators retargeted to select-order from the 98.84% base, not the already-applied levers** (P0-8); backend `compile_spec_factory`+`cwd`+temp-file ownership (P1); displacement raw-position formula + pre-flip test (P1); `(byte_score,-displacement)` selection (P1); `suggest_coalesce.run` wired (P1); golden Anchor tests (P1); gate per-candidate byte/coverage+control (P1); CLI on `search_app` (P1); fixtures captured (P1); `coverage_floor` constant + best-so-far `should_escalate` + `decisions_of` spelled out (P2).

**Type consistency:** `DirectedObjective/SearchState/Diagnosis/Meta/ScoringCall/SchedulerConfig` (Task 1) used identically in 3,5,6,7,11,12; `Anchor(mutator_key,span,payload)` (Task 8) consumed by Task 9; `ORDER_CHANGE_MUTATORS` defined in Task 9, used in Task 5.

**Out of scope (spec §9):** no LLM producer / dynamic start-stop / generalized resolver — Phase 2.
