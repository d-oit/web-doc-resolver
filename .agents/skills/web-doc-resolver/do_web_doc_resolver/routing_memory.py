import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.routing_memory import (  # noqa: E402, F401
    RoutingMemory,
)
