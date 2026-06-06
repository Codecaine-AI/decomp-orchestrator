# Name-Magic Source Declarations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conservative `name-magic-source-declarations` harness that turns proven anonymous-vs-named data relocation evidence into whole-file source candidates, validates them with `checkdiff --no-name-magic`, and wires the harness into taxonomy harvest.

**Architecture:** Put evidence parsing and source probe generation in a focused module, expose it through `debug mutate name-magic-source-declarations`, then add harness-specific harvest selection, candidate gating, no-name-magic preflight, and whole-file apply. Keep the first pass source-safe: generate static-data promotion and unique simple float literal load variants; report stable blockers for ambiguous source sites, unsupported bias rewrites, and pool/order cases.

**Tech Stack:** Python 3.11, Typer CLI, existing `tools/checkdiff.py`, existing `src.mwcc_debug.o_rewriter` helpers, existing `src.mwcc_debug.source_patch` source-span parser, pytest.

---

## Current Worktree Constraint

`tools/melee-agent/src/mwcc_debug/pressure_explorer.py` and `tools/melee-agent/tests/test_pressure_explorer.py` may be dirty from unrelated indexed-struct work. Do not edit or stage those files for #375. Use explicit `git add` path lists for #375 commits.

## File Structure

- Create `tools/melee-agent/src/mwcc_debug/name_magic_source.py`: checkdiff diff parser, evidence dataclasses, source-safe probe generation, stable blocker helpers.
- Create `tools/melee-agent/tests/test_name_magic_source.py`: unit tests for evidence pairing, blockers, static-to-global generation, unique literal source generation, and combined probes.
- Modify `tools/melee-agent/src/cli/debug.py`: add `debug mutate name-magic-source-declarations`, whole-file source candidate scorer, no-name-magic checkdiff validation, JSON/text rendering.
- Modify `tools/melee-agent/tests/test_debug_cli_reorg.py`: command help and JSON/blocker CLI regressions.
- Modify `tools/melee-agent/src/harvest.py`: register/select the harness, build adapter command, enforce harness-specific validated candidate gate, use no-name-magic stale-row check, apply whole candidate source for this harness.
- Modify `tools/melee-agent/tests/test_harvest.py`: current queue selection, future normalized selection, command construction, gate rejection, no-name-magic preflight, whole-file apply, rollback.

---

### Task 1: Evidence Parser And Probe Generator

**Files:**
- Create: `tools/melee-agent/src/mwcc_debug/name_magic_source.py`
- Create: `tools/melee-agent/tests/test_name_magic_source.py`

- [ ] **Step 1: Write failing tests for same-offset relocation evidence**

Add these tests to `tools/melee-agent/tests/test_name_magic_source.py`:

```python
from __future__ import annotations

import textwrap

from src.mwcc_debug.name_magic_source import (
    NameMagicBlocker,
    generate_name_magic_source_probes,
    parse_name_magic_relocation_evidence,
)


def test_parse_name_magic_relocations_pairs_same_offset_and_records_residual() -> None:
    payload = {
        "diff": [
            "--- expected",
            "+++ current",
            "@@ -1,4 +1,4 @@",
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0",
            "-+02c: R_PPC_ADDR16_LO\tmn_803EAE68",
            "++02c: R_PPC_ADDR16_LO\t...data.0",
            "-+984: 38 81 02 a8 \taddi    r4,r1,680",
            "++984: 38 81 02 94 \taddi    r4,r1,660",
            "-+af8: R_PPC_EMB_SDA21\tmn_804DBDA8",
            "++af8: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker is None
    assert [(r.offset, r.kind, r.expected_symbol, r.current_symbol) for r in evidence.relocations] == [
        ("024", "R_PPC_ADDR16_HA", "mn_803EAE68", "...data.0"),
        ("02c", "R_PPC_ADDR16_LO", "mn_803EAE68", "...data.0"),
        ("af8", "R_PPC_EMB_SDA21", "mn_804DBDA8", "@267"),
    ]
    assert evidence.residual_diff_count == 1


def test_parse_name_magic_relocations_blocks_without_supported_pairs() -> None:
    payload = {
        "diff": [
            "--- expected",
            "+++ current",
            "-+984: 38 81 02 a8 \taddi    r4,r1,680",
            "++984: 38 81 02 94 \taddi    r4,r1,660",
        ],
        "classification": {"primary": "operand-register-or-offset"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker == NameMagicBlocker.RAW_DIFF_NO_SUPPORTED_DATA_SYMBOL_PAIR
    assert evidence.relocations == []


def test_parse_name_magic_relocations_blocks_ambiguous_same_offset_pairs() -> None:
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE70",
            "++024: R_PPC_ADDR16_HA\t...data.0",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker == NameMagicBlocker.AMBIGUOUS_RELOCATION_PAIR


def test_parse_name_magic_relocations_blocks_incompatible_kinds() -> None:
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_LO\t...data.0",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker == NameMagicBlocker.UNSUPPORTED_RELOC_KIND


def test_parse_name_magic_relocations_requires_expected_named_symbol() -> None:
    payload = {
        "diff": [
            "-+024: R_PPC_EMB_SDA21\t@901",
            "++024: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker == NameMagicBlocker.UNSUPPORTED_RELOC_KIND
```

- [ ] **Step 2: Run evidence tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_name_magic_source.py::test_parse_name_magic_relocations_pairs_same_offset_and_records_residual tools/melee-agent/tests/test_name_magic_source.py::test_parse_name_magic_relocations_blocks_without_supported_pairs -q
```

Expected: FAIL because `src.mwcc_debug.name_magic_source` does not exist.

- [ ] **Step 3: Implement evidence dataclasses and parser**

Create `tools/melee-agent/src/mwcc_debug/name_magic_source.py` with:

```python
from __future__ import annotations

import dataclasses
import enum
import re
from pathlib import Path
from typing import Any


class NameMagicBlocker(str, enum.Enum):
    RAW_DIFF_NO_SUPPORTED_DATA_SYMBOL_PAIR = "raw-diff-no-supported-data-symbol-pair"
    TARGET_OBJECT_MISSING = "target-object-missing"
    CURRENT_OBJECT_MISSING = "current-object-missing"
    AMBIGUOUS_RELOCATION_PAIR = "ambiguous-relocation-pair"
    UNSUPPORTED_RELOC_KIND = "unsupported-reloc-kind"
    UNSUPPORTED_SECTION_ANCHOR_OFFSET = "unsupported-section-anchor-offset"
    UNSUPPORTED_SOURCE_SITE = "unsupported-source-site"
    AMBIGUOUS_SDATA2_VALUE = "ambiguous-sdata2-value"
    SDATA2_POOL_ORDER_DEPENDENT = "sdata2-pool-order-dependent"
    DECLARATION_APPLY_UNSUPPORTED = "declaration-apply-unsupported"
    NO_NAME_MAGIC_VALIDATION_FAILED = "no-name-magic-validation-failed"
    NO_NAME_MAGIC_CANDIDATE = "no-name-magic-candidate"


