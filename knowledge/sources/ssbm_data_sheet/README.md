# SSBM Data Sheet Source

Indexed source for data-sheet search and conservative graph hints.

The actual workbook and CSV exports live in
`knowledge/sources/ssbm_data_sheet/data`. This slice points
to them through `data/` and should treat results as external
hints because the sheet can be stale.

Generated cell/row search chunks are written to `indexes/cells.jsonl` during
`kg-rebuild-graph`.
