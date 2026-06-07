# Tool Outputs Commands

Planned commands:

- `index` normalizes cached tool outputs.
- `emit_graph` emits cited tool findings into the shared graph.

This source should not call expensive external tools by itself. Tool execution
belongs to `knowledge/tools/<tool_id>/runners`.
