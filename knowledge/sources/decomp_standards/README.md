# Global Melee Decomp Standards

This source owns runtime-accessible global standards for Melee decomp workers,
writers, QA, and PR review. It is separate from path-scoped quick facts so broad
rules can always be loaded without bringing item, fighter, menu, or stage hints
into unrelated contexts.

Trust rule:

- Current source, headers, symbols, splits, assembly, objdiff/checkdiff, and
  regression output outrank these standards.
- Standards are review policy and cleanup guidance, not proof that a specific
  source change is correct.
- Updates come through `source_update_proposal` records that target
  `decomp_standards`; model agents do not mutate this source directly.

APIs:

```bash
python3 knowledge/sources/decomp_standards/api/status.py --json
python3 knowledge/sources/decomp_standards/api/search.py --query typed --limit 10 --json
python3 knowledge/sources/decomp_standards/api/proposals.py --json
```