@dataclasses.dataclass(frozen=True)
class NameMagicRelocation:
    offset: str
    kind: str
    expected_symbol: str
    current_symbol: str

    @property
    def operator_family(self) -> str:
        if self.current_symbol.startswith("@"):
            return "sdata2-named-float-load"
        return "data-symbol-static-to-global"


@dataclasses.dataclass(frozen=True)
class NameMagicEvidence:
    relocations: list[NameMagicRelocation]
    residual_diff_count: int
    blocker: NameMagicBlocker | None = None
    reason: str | None = None


_RELOC_DIFF_RE = re.compile(
    r"^(?P<side>[-+])\+(?P<offset>[0-9a-fA-F]+):\s+"
    r"(?P<kind>R_PPC_[A-Za-z0-9_]+)\t(?P<symbol>\S+)"
)


def _supported_current_symbol(symbol: str) -> bool:
    return symbol.startswith("@") or symbol.startswith("...data.")


def parse_name_magic_relocation_evidence(payload: dict[str, Any]) -> NameMagicEvidence:
    diff = payload.get("diff")
    if not isinstance(diff, list):
        return NameMagicEvidence(
            [],
            0,
            NameMagicBlocker.RAW_DIFF_NO_SUPPORTED_DATA_SYMBOL_PAIR,
            "checkdiff JSON did not include a diff list",
        )

    by_offset: dict[str, dict[str, list[tuple[str, str]]]] = {}
    residual_diff_count = 0
    for raw_line in diff:
        if not isinstance(raw_line, str):
            continue
        match = _RELOC_DIFF_RE.match(raw_line)
        if match is None:
            if raw_line.startswith(("-+", "++")):
                residual_diff_count += 1
            continue
        by_offset.setdefault(match.group("offset").lower(), {"-": [], "+": []})[
            match.group("side")
        ].append((match.group("kind"), match.group("symbol")))

    relocations: list[NameMagicRelocation] = []
    for offset, sides in sorted(by_offset.items()):
        expected = sides["-"]
        current = sides["+"]
        if len(expected) != 1 or len(current) != 1:
            return NameMagicEvidence(
                [],
                residual_diff_count,
                NameMagicBlocker.AMBIGUOUS_RELOCATION_PAIR,
                f"multiple relocation lines at offset {offset}",
            )
        expected_kind, expected_symbol = expected[0]
        current_kind, current_symbol = current[0]
        if expected_kind != current_kind:
            return NameMagicEvidence(
                [],
                residual_diff_count,
                NameMagicBlocker.UNSUPPORTED_RELOC_KIND,
                f"relocation kind mismatch at offset {offset}",
            )
        if (
            expected_symbol.startswith("@")
            or expected_symbol.startswith("...")
            or expected_symbol.startswith(".")
        ):
            return NameMagicEvidence(
                [],
                residual_diff_count,
                NameMagicBlocker.UNSUPPORTED_RELOC_KIND,
                f"expected relocation at offset {offset} is not a named symbol",
            )
        if not _supported_current_symbol(current_symbol):
            continue
        if current_symbol.startswith("...data.") and re.search(r"[+-](?:0x)?[0-9a-fA-F]+$", current_symbol):
            return NameMagicEvidence(
                [],
                residual_diff_count,
                NameMagicBlocker.UNSUPPORTED_SECTION_ANCHOR_OFFSET,
                f"section-anchor relocation at offset {offset} needs an offset field path",
            )
        relocations.append(
            NameMagicRelocation(
                offset=offset,
                kind=expected_kind,
                expected_symbol=expected_symbol,
                current_symbol=current_symbol,
            )
        )

    if not relocations:
        return NameMagicEvidence(
            [],
            residual_diff_count,
            NameMagicBlocker.RAW_DIFF_NO_SUPPORTED_DATA_SYMBOL_PAIR,
            "no same-offset anonymous or section-anchor data relocations found",
        )
    return NameMagicEvidence(relocations, residual_diff_count)
```

- [ ] **Step 4: Run evidence tests and verify they pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_name_magic_source.py::test_parse_name_magic_relocations_pairs_same_offset_and_records_residual tools/melee-agent/tests/test_name_magic_source.py::test_parse_name_magic_relocations_blocks_without_supported_pairs -q
```

Expected: PASS.

- [ ] **Step 5: Write failing tests for source probe generation**

Add these tests to `tools/melee-agent/tests/test_name_magic_source.py`:

