# Past PR Data

Current canonical locations:

- `current` contains the fetched raw PR dump, per-PR slices, aggregate analysis
  files, raw diffs, and refresh metadata.
- `prs` contains processed postmortems, search indexes, known fixes, and run
  summaries.

The graph rebuild consumes these folders directly, then emits file-to-PR graph
edges and search records.
