# Ghidra Runners

Put scripts that build or refresh Ghidra caches here. Examples:

- Query a checked-out Ghidra project for xrefs.
- Export strings, function names, and symbols.
- Run an explicitly requested live decompile.

Runner output should land in `cache/` or `indexes/`, then be normalized by the
`tool_outputs` source.