```python
def test_static_to_global_probe_removes_only_file_scope_static() -> None:
    source = textwrap.dedent(
        """\
        static u16 mn_803EAE68[] = { 1, 2, 3 };

        void demo_fn(void)
        {
            static u16 mn_803EAE68_local[] = { 4 };
            sink(mn_803EAE68);
        }
        """
    )
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, {})

    assert blocker is None
    assert [probe.operator for probe in probes] == ["data-symbol-static-to-global"]
    assert "u16 mn_803EAE68[] = { 1, 2, 3 };" in probes[0].source_text
    assert "static u16 mn_803EAE68_local[] = { 4 };" in probes[0].source_text


def test_static_to_global_probe_rejects_earlier_function_local_static() -> None:
    source = textwrap.dedent(
        """\
        void earlier(void)
        {
            static u16 mn_803EAE68[] = { 1, 2, 3 };
            sink(mn_803EAE68);
        }

        void demo_fn(void)
        {
            sink();
        }
        """
    )
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, {})

    assert probes == []
    assert blocker == NameMagicBlocker.UNSUPPORTED_SOURCE_SITE


def test_static_to_global_probe_rejects_multi_declarator_and_preprocessor_region() -> None:
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    multi = "static u16 mn_803EAE68[] = { 1 }, other[] = { 2 };\nvoid demo_fn(void) {}\n"
    macro = "#if 1\nstatic u16 mn_803EAE68[] = { 1 };\n#endif\nvoid demo_fn(void) {}\n"

    assert generate_name_magic_source_probes(multi, "demo_fn", payload, {}) == (
        [],
        NameMagicBlocker.UNSUPPORTED_SOURCE_SITE,
    )
    assert generate_name_magic_source_probes(macro, "demo_fn", payload, {}) == (
        [],
        NameMagicBlocker.UNSUPPORTED_SOURCE_SITE,
    )


def test_sdata2_float_probe_replaces_unique_literal_with_named_volatile_load() -> None:
    source = textwrap.dedent(
        """\
        void demo_fn(HSD_JObj* jobj)
        {
            HSD_JObjReqAnimAll(jobj, 0.0F);
        }
        """
    )
    payload = {
        "diff": [
            "-+af8: R_PPC_EMB_SDA21\tmn_804DBDA8",
            "++af8: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    anonymous = {"@267": {"size": 4, "float": 0.0, "value": 0}}

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, anonymous)

    assert blocker is None
    assert [probe.operator for probe in probes] == ["sdata2-named-float-load"]
    assert "extern volatile f32 mn_804DBDA8;" in probes[0].source_text
    assert "HSD_JObjReqAnimAll(jobj, mn_804DBDA8);" in probes[0].source_text


def test_sdata2_double_probe_replaces_unique_literal_with_named_volatile_load() -> None:
    source = textwrap.dedent(
        """\
        void demo_fn(void)
        {
            sink_double(1.5);
        }
        """
    )
    payload = {
        "diff": [
            "-+110: R_PPC_EMB_SDA21\tmn_804DCA00",
            "++110: R_PPC_EMB_SDA21\t@901",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    anonymous = {"@901": {"size": 8, "double": 1.5, "value": 0x3FF8000000000000}}

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, anonymous)

    assert blocker is None
    assert [probe.operator for probe in probes] == ["sdata2-named-float-load"]
    assert "extern volatile f64 mn_804DCA00;" in probes[0].source_text
    assert "sink_double(mn_804DCA00);" in probes[0].source_text


def test_combined_probe_applies_static_and_sdata2_edits_from_original_source() -> None:
    source = textwrap.dedent(
        """\
        static u16 mn_803EAE68[] = { 1, 2, 3 };

        void demo_fn(HSD_JObj* jobj)
        {
            sink(mn_803EAE68);
            HSD_JObjReqAnimAll(jobj, 0.0F);
        }
        """
    )
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0",
            "-+af8: R_PPC_EMB_SDA21\tmn_804DBDA8",
            "++af8: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    anonymous = {"@267": {"size": 4, "float": 0.0, "value": 0}}

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, anonymous)

    assert blocker is None
    assert [probe.operator for probe in probes] == [
        "data-symbol-static-to-global",
        "sdata2-named-float-load",
        "name-magic-source-combined",
    ]
    combined = probes[2].source_text
    assert "u16 mn_803EAE68[] = { 1, 2, 3 };" in combined
    assert "extern volatile f32 mn_804DBDA8;" in combined
    assert "HSD_JObjReqAnimAll(jobj, mn_804DBDA8);" in combined


def test_sdata2_float_probe_blocks_when_literal_site_is_ambiguous() -> None:
    source = textwrap.dedent(
        """\
        void demo_fn(HSD_JObj* a, HSD_JObj* b)
        {
            HSD_JObjReqAnimAll(a, 0.0F);
            HSD_JObjReqAnimAll(b, 0.0F);
        }
        """
    )
    payload = {
        "diff": [
            "-+af8: R_PPC_EMB_SDA21\tmn_804DBDA8",
            "++af8: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    anonymous = {"@267": {"size": 4, "float": 0.0, "value": 0}}

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, anonymous)

    assert probes == []
    assert blocker == NameMagicBlocker.UNSUPPORTED_SOURCE_SITE


def test_sdata2_float_probe_blocks_ambiguous_anonymous_value() -> None:
    source = "void demo_fn(HSD_JObj* jobj) { HSD_JObjReqAnimAll(jobj, 0.0F); }\n"
    payload = {
        "diff": [
            "-+af8: R_PPC_EMB_SDA21\tmn_804DBDA8",
            "++af8: R_PPC_EMB_SDA21\t@267",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }
    anonymous = {"@267": {"size": 4, "float": 0.0, "value": 0, "ambiguous": True}}

    probes, blocker = generate_name_magic_source_probes(source, "demo_fn", payload, anonymous)

    assert probes == []
    assert blocker == NameMagicBlocker.AMBIGUOUS_SDATA2_VALUE


def test_sdata2_probe_reports_stable_blockers_for_double_and_bias_first_pass() -> None:
    source = "void demo_fn(void) { sink(0.0); }\n"
    payload = {
        "diff": [
            "-+010: R_PPC_EMB_SDA21\tmn_804DBD88",
            "++010: R_PPC_EMB_SDA21\t@377",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    probes, blocker = generate_name_magic_source_probes(
        source,
        "demo_fn",
        payload,
        {"@377": {"size": 8, "value": 0x4330000080000000, "bias": "s32"}},
    )

    assert probes == []
    assert blocker == NameMagicBlocker.UNSUPPORTED_RELOC_KIND


def test_parse_blocks_section_anchor_offsets_until_field_paths_are_supported() -> None:
    payload = {
        "diff": [
            "-+024: R_PPC_ADDR16_HA\tmn_803EAE68",
            "++024: R_PPC_ADDR16_HA\t...data.0+4",
        ],
        "classification": {"primary": "data-symbol-or-relocation"},
    }

    evidence = parse_name_magic_relocation_evidence(payload)

    assert evidence.blocker == NameMagicBlocker.UNSUPPORTED_SECTION_ANCHOR_OFFSET
```

- [ ] **Step 6: Run source probe tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_name_magic_source.py::test_static_to_global_probe_removes_only_file_scope_static tools/melee-agent/tests/test_name_magic_source.py::test_sdata2_float_probe_replaces_unique_literal_with_named_volatile_load tools/melee-agent/tests/test_name_magic_source.py::test_sdata2_float_probe_blocks_when_literal_site_is_ambiguous -q
```

Expected: FAIL because `generate_name_magic_source_probes` is not implemented.

- [ ] **Step 7: Implement source probes**

Add to `tools/melee-agent/src/mwcc_debug/name_magic_source.py`:

```python
@dataclasses.dataclass(frozen=True)
class NameMagicSourceEdit:
    start: int
    end: int
    replacement: str


@dataclasses.dataclass(frozen=True)
class NameMagicSourceProbe:
    label: str
    operator: str
    description: str
    source_text: str
    edits: tuple[NameMagicSourceEdit, ...]
    provenance: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "operator": self.operator,
            "description": self.description,
            "provenance": dict(self.provenance),
        }


def generate_name_magic_source_probes(
    source: str,
    function: str,
    checkdiff_payload: dict[str, Any],
    anonymous_sdata2: dict[str, dict[str, Any]],
    *,
    max_probes: int = 12,
) -> tuple[list[NameMagicSourceProbe], NameMagicBlocker | None]:
    from .source_patch import find_function

    evidence = parse_name_magic_relocation_evidence(checkdiff_payload)
    if evidence.blocker is not None:
        return [], evidence.blocker
    function_span = find_function(source, function)
    if function_span is None:
        return [], NameMagicBlocker.UNSUPPORTED_SOURCE_SITE

    probes: list[NameMagicSourceProbe] = []
    blockers: list[NameMagicBlocker] = []
    seen_text: set[str] = set()
    for relocation in evidence.relocations:
        probe = None
        if relocation.current_symbol.startswith("...data."):
            probe, blocker = _static_to_global_probe(source, relocation, len(probes))
        elif relocation.current_symbol.startswith("@"):
            probe, blocker = _sdata2_named_float_probe(
                source,
                function_span.sig_start,
                function_span.body_close,
                relocation,
                anonymous_sdata2.get(relocation.current_symbol),
                len(probes),
            )
        else:
            blocker = NameMagicBlocker.UNSUPPORTED_RELOC_KIND
        if blocker is not None:
            blockers.append(blocker)
            continue
        if probe is None:
            continue
        if probe.source_text in seen_text:
            continue
        seen_text.add(probe.source_text)
        probes.append(probe)
        if len(probes) >= max_probes:
            break

    if not probes:
        return [], blockers[0] if blockers else NameMagicBlocker.UNSUPPORTED_SOURCE_SITE
    if len(probes) > 1:
        combined = _combined_probe(source, probes)
        if combined is not None and combined.source_text not in seen_text:
            probes.append(combined)
    return probes[:max_probes], None
