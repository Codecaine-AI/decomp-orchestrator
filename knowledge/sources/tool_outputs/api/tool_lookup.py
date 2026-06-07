#!/usr/bin/env python3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "_shared"))
from source_index import run_search, tool_query

run_search(__file__, query_builder=tool_query)
