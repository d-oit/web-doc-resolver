import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.routing import (  # noqa: E402, F401
    PROFILE_BUDGETS,
    ResolutionBudget,
    detect_doc_platform,
    extract_domain,
    plan_provider_order,
    preflight_route,
)