```

Implement helper functions in the same module:

- `_apply_source_edits(source, edits)`: sort edits by `(start, end)` descending,
  reject overlapping ranges, and apply replacements to the original source.
- `_top_level_static_definition_span(source, symbol)`: mask comments, strings,
  and chars with `src.mwcc_debug.source_patch._strip_c_comments`, scan from file
  start to end, maintain brace depth, and collect semicolon-terminated
  declarations only at brace depth 0. Reject declarations inside preprocessor
  regions, declarations spanning a `#` line, declarations with top-level commas,
  declarations whose first token is not `static`, and declarations whose parsed
  declarator name is not exactly `symbol`.
- `_static_to_global_probe(source, relocation, index) -> tuple[NameMagicSourceProbe | None, NameMagicBlocker | None]`: call
  `_top_level_static_definition_span`; remove only the leading `static` token
  in that top-level declaration. Do not limit the scan to text before the target
  function; file-scope data may appear after helper functions, but local statics
  inside earlier functions must never be touched.
- `_sdata2_named_float_probe(source, body_start, body_close, relocation, anon, index) -> tuple[NameMagicSourceProbe | None, NameMagicBlocker | None]`:
  accept `anon["size"] == 4` float literals and `anon["size"] == 8` non-bias
  double literals only when the decoded value maps to exactly one simple literal
  occurrence inside `source[body_start:body_close]`. For f32, insert
  `extern volatile f32 <expected_symbol>;`; for f64, insert
  `extern volatile f64 <expected_symbol>;`. Replace only the unique literal with
  `<expected_symbol>`. If `anon["ambiguous"] is True`, return
  `AMBIGUOUS_SDATA2_VALUE`. If the 8-byte value is the signed or unsigned
  int-to-float bias, return `UNSUPPORTED_RELOC_KIND`. If duplicate values or
  duplicate literal sites exist, return `AMBIGUOUS_SDATA2_VALUE` or
  `UNSUPPORTED_SOURCE_SITE` instead of guessing.
- `_combined_probe(source, probes)`: concatenate the `edits` from individual
  probes, reject overlapping ranges, apply them to the original source with
  `_apply_source_edits`, and label the result `name-magic-source-combined`.
  Do not combine by diffing already-mutated source text; all edit spans are
  offsets into the original source.

- [ ] **Step 8: Run all name-magic source unit tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_name_magic_source.py -q
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add tools/melee-agent/src/mwcc_debug/name_magic_source.py tools/melee-agent/tests/test_name_magic_source.py
git commit -m "Add name-magic source probe generation"
```

---

### Task 2: Debug CLI And Whole-File No-Name-Magic Scoring

**Files:**
- Modify: `tools/melee-agent/src/cli/debug.py`
- Modify: `tools/melee-agent/tests/test_debug_cli_reorg.py`

- [ ] **Step 1: Write failing CLI tests**

Add tests to `tools/melee-agent/tests/test_debug_cli_reorg.py`:

```python
def test_name_magic_source_declarations_help_is_available() -> None:
    result = runner.invoke(app, ["debug", "mutate", "name-magic-source-declarations", "--help"])
    assert result.exit_code == 0
    assert "--score-match-percent" in result.output
    assert "--no-score-match-percent" in result.output
    assert "--compile-probes" in result.output


def test_name_magic_source_declarations_json_blocks_without_source(monkeypatch) -> None:
    from src.cli import debug as debug_cli

    monkeypatch.setattr(debug_cli, "_find_unit_for_function", lambda function, melee_root: None)
    result = runner.invoke(
        app,
        ["debug", "mutate", "name-magic-source-declarations", "-f", "fn_80000000", "--json"],
    )

    assert result.exit_code == 0
    payload = json.loads(result.output)
    assert payload["function"] == "fn_80000000"
    assert payload["blocker"] == "source-unavailable"
    assert payload["stop_condition"]["kind"] == "blocked"


def test_name_magic_source_declarations_json_blocks_when_current_object_missing(monkeypatch, tmp_path) -> None:
    from src.cli import debug as debug_cli

    repo = tmp_path / "repo"
    source = repo / "src" / "melee" / "demo.c"
    source.parent.mkdir(parents=True)
    source.write_text("void fn_80000000(void) {}\n", encoding="utf-8")
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", repo)
    monkeypatch.setattr(debug_cli, "_find_unit_for_function", lambda function, melee_root: "melee/demo")
    monkeypatch.setattr(
        debug_cli,
        "_run_checkdiff_no_name_magic_json",
        lambda *args, **kwargs: (
            {
                "diff": [
                    "-+010: R_PPC_EMB_SDA21\tmn_804DBDA8",
                    "++010: R_PPC_EMB_SDA21\t@267",
                ],
                "classification": {"primary": "data-symbol-or-relocation"},
            },
            None,
        ),
    )

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "name-magic-source-declarations",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "current-object-missing"
    assert payload["stop_condition"]["kind"] == "blocked"


def test_name_magic_source_declarations_json_blocks_when_target_object_missing(monkeypatch, tmp_path) -> None:
    from src.cli import debug as debug_cli

    repo = tmp_path / "repo"
    source = repo / "src" / "melee" / "demo.c"
    source.parent.mkdir(parents=True)
    source.write_text("void fn_80000000(void) {}\n", encoding="utf-8")
    current_obj = repo / "build" / "GALE01" / "src" / "melee" / "demo.o"
    current_obj.parent.mkdir(parents=True)
    current_obj.write_bytes(b"fake")
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", repo)
    monkeypatch.setattr(debug_cli, "_find_unit_for_function", lambda function, melee_root: "melee/demo")
    monkeypatch.setattr(
        debug_cli,
        "_run_checkdiff_no_name_magic_json",
        lambda *args, **kwargs: (
            {
                "diff": [
                    "-+010: R_PPC_EMB_SDA21\tmn_804DBDA8",
                    "++010: R_PPC_EMB_SDA21\t@267",
                ],
                "classification": {"primary": "data-symbol-or-relocation"},
            },
            None,
        ),
    )

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "name-magic-source-declarations",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "target-object-missing"
    assert payload["stop_condition"]["kind"] == "blocked"


def test_name_magic_source_declarations_json_blocks_when_no_name_magic_validation_fails(monkeypatch, tmp_path) -> None:
    from src.cli import debug as debug_cli

    source = tmp_path / "demo.c"
    source.write_text("void fn_80000000(void) {}\n", encoding="utf-8")
    monkeypatch.setattr(
        debug_cli,
        "_run_checkdiff_no_name_magic_json",
        lambda *args, **kwargs: (None, "checkdiff --no-name-magic emitted non-json"),
    )

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "name-magic-source-declarations",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "no-name-magic-validation-failed"
    assert payload["stop_condition"]["kind"] == "blocked"


