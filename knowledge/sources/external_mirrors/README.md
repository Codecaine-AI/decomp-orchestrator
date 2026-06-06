# External Mirrors Source

Composite indexed source for mirrored external hint material.

The actual snapshots live in `knowledge/sources/external_mirrors/data`, including
Training Mode, m-ex, Tockdom, and ppc2cpp. This slice points to those folders
through `data/`.

Generated external symbol/document chunks are written to
`indexes/external_file_mentions.jsonl` during `kg-rebuild-graph`.
