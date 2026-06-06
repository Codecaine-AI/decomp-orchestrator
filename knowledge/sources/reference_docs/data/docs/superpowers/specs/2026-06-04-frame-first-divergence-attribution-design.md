# Frame First-Divergence Attribution Design

## Goal

Implement issue #360 by making `debug inspect frame-reservations` emit a source-actionable first frame divergence: the diverging object, a source-object attribution when stack-home identity is available, a cause taxonomy, and a validated source-reachable or ceiling verdict when probe evidence is supplied.

## Context

The current frame reservation report already compares current and expected stack objects and emits `frame_first_divergence`. It also resolves symbolic stack homes when the pcdump contains names and the current/expected asm can map those names to concrete offsets. The missing piece is that `source_attribution` still describes symbolic homes as incomplete instead of surfacing them as the source object available today, and validated frame-transform evidence is attached as a generic verdict without folding the source-attribution state into the ceiling decision.

## Approaches Considered

1. Wait for #358 to expose complete ObjObject origin tags.
   This would be ideal, but it keeps #360 blocked even when current symbolic stack-home identity is enough for many real frame divergences.

2. Add a separate mwcc-inspect parser and try to join ObjObjects to stack homes now.
   This risks a broad, fragile feature with unclear reproducibility in the local tests.

3. Promote resolved symbolic stack homes into a first-class source object and add validated verdict semantics over existing probe evidence.
   This is the chosen approach. It completes the reusable #360 output for cases where the current tooling has identity and clearly marks unresolved cases as needing #358.

## Design

`frame_first_divergence.source_attribution` will become a structured object with:

- `status`: `source-object-attributed` or `unattributed`;
- `identity_kind`: `symbolic-stack-home` when symbolic homes provide the link;
- `confidence`: `high` when a symbol's current offset equals its expected offset, `medium` when a symbol is resolved on the current side with a known expected offset but is displaced, and `low` when no source object exists;
- `source_objects`: source object records with symbol, side, current offset, expected offset, size, kind, first access, opcodes, and access count;
- `primary_source_object`: the first object to inspect;
- `unresolved_dependency`: `mwcc-stack-home-origin-tags` when no source object can be named.

Cause taxonomy will be refined with source-object context:

- `lifetime-or-ordering-shift` for same-shape object offset changes with a source object;
- `type-size-or-alignment` for size changes;
- `extra-source-local-home` or `missing-source-local-home` for extra/missing attributed objects;
- `extra-frame-reservation-or-alignment` for frame-size-only gaps with no source object;
The `internal-layout-tiebreak` classification is not a pre-validation cause. It is only emitted as a validated verdict after bounded probe evidence leaves an unattributed divergence unchanged.

Validated verdicts will attach to `frame_first_divergence.validated_verdict`:

- `source-reachable-validated` for full frame-transform success;
- `partial-source-reachable-validated` for partial improvement;
- `internal-tiebreak-ceiling` when bounded frame-transform probes leave the divergence unchanged and no source object is attributed;
- `attributed-frame-unchanged` when bounded frame-size probes leave the frame unchanged but a source object is attributed. This remains source-actionable, but it does not claim the specific source object's stack slot stayed unmoved unless stack-home/localizer evidence also proves that.

## Output Contract

The report remains backward-compatible: existing `current`, `expected`, `cause_hypothesis`, `verdict`, and `frame_transform_probe_plan` keys stay present. New fields are additive except the attribution status text becomes more precise.

## Testing

Regression tests will cover:

- same-shape offset divergence with symbolic homes emits `source-object-attributed`, primary object metadata, and `lifetime-or-ordering-shift`;
- renamed causes preserve directed operator priorities;
- frame-size-only divergence remains `unattributed` and names the #358 dependency;
- text output names the primary source object when present;
- bounded unchanged frame-size probes plus attributed source object report `attributed-frame-unchanged`;
- bounded unchanged probes with no source object reports `internal-tiebreak-ceiling`;
- existing frame-transform source-reachable validation still reports `source-reachable-validated`.

## Scope Boundaries

This does not implement the full MWCC stack-frame allocation dump requested by #358. It uses symbolic stack homes and probe evidence available today, and it explicitly marks unresolved ObjObject origin cases as blocked on #358.