def test_name_magic_source_declarations_json_reports_sdata2_pool_order_blocker(monkeypatch, tmp_path) -> None:
    from src.cli import debug as debug_cli

    repo = tmp_path / "repo"
    source = repo / "src" / "melee" / "demo.c"
    source.parent.mkdir(parents=True)
    source.write_text("void fn_80000000(void) { sink(0.0F); }\n", encoding="utf-8")
    current_obj = repo / "build" / "GALE01" / "src" / "melee" / "demo.o"
    target_obj = repo / "build" / "GALE01" / "obj" / "melee" / "demo.o"
    current_obj.parent.mkdir(parents=True)
    target_obj.parent.mkdir(parents=True)
    current_obj.write_bytes(b"fake")
    target_obj.write_bytes(b"fake")
    monkeypatch.setattr(debug_cli, "DEFAULT_MELEE_ROOT", repo)
    monkeypatch.setattr(debug_cli, "_find_unit_for_function", lambda function, melee_root: "melee/demo")
    monkeypatch.setattr(
        debug_cli,
        "_run_checkdiff_no_name_magic_json",
        lambda *args, **kwargs: (
            {
                "diff": [
                    "-+010: R_PPC_EMB_SDA21\tmn_804DBDA8",
                    "++010: R_PPC_EMB_SDA21\tlbl_804D0000",
                ],
                "classification": {"primary": "data-symbol-or-relocation"},
            },
            None,
        ),
    )
    monkeypatch.setattr(
        debug_cli,
        "_name_magic_object_evidence",
        lambda unit, melee_root: (
            {
                "anonymous_sdata2": {"@267": {"size": 4, "float": 0.0, "value": 0}},
                "name_magic_suggestions": [],
            },
            None,
        ),
    )

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "name-magic-source-declarations",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["blocker"] == "sdata2-pool-order-dependent"
    assert payload["stop_condition"]["kind"] == "blocked"
```

Use the existing `runner` and `app` imports already present in that file.

- [ ] **Step 2: Run CLI tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_help_is_available tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_without_source tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_current_object_missing tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_target_object_missing tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_no_name_magic_validation_fails tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_reports_sdata2_pool_order_blocker -q
```

Expected: FAIL because the command is not registered.

- [ ] **Step 3: Implement checkdiff and object evidence helpers**

In `tools/melee-agent/src/cli/debug.py`, add private helpers near `_score_source_candidate_real_tree`:

```python
def _run_checkdiff_no_name_magic_json(
    function: str,
    *,
    melee_root: Path,
    timeout: float | None,
    no_build: bool = False,
) -> tuple[dict | None, str | None]:
    cmd = [
        sys.executable,
        "tools/checkdiff.py",
        function,
        "--format",
        "json",
        "--no-name-magic",
    ]
    if no_build:
        cmd.append("--no-build")
    try:
        proc = subprocess.run(
            cmd,
            cwd=melee_root,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=_checkdiff_env_without_fingerprint(),
        )
    except subprocess.TimeoutExpired:
        return None, "checkdiff --no-name-magic timed out"
    except Exception as exc:
        return None, f"checkdiff --no-name-magic failed: {exc}"
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        detail = (proc.stderr or proc.stdout or str(exc)).strip()
        return None, f"checkdiff --no-name-magic emitted non-json: {detail}"
    if proc.returncode not in (0, 1):
        detail = (proc.stderr or proc.stdout or "").strip()
        return None, f"checkdiff --no-name-magic exited {proc.returncode}: {detail}"
    return payload, None
```

Add `_name_magic_object_evidence(unit: str, melee_root: Path) -> tuple[dict[str, Any] | None, str | None]`.
It must:

- require current object `build/GALE01/src/<unit>.o`; missing returns
  `(None, "current-object-missing")`
- require target object `build/GALE01/obj/<unit>.o`; missing returns
  `(None, "target-object-missing")`
- call `find_all_anonymous_sdata2_symbols(current_obj)` and render
  `anonymous_sdata2` keyed by anonymous name with `size`, `value`, and decoded
  `float` or `double` fields where applicable
- mark an anonymous entry with `ambiguous: True` when the same size/value occurs
  in more than one anonymous symbol or when object evidence cannot tie a
  duplicate value to the same-offset relocation target
- call `suggest_name_magic_map(current_obj, target_obj)` and render
  `name_magic_suggestions` as dictionaries with anonymous name, size, value,
  and target symbol
- classify signed/unsigned int-to-float bias values in the anonymous payload as
  `bias: "s32"` or `bias: "u32"`

The CLI JSON `evidence` field must include:

```python
{
    "raw_relocations": [relocation.__dict__ for relocation in parsed.relocations],
    "residual_diff_count": parsed.residual_diff_count,
    "classification": checkdiff_payload.get("classification"),
    "anonymous_sdata2": list(object_evidence["anonymous_sdata2"].values()),
    "name_magic_suggestions": object_evidence["name_magic_suggestions"],
}
```

Keep `object_evidence["anonymous_sdata2"]` as an internal dict keyed by symbol
for probe generation. Render `evidence["anonymous_sdata2"]` as `list[dict]` in
CLI JSON to match the approved JSON contract.

- [ ] **Step 4: Implement whole-file scorer**

Add `_score_whole_source_candidate_no_name_magic(path, function, melee_root, timeout, status=None)` near `_score_source_candidate_real_tree`. It must:

- resolve the unit and target source path from `report.json`
- acquire `_acquire_source_score_repo_lock(melee_root)`
- snapshot the original source text
- write the candidate text over the whole target source file with `_restore_source_snapshot` cleanup registered through `_register_active_source_restore`
- run `ninja build/GALE01/src/<unit>.o`
- call `_refresh_match_pct_after_successful_build(unit, function, melee_root, timeout=timeout)` to regenerate `report.json` while the candidate is staged and read the exact match percent from the fresh report
- run `_run_checkdiff_no_name_magic_json(function, melee_root=melee_root, timeout=timeout, no_build=True)` only after the report refresh, using it for the raw no-name-magic `match` boolean and final diff payload, not for match percent
- set `match_percent` from `_refresh_match_pct_after_successful_build`, not from the no-build checkdiff payload
- set `no_name_magic_match` from `payload["match"] is True`
- restore original source and rebuild `ninja build/GALE01/src/<unit>.o build/GALE01/report.json`

Return a small dataclass:

```python
@dataclasses.dataclass(frozen=True)
class _NameMagicWholeSourceScore:
    match_percent: float | None
    match_percent_error: str | None
    no_name_magic_match: bool | None
    checkdiff_payload: dict | None = None
```

- [ ] **Step 5: Implement CLI command**

Add a new Typer command before `frame-transform-search`:

```python
@mutate_app.command(name="name-magic-source-declarations")
def mutate_name_magic_source_declarations_cmd(...):
    """Generate source declarations/references for name-magic relocation mismatches."""
```

