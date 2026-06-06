# Backward-inference diagnostic validation, 2026-05-27

## Goal

Validate open question #5 from
`docs/superpowers/specs/2026-05-27-mwcc-backward-inference-design.md`:
would backward inference add diagnostic value on stuck allocator functions
before we commit to a multi-week build?

This is an analytical experiment over existing campaign data. No permuter runs
or new campaigns were performed.

## Common derivation model

MWCC's class-0 allocator is deterministic:

1. Start with volatile GPRs available (`r3..r12`, excluding `r0`).
2. For each node in simplify/color order, remove already assigned physical
   registers held by its interferers.
3. If any volatile-pool register remains, choose the lowest-numbered one.
4. If none remains, dispense nonvolatiles in order `r31, r30, r29, r28, ...`;
   each dispensed nonvolatile is then added to the volatile pool for later
   reuse by non-interfering nodes.

A backward allocation constraint therefore has three layers:

- **Identity constraints:** the target virtuals must remain independent
  allocator nodes if the force proof names them individually.
- **Ordering constraints:** nodes must be processed early or late enough for
  the desired register to be chosen under the deterministic dispense rule.
- **Interference constraints:** lower-preference registers must be unavailable,
  and same-physical nodes must be mutually non-interfering or otherwise legally
  reuse a register already in the pool.

This model is systematic when starting from a force-proof mapping plus the
allocator algorithm. The harder question is whether it is systematic from
target asm alone; that remains only partially true, as noted below.

## gm_80173EEC

### Force proof

The screened force proof was:

```text
--force-phys '34:31,37:30,32:29,42:28,52:28,38:28'
```

The initial Layer A target encoded only the first three nodes as
`--want-first 34,37,32`. Later experiments rescored the pool against the full
six-element target `[34,37,32,42,52,38]` and added coalesce preservation for
all six force-phys nodes.

### Derived IR constraint set

Using the force proof and allocator algorithm, the target requires:

| ID | Constraint | Reason |
|---|---|---|
| G1 | `34`, `37`, `32`, `42`, `52`, and `38` must remain independent target identities, not coalesced into unrelated roots. | A force-phys mapping on a named `ig_idx` is meaningless if that node disappears into a different coalesce root before coloring. |
| G2 | `34`, `37`, and `32` must be the first three nonvolatile-dispensing nodes, in that order, or an equivalent ordering that still dispenses `r31`, `r30`, then `r29` to those identities. | `obtain_nonvolatile_register()` dispenses top-down: `r31`, `r30`, `r29`, `r28`. |
| G3 | Each of `34`, `37`, and `32` must have no usable volatile-pool register at its colorgraph turn. | Otherwise MWCC would choose the lowest available volatile register instead of dispensing a nonvolatile. |
| G4 | `42`, `52`, and `38` must all legally receive `r28`. At minimum, they must not interfere with the live range currently holding `r28`, and lower-preference alternatives must be unavailable when they are colored. | Same physical register reuse is legal only when the allocator's interference checks leave that register available. |
| G5 | `42`, `52`, and `38` must not be coalesced into caller-save root `3` or any other root with the wrong physical assignment. | Coalescing into `3` removes the target identities and forces `r3`, not `r28`. |
| G6 | The interference/coalesce/spill shape must stay close enough to the force-proof graph that the above decisions remain meaningful. | The prefix alone is not sufficient; a candidate can hit `[34,37,32]` while changing the allocator graph that determines the trailing decisions. |

The important distinction: `G2` is not literally "these are the first three
entries in the raw simplify graph." It is the stronger allocator-state
constraint "these are the first three identities to force nonvolatile
dispenses." The existing prefix scorer approximated that with a filtered
simplify prefix because that was the available target syntax.

### Explains known forward failures

The derived constraints explain the two observed gm failure modes.

Prefix-hitting candidates violated identity/coalesce constraints:

| Candidate | Observed behavior | Violated constraint |
|---|---|---|
| `output-139-1` | Prefix `[34,37,32]` hit; `42` absent and coalesced as `42 -> 3 [r3]`; `38` absent and coalesced as `38 -> 3 [r3]`; `52` remained independent at iter 43 and got `r28`. | `G1`, `G5`, and therefore the full `G4` r28-sharing target. |
| `output-135-1` | Saved by stale remote scorer with score `135`; local Phase 2 scorer rejected it because target ig_idx `[38,42]` coalesced as aliases into another root. | `G1` and `G5`. |

Coalesce-preserving candidates preserved identity but failed ordering /
interference constraints:

| Evidence | Interpretation |
|---|---|
| Existing 500-candidate pool: 322 / 500 preserved all six target identities, but none reached 99.5% or 100%. | Coalesce independence is necessary but not sufficient; the target also needs ordering/interference constraints that the scorer did not fully encode. |
| Valid Phase 2 rerun: 273,283 iterations, 283 outputs, no prefix-3 candidates; top simplify candidates stayed at prefix 1/3 such as `34,91,90`; best real-tree match tied prior 99.33% ceiling. | Once `G1/G5` were enforced, the mutation pool could not also satisfy `G2/G3` within the run. |
| Full six-element rescore: no candidate reached prefix 4/6, 5/6, or 6/6; prefix-3 candidates scattered to `34,37,32,101,100,99` or similar. | The trailing r28-sharing constraints `G4/G5` were not correlated with the first-three prefix target. |

Backward inference therefore would have diagnosed gm more cleanly than the
initial forward campaign: the problem was not just "make `[34,37,32]` first";
the real target was a joint identity + nonvolatile-dispense + r28-reuse
constraint set.

### Rigor check

Verdict for gm: **partially systematic**.

Systematic pieces:

- Given the force-phys mapping, the nonvolatile dispense order mechanically
  implies constraints `G2/G3`.
- Same-physical assignments to `42`, `52`, and `38` mechanically imply
  noninterference/reuse constraints like `G4`.
- Candidate diagnostics mechanically identify coalesce violations like
  `42 -> 3` and `38 -> 3`.

Answer-dependent or not yet mechanized pieces:

- The force-proof already provides the `ig_idx -> desired phys` mapping. A
  true asm-alone backward inference tool still has to recover that mapping
  from target asm, live ranges, and the current pcdump's virtual identities.
- The exact simplification target `[34,37,32,42,52,38]` is stronger and more
  order-specific than the allocator proof strictly requires. A mechanized
  inverse should derive a partial order over nonvolatile-dispensing events and
  r28 reuse, not assume the human-written prefix is canonical.
- The statement "permuter's mutations cannot produce this" was learned from
  observed pools, not derived from the target constraints alone.

### No-candidate proof assessment

Backward inference can explain why the observed candidates failed. It cannot
prove no permuter mutation can satisfy the gm constraint set without an
additional model of the mutation library's reachable IR transformations.

The valid statement today is:

> In the observed pools, candidates either coalesced away target nodes to reach
> the prefix, or preserved all identities but failed to reach the required
> nonvolatile-dispense ordering and real-tree match.

That is a diagnosis, not a formal futility proof.

## lbDvd_80018A2C

### Force proof

The force proof was:

```text
--force-phys '44:10,46:12'
```

The first campaign encoded this as `--want-first 46,44`, which the later
polarity check correctly rejected as wrong for high volatile registers. Phase 3
re-ran with `--want-late 46,44`.

### Derived IR constraint set

Using the force proof and allocator algorithm, the target requires:

| ID | Constraint | Reason |
|---|---|---|
| L1 | `44` and `46` must remain independent class-0 allocator nodes. | The target physical assignments name two distinct `ig_idx` identities. |
| L2 | `44` must be colored when `r10` is the lowest available register in its working mask. | MWCC chooses the lowest available volatile register. To get `r10`, `r3..r9` must be unavailable and `r10` available. |
| L3 | `46` must be colored when `r12` is the lowest available register in its working mask. | To get `r12`, `r3..r11` must be unavailable and `r12` available. |
| L4 | The nodes must be late enough, or have enough already-colored lower-register interferers, for the high volatile choices to be reachable. | Processing them too early leaves low volatile registers available, producing `r4/r5`-style assignments. |
| L5 | The ordering between `46` and `44` must preserve the desired working-mask state: `46` ultimately needs `r12`, while `44` needs `r10`. | The baseline has the opposite physical assignment (`46 -> r10`, `44 -> r12`), so a simple presence or prefix target is insufficient. |
| L6 | The interference graph must be preserved enough that the lower-register exclusion set is the one implied by the force proof. | Prefix/suffix position alone does not guarantee the required working masks. |

This is exactly the kind of polarity fact the allocator algorithm can derive:
high volatile targets are late/exclusion targets, not front-prefix targets.

### Explains known forward failures

The derived constraints explain both lbDvd campaign failures.

Wrong-polarity prefix campaign:

| Evidence | Violated constraint |
|---|---|
| Best prefix candidate `output-251-1` moved `46` and `44` to simplify positions 0 and 1, but assigned `46 -> r4` and `44 -> r5`, and was rejected because the interference graph differed. | `L2`, `L3`, `L4`, and `L6`. Moving high-volatile targets to the front makes low volatile registers available, so the allocator picks `r4/r5`. |
| The later polarity checker reported `WRONG POLARITY` for the front target. | Confirms that the allocator-derived target should be late/exclusion-shaped. |

