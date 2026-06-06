# Tooling Governance Issue Gate Design

## Goal

Enforce the new long-tail tooling workflow at the central `melee-agent issue report` entrypoint so feature requests carry enough evidence to judge reuse, source actionability, and stop conditions without relying on every matching-agent prompt being updated perfectly.

## Scope

This change applies to the local tooling issue queue only. It does not change source matching, scratch compilation, `checkdiff.py` auto-recording, or ordinary bug/papercut reporting.

## Behavior

For `melee-agent issue report --kind feature`, the CLI requires governance metadata unless the reporter supplies an explicit waiver. The required fields are:

- `Reusable class`
- `Applies to`
- `Source-actionable output`
- `Stop condition`
- `Existing workflow failed`

Reporters may provide these as dedicated CLI flags or as structured labeled lines in `--body`. Dedicated flags are normalized into a `Governance:` section appended to the stored issue body. Existing `--function` values may satisfy `Applies to` when `--applies-to` is omitted.

`--kind bug`, `--kind papercut`, and `--kind note` stay frictionless.

For `--kind blocker`, the command remains non-blocking. If the summary/body looks like a feature request, the CLI prints a warning nudging the reporter to use `--kind feature` with governance metadata or add a waiver.

Feature issues may bypass the gate with `--governance-waiver <reason>`. The waiver is stored in the issue body so later review can distinguish true evidence-backed feature work from exploratory exceptions.

`melee-agent issue resolve` gains `--impact` with these values:

- `matched`
- `retained-source-improvement`
- `negative-evidence`
- `infrastructure-only`
- `diagnostic-only`

When present, the resolver appends `impact=<value>` to the resolution note. This is advisory in the first version.

## Architecture

Keep enforcement in `tools/melee-agent/src/cli/issue.py`. No database migration is needed because governance metadata is stored in the existing `body` and `resolution_note` fields. Tests live in `tools/melee-agent/tests/test_issues.py`.

## Rollout

Update decomp and mwcc-debug skill docs to tell agents to file ordinary bugs immediately, but to include governance metadata for feature requests. This central CLI gate makes partial prompt coverage acceptable.