Match the option set from the spec:

- `--function/-f`
- `--source-file`
- repeatable `--candidate`
- `--compile-probes/--no-compile-probes`, default `True`
- `--score-match-percent/--no-score-match-percent`, default `True`
- `--max-probes`, default `12`
- `--timeout`, default `120`
- `--json`

Implementation flow:

1. Resolve source file from `--source-file` or `report.json`.
2. If source is unavailable and no candidates were provided, emit a JSON/text blocked payload with `blocker="source-unavailable"`.
3. Resolve the unit with `_find_unit_for_function`; if missing, emit
   `blocker="source-unavailable"` unless a source file was explicitly supplied
   and a candidate-only run is requested.
4. Run `_run_checkdiff_no_name_magic_json(function, melee_root=melee_root, timeout=timeout, no_build=False)` to build
   the current object and collect raw no-name-magic diff evidence. If this
   helper returns an error, emit `blocker="no-name-magic-validation-failed"`.
5. Call `_name_magic_object_evidence(unit, melee_root)`. If it returns
   `current-object-missing` or `target-object-missing`, emit that blocker.
6. Parse relocation evidence and include the rendered object evidence under
   the JSON `evidence` key. If parsing returns
   `raw-diff-no-supported-data-symbol-pair`, checkdiff classification is still
   `data-symbol-or-relocation`, and object evidence has anonymous `.sdata2`
   entries, emit `sdata2-pool-order-dependent`; this is the explicit blocker
   for functions whose `.sdata2` pool order depends on earlier unmatched TU
   siblings rather than a directly source-addressable relocation pair.
7. Call `generate_name_magic_source_probes(source_text, function, checkdiff_payload, object_evidence["anonymous_sdata2"], max_probes=max_probes)`.
8. Retain generated probes under `tempfile.mkdtemp(prefix="name-magic-source-declarations-")` whenever JSON is requested or probes are compiled.
9. Score candidates with `_score_whole_source_candidate_no_name_magic(path, function=function, melee_root=melee_root, timeout=timeout, status=status)` when `--score-match-percent` is enabled.
10. Sort variants with true `no_name_magic_match` first, then exact 100%, then highest match percent.
11. Set `stop_condition.kind == "validated"` and top-level `blocker=None` only
    when a variant is `status == "ok"`, exact 100%, and
    `no_name_magic_match is True`. If variants exist but none validates, set
    top-level `blocker="no-name-magic-candidate"` and
    `stop_condition={"kind": "unvalidated", "blocker": "no-name-magic-candidate", "reason": "no source candidate reached a true --no-name-magic match"}`.