Correct-polarity late campaign:

| Evidence | Interpretation |
|---|---|
| Step 0 with `--want-late 46,44` reported target suffix `[46,44]`, observed suffix `[37,32]`, coalesce preservation all independent, polarity safe. | `L1` and target polarity were expressible. |
| 275,101 remote iterations produced 0 saved outputs and no candidate below the late-mode baseline score. | The observed mutation pool failed before real-tree triage: it could not make suffix progress toward `L4/L5`. |
| Built-in variants compiled locally, but best suffix match remained 0/2. | The failure is visible as "cannot move the nodes late enough," not merely "candidate ranked poorly." |

Backward inference would have prevented the first campaign and diagnosed the
second as a reachability problem for late high-volatile working-mask state.

### Rigor check

Verdict for lbDvd: **more systematic than gm, but still partial**.

Systematic pieces:

- Given `44 -> r10` and `46 -> r12`, the lowest-available-register rule
  mechanically implies lower-register exclusion constraints `L2/L3`.
- The high volatile targets mechanically imply late/exclusion polarity. This
  is why the later strict-polarity check could reject `--want-first`.
- The observed prefix candidate's `r4/r5` assignment is a direct predicted
  consequence of violating polarity.

Answer-dependent or not yet mechanized pieces:

- As with gm, the force proof supplies `ig_idx` identities. An asm-alone tool
  still needs a robust mapping from final instructions and live ranges back to
  `44` and `46`.
- `--want-late 46,44` is a useful encoding, but it is still an approximation
  of the actual constraint "make `r10`/`r12` the lowest available choices."
  A mechanized inverse should derive working-mask constraints directly, not
  just suffix position.
- The 0-output run proves no observed mutation satisfied the scorer, not that
  no possible permuter mutation could satisfy the constraints.

### No-candidate proof assessment

Backward inference could have proven the front-target search was wrong-polarity
without running it. It could not have proven the late-target search futile.

The valid statement today is:

> In the observed 275K-iteration run, no candidate moved `46,44` into the late
> suffix form needed to make `r10/r12` reachable. This diagnoses a reachability
> failure of current mutations, but not a formal impossibility.

## Cross-case findings

| Question | gm | lbDvd |
|---|---|---|
| Does a derived constraint set explain observed failure? | Yes. Prefix hits coalesced away required nodes or failed full ordering. | Yes. Front target had wrong polarity; late target had no suffix-progress candidates. |
| Is the derivation systematic from force proof + allocator algorithm? | Mostly. Nonvolatile dispense and coalesce constraints follow mechanically. | Mostly. High-volatile lower-register exclusion follows mechanically. |
| Is the derivation systematic from asm alone today? | No. Needs `ig_idx` identity mapping and partial-order derivation. | No. Needs `ig_idx` identity mapping and working-mask reconstruction. |
| Can it prove no candidate exists? | No. It diagnoses observed pools only. | No, except it can prove the wrong-polarity front target is invalid. |
| Does it add diagnostic value beyond forward search? | Yes, but as an explainer/target refiner, not a guarantee engine yet. | Yes, especially for polarity and high-volatile target shape. |

## Decisive recommendation

Verdict: **PARTIAL**.

Backward inference does add diagnostic value. It would have made the gm target
more explicit as a joint identity + nonvolatile-dispense + r28-reuse problem,
and it would have rejected lbDvd's wrong front target before the first remote
campaign. It also cleanly explains why the observed candidates failed.

However, the current derivations are not yet true asm-alone backward inference.
They rely on force-proof `ig_idx` mappings and campaign pcdumps. The
no-candidate guarantee also does not exist without a model of decomp-permuter's
mutation reachability.

Recommended Phase A scope:

1. Build a **constraint explainer** first, not a full reverse compiler.
2. Inputs: target force-proof or target pcdump, baseline/candidate pcdumps, and
   allocator algorithm.
3. Output: identity, coalesce, ordering, polarity, and working-mask constraints;
   candidate-specific violation reports.
4. Acceptance: reproduce the gm and lbDvd explanations above mechanically.

Do not claim Phase A will prove search futility or derive complete IR from raw
asm yet. The next missing pieces are:

- `asm/live-range -> ig_idx` identity mapping;
- partial-order target representation instead of prefix/suffix-only targets;
- working-mask constraint output (`r3..r9 unavailable, r10 available`);
- an explicit mutation-reachability model if we want no-candidate proofs.

That smaller Phase A is still worth building because it turns failed campaigns
from "no progress" into concrete violated constraints. The multi-week
asm-alone/guarantee version should wait until the identity-mapping and
reachability gaps are validated.
