import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.synthesis import (  # noqa: E402, F401
    deterministic_merge,
    should_call_llm_synthesis,
    synthesis_gate_decision,
)