- [ ] **Step 6: Run CLI tests and verify they pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_help_is_available tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_without_source tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_current_object_missing tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_target_object_missing tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_blocks_when_no_name_magic_validation_fails tools/melee-agent/tests/test_debug_cli_reorg.py::test_name_magic_source_declarations_json_reports_sdata2_pool_order_blocker -q
```

Expected: PASS.

- [ ] **Step 7: Add a unit-style CLI candidate scoring test**

Add this test to `tools/melee-agent/tests/test_debug_cli_reorg.py`:

```python
def test_name_magic_source_declarations_candidate_requires_no_name_magic_match(monkeypatch, tmp_path) -> None:
    from src.cli import debug as debug_cli

    source = tmp_path / "candidate.c"
    source.write_text("void fn_80000000(void) {}\n", encoding="utf-8")
    monkeypatch.setattr(
        debug_cli,
        "_find_unit_for_function",
        lambda function, melee_root: "melee/demo",
    )
    monkeypatch.setattr(
        debug_cli,
        "_run_checkdiff_no_name_magic_json",
        lambda *args, **kwargs: (
            {
                "diff": [
                    "-+010: R_PPC_EMB_SDA21\tmn_804DBDA8",
                    "++010: R_PPC_EMB_SDA21\t@267",
                ],
                "classification": {"primary": "data-symbol-or-relocation"},
            },
            None,
        ),
    )
    monkeypatch.setattr(
        debug_cli,
        "_name_magic_object_evidence",
        lambda unit, melee_root: (
            {
                "anonymous_sdata2": {"@267": {"size": 4, "float": 0.0, "value": 0}},
                "name_magic_suggestions": [
                    {
                        "anonymous": "@267",
                        "size": 4,
                        "value": 0,
                        "target": "mn_804DBDA8",
                    }
                ],
            },
            None,
        ),
    )
    monkeypatch.setattr(
        debug_cli,
        "_score_whole_source_candidate_no_name_magic",
        lambda *args, **kwargs: debug_cli._NameMagicWholeSourceScore(
            100.0,
            None,
            False,
            {"match": False, "fuzzy_match_percent": 100.0},
        ),
    )

    result = runner.invoke(
        app,
        [
            "debug",
            "mutate",
            "name-magic-source-declarations",
            "-f",
            "fn_80000000",
            "--source-file",
            str(source),
            "--candidate",
            f"manual:sdata2-named-float-load={source}",
            "--json",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["variants"][0]["final_match_percent"] == 100.0
    assert payload["variants"][0]["no_name_magic_match"] is False
    assert payload["blocker"] == "no-name-magic-candidate"
    assert payload["stop_condition"] == {
        "kind": "unvalidated",
        "blocker": "no-name-magic-candidate",
        "reason": "no source candidate reached a true --no-name-magic match",
    }
```

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add tools/melee-agent/src/cli/debug.py tools/melee-agent/tests/test_debug_cli_reorg.py
git commit -m "Add name-magic source declarations CLI"
```

---

### Task 3: Harvest Registration, Gates, And Whole-File Apply

**Files:**
- Modify: `tools/melee-agent/src/harvest.py`
- Modify: `tools/melee-agent/tests/test_harvest.py`

- [ ] **Step 1: Write failing harvest selection and command tests**

Add tests to `tools/melee-agent/tests/test_harvest.py`:

```python
def _data_symbol_row(function: str = "demo_fn") -> dict[str, str]:
    row = _row(
        function,
        headline_tool="checkdiff-name-magic",
        source_actionability="current-tools-data-symbol",
        frame_closability_tier="",
    )
    row["primary"] = "data-symbol-or-relocation"
    row["subcategory"] = "persistent-data-symbol-or-relocation"
    row["file_path"] = "melee/demo.c"
    return row


def test_data_symbol_queue_selects_name_magic_source_harness(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])

    rows = load_queue_rows(queue, work_bucket="data-symbol-relocation", repo_root=repo_root)

    assert select_harness(rows[0]) == "name-magic-source-declarations"


def test_data_symbol_future_normalized_primary_selects_name_magic_source_harness(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    row = _data_symbol_row()
    row["primary"] = "data-symbol-relocation"
    _write_queue(queue, [row])

    rows = load_queue_rows(queue, work_bucket="data-symbol-relocation", repo_root=repo_root)

    assert select_harness(rows[0]) == "name-magic-source-declarations"


def test_name_magic_harvest_builds_source_declarations_command(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    calls, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "validated candidate found"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(tmp_path / "candidate.c"),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    ledger = run_harvest("data-symbol-relocation", repo_root=repo_root, queue_path=queue, runner=runner)

    assert calls[0][:5] == ["debug", "mutate", "name-magic-source-declarations", "-f", "demo_fn"]
    assert "--score-match-percent" in calls[0]
    assert ledger["results"][0]["harness"] == "name-magic-source-declarations"
    assert ledger["results"][0]["status"] == "validated"
```

- [ ] **Step 2: Run selection and command tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py::test_data_symbol_queue_selects_name_magic_source_harness tools/melee-agent/tests/test_harvest.py::test_data_symbol_future_normalized_primary_selects_name_magic_source_harness tools/melee-agent/tests/test_harvest.py::test_name_magic_harvest_builds_source_declarations_command -q
```

Expected: FAIL because the harness is not registered.

- [ ] **Step 3: Register and select the harness**

In `tools/melee-agent/src/harvest.py`:

- add `HARNESS_NAME_MAGIC_SOURCE = "name-magic-source-declarations"`
- include it in `REGISTERED_HARNESSES`
- update `select_harness`:

```python
    if request.work_bucket == "data-symbol-relocation":
        if (
            request.source_actionability == "current-tools-data-symbol"
            and request.headline_tool == "checkdiff-name-magic"
            and request.primary in {"data-symbol-or-relocation", "data-symbol-relocation"}
            and request.subcategory in {"", "persistent-data-symbol-or-relocation"}
        ):
            return HARNESS_NAME_MAGIC_SOURCE
```

- add `_name_magic_source_command(request)` using the CLI command from Task 2
- call it from `_adapter_command`

- [ ] **Step 4: Run selection and command tests and verify they pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py::test_data_symbol_queue_selects_name_magic_source_harness tools/melee-agent/tests/test_harvest.py::test_data_symbol_future_normalized_primary_selects_name_magic_source_harness tools/melee-agent/tests/test_harvest.py::test_name_magic_harvest_builds_source_declarations_command -q
```

Expected: PASS.

- [ ] **Step 5: Write failing harvest gate tests**

Add tests:

```python
def test_name_magic_candidate_gate_requires_no_name_magic_match(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "bad gate"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(tmp_path / "candidate.c"),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": False,
                }
            ],
        }
    )

    ledger = run_harvest("data-symbol-relocation", repo_root=repo_root, queue_path=queue, runner=runner)

    assert ledger["results"][0]["status"] == "no_match"
    assert ledger["results"][0]["blocker"] == "no-validated-candidate"


def test_name_magic_candidate_gate_requires_validated_stop_condition(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "unvalidated", "blocker": "no-name-magic-candidate", "reason": "not validated"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(tmp_path / "candidate.c"),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    ledger = run_harvest("data-symbol-relocation", repo_root=repo_root, queue_path=queue, runner=runner)

    assert ledger["results"][0]["status"] == "no_match"
    assert ledger["results"][0]["blocker"] == "no-name-magic-candidate"


def test_name_magic_candidate_gate_reports_declaration_apply_unsupported_for_non_c_source(tmp_path: Path) -> None:
    repo_root = _repo_with_source(tmp_path)
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "bad source path"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(tmp_path / "candidate.pcdump.txt"),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    ledger = run_harvest("data-symbol-relocation", repo_root=repo_root, queue_path=queue, runner=runner)

    assert ledger["results"][0]["status"] == "no_match"
    assert ledger["results"][0]["blocker"] == "declaration-apply-unsupported"
```

- [ ] **Step 6: Run gate tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_requires_no_name_magic_match tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_requires_validated_stop_condition tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_reports_declaration_apply_unsupported_for_non_c_source -q
```

Expected: FAIL because generic `best_validated_candidate` accepts these payloads.

- [ ] **Step 7: Implement harness-specific candidate acceptance**

Change `best_validated_candidate(payload)` to accept `harness: str | None = None`. For `HARNESS_NAME_MAGIC_SOURCE`, require:

- top-level `stop_condition.kind == "validated"`
- candidate `status == "ok"`
- source path resolves to `.c`
- exact 100% match percent
- `candidate["no_name_magic_match"] is True`

Update `run_harvest_request` to call `best_validated_candidate(harness_json, harness=harness)`.

When no candidate passes and `_harness_blocker_result` returns a blocker, propagate the harness blocker. Otherwise return `BLOCKER_NO_VALIDATED_CANDIDATE`.
For `HARNESS_NAME_MAGIC_SOURCE`, if the payload has a validated-stop candidate
with exact 100% and `no_name_magic_match is True` but no retained `.c` source
path, return `status="no_match"` and `blocker="declaration-apply-unsupported"`.

- [ ] **Step 8: Run gate tests and verify they pass**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_requires_no_name_magic_match tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_requires_validated_stop_condition tools/melee-agent/tests/test_harvest.py::test_name_magic_candidate_gate_reports_declaration_apply_unsupported_for_non_c_source -q
```

Expected: PASS.

- [ ] **Step 9: Write failing whole-file apply and no-name-magic preflight tests**

Add tests:

```python
def test_name_magic_apply_replaces_whole_source_file(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = "static int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n"
    target.write_text(original, encoding="utf-8")
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n", encoding="utf-8")
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "validated candidate found"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(candidate),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    ledger = run_harvest(
        "data-symbol-relocation",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        match_checker=lambda function, *, cwd, timeout: HarnessProcessResult(["checkdiff", function, "--no-name-magic"], 1, "", "mismatch"),
        validator=lambda function, *, cwd, timeout: HarnessProcessResult(["checkdiff", function, "--no-name-magic"], 0, "", ""),
        apply=True,
    )

    assert ledger["results"][0]["status"] == "applied"
    assert target.read_text(encoding="utf-8") == candidate.read_text(encoding="utf-8")


def test_name_magic_apply_rolls_back_whole_file_when_validation_fails(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = "static int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n"
    target.write_text(original, encoding="utf-8")
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n", encoding="utf-8")
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "validated candidate found"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(candidate),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    ledger = run_harvest(
        "data-symbol-relocation",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        validator=lambda function, *, cwd, timeout: HarnessProcessResult(["checkdiff", function, "--no-name-magic"], 1, "", "mismatch"),
        apply=True,
    )

    assert ledger["results"][0]["status"] == "blocked"
    assert ledger["results"][0]["blocker"] == "apply-validation-failed"
    assert target.read_text(encoding="utf-8") == original


def test_name_magic_apply_rolls_back_whole_file_when_validation_is_interrupted(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    target = repo_root / "src" / "melee/demo.c"
    target.parent.mkdir(parents=True)
    original = "static int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n"
    target.write_text(original, encoding="utf-8")
    candidate = tmp_path / "candidate.c"
    candidate.write_text("int named_data[] = { 1 };\n\nint demo_fn(void) {\n    return named_data[0];\n}\n", encoding="utf-8")
    queue = tmp_path / "queues" / "data-symbol-relocation.tsv"
    _write_queue(queue, [_data_symbol_row()])
    _, runner = _json_runner(
        {
            "stop_condition": {"kind": "validated", "blocker": None, "reason": "validated candidate found"},
            "variants": [
                {
                    "status": "ok",
                    "source_retained": str(candidate),
                    "final_match_percent": 100.0,
                    "no_name_magic_match": True,
                }
            ],
        }
    )

    def interrupted_validator(function: str, *, cwd: Path, timeout: int):
        raise KeyboardInterrupt("stop")

    ledger = run_harvest(
        "data-symbol-relocation",
        repo_root=repo_root,
        queue_path=queue,
        runner=runner,
        validator=interrupted_validator,
        apply=True,
    )

    assert ledger["results"][0]["status"] == "blocked"
    assert ledger["results"][0]["blocker"] == "apply-validation-failed"
    assert target.read_text(encoding="utf-8") == original


def test_name_magic_default_validator_and_match_checker_use_no_name_magic(monkeypatch, tmp_path: Path) -> None:
    import subprocess
    from src import harvest as harvest_mod

    calls: list[list[str]] = []

    def fake_run(cmd, *, cwd, capture_output, text, timeout):
        calls.append(list(cmd))
        stdout = '{"match": true}' if "--format" in cmd else ""
        return subprocess.CompletedProcess(cmd, 0, stdout, "")

    monkeypatch.setattr(harvest_mod.subprocess, "run", fake_run)

    harvest_mod._name_magic_validator("demo_fn", cwd=tmp_path, timeout=1)
    harvest_mod._name_magic_match_checker("demo_fn", cwd=tmp_path, timeout=1)

    assert calls[0][-3:] == ["demo_fn", "--compact", "--no-name-magic"]
    assert "--format" in calls[1]
    assert "json" in calls[1]
    assert "--no-name-magic" in calls[1]
```

- [ ] **Step 10: Run apply tests and verify they fail**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py::test_name_magic_apply_replaces_whole_source_file tools/melee-agent/tests/test_harvest.py::test_name_magic_apply_rolls_back_whole_file_when_validation_fails tools/melee-agent/tests/test_harvest.py::test_name_magic_apply_rolls_back_whole_file_when_validation_is_interrupted tools/melee-agent/tests/test_harvest.py::test_name_magic_default_validator_and_match_checker_use_no_name_magic -q
```

Expected: FAIL because apply still transfers only the function body.

- [ ] **Step 11: Implement whole-file apply for name-magic only**

Add `_apply_whole_file_candidate` beside `_apply_candidate`:

- read candidate and target source
- write candidate text to `request.source_file`
- call the validator
- run same-file matched-function regression guard
- rollback on validator failure, validator exception, regression failure, or interruption

In `run_harvest_request`, if `harness == HARNESS_NAME_MAGIC_SOURCE and request.apply`, call `_apply_whole_file_candidate`; otherwise keep `_apply_candidate`.

Add `_name_magic_validator` and `_name_magic_match_checker`. In
`run_harvest_request`, when `harness == HARNESS_NAME_MAGIC_SOURCE`, use these
name-magic runners whenever the caller did not inject a custom `validator` or
`match_checker`; preserve injected runners for tests. Other harnesses continue
to use `_default_validator` and `_default_match_checker`.

Default validation for this harness must run:

```bash
python tools/checkdiff.py <function> --compact --no-name-magic
```

Default stale-row match checking for this harness must run:

```bash
python tools/checkdiff.py <function> --format json --no-name-magic
```

- [ ] **Step 12: Run harvest affected tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_harvest.py -q
```

Expected: PASS.

- [ ] **Step 13: Commit Task 3**

Run:

```bash
git add tools/melee-agent/src/harvest.py tools/melee-agent/tests/test_harvest.py
git commit -m "Wire name-magic source harness into harvest"
```

---

### Task 4: Focused Verification And Real Smoke Checks

**Files:**
- Modify only if failures expose missing #375 behavior.

- [ ] **Step 1: Run focused Python tests**

Run:

```bash
python -m pytest tools/melee-agent/tests/test_name_magic_source.py tools/melee-agent/tests/test_debug_cli_reorg.py tools/melee-agent/tests/test_harvest.py -q
```

Expected: PASS.

- [ ] **Step 2: Run compile checks**

Run:

```bash
python -m compileall -q tools/melee-agent/src
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 3: Run source CLI help smoke**

Run:

```bash
PYTHONPATH=tools/melee-agent python -m src.cli debug mutate name-magic-source-declarations --help
```

Expected: exit 0 and output includes `--no-score-match-percent`.

- [ ] **Step 4: Run source CLI canonical dry smoke without compiling probes**

Run:

```bash
PYTHONPATH=tools/melee-agent python -m src.cli debug mutate name-magic-source-declarations -f mn_8022DDA8_OnEnter --no-compile-probes --json
```

Expected: parseable JSON with `function == "mn_8022DDA8_OnEnter"`, non-empty `evidence.raw_relocations`, and either generated probes or a stable blocker. It must not crash on the canonical mixed relocation plus stack-offset diff.

- [ ] **Step 5: Run harvest zero-row/one-row smoke**

Run:

```bash
PYTHONPATH=tools/melee-agent python -m src.cli harvest data-symbol-relocation --limit 0 --json
PYTHONPATH=tools/melee-agent python -m src.cli harvest data-symbol-relocation --limit 1 --json
```

Expected: parseable ledgers. The `--limit 1` result should use harness `name-magic-source-declarations`; it may be `validated`, `no_match`, or `blocked` depending on current source safety, but must not be `unsupported`.

- [ ] **Step 6: Refresh editable install**

Run from `/Users/mike/code/melee`:

```bash
/opt/homebrew/opt/python@3.11/bin/python3.11 -m pip install -e /Users/mike/code/melee/tools/melee-agent
```

Then run:

```bash
/opt/homebrew/bin/melee-agent debug mutate name-magic-source-declarations --help
/opt/homebrew/bin/melee-agent harvest data-symbol-relocation --limit 0 --json
python - <<'PY'
import src.cli, src.harvest, src.mwcc_debug.name_magic_source
print(src.cli.__file__)
print(src.harvest.__file__)
print(src.mwcc_debug.name_magic_source.__file__)
PY
```

Expected: help exits 0; harvest JSON parses; imports resolve to `/Users/mike/code/melee/tools/melee-agent`.

- [ ] **Step 7: Resolve issue #375 only if verified**

If the focused tests, CLI smokes, harvest smokes, and editable install checks pass, run:

```bash
melee-agent issue resolve 375 --note "fixed in <commit-hash>: added name-magic source declarations CLI/harness plus harvest no-name-magic validation and whole-file apply"
```

Do not resolve #378 in this work.

- [ ] **Step 8: Final status checks**

Run:

```bash
git status --short --branch
git log -1 --oneline
melee-agent issue list --status open
```

Expected: #375 resolved. If unrelated dirty pressure explorer files remain, report that master is not clean because of pre-existing unrelated work and do not revert it.
