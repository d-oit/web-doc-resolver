import unittest

from scripts.routing import ResolutionBudget


class TestRoutingEnvOverride(unittest.TestCase):
    def test_threshold_logic_respected(self):
        # High quality free result (0.8) meets threshold (0.7) -> skip paid
        budget = ResolutionBudget(3, 1, 10000, min_free_quality_to_skip_paid=0.7)
        score = 0.8
        self.assertTrue(score >= budget.min_free_quality_to_skip_paid)

        # High quality free result (0.8) DOES NOT meet threshold (0.9) -> continue to paid
        budget = ResolutionBudget(3, 1, 10000, min_free_quality_to_skip_paid=0.9)
        self.assertFalse(score >= budget.min_free_quality_to_skip_paid)

    def test_env_override_respected(self):
        import importlib
        import os
        import scripts.routing
        from unittest.mock import patch

        with patch.dict(os.environ, {"DO_WDR_MIN_FREE_QUALITY_TO_SKIP_PAID": "0.99"}):
            importlib.reload(scripts.routing)
            self.assertEqual(scripts.routing.DEFAULT_MIN_FREE_QUALITY, 0.99)
            budget = scripts.routing.ResolutionBudget(3, 1, 10000)
            self.assertEqual(budget.min_free_quality_to_skip_paid, 0.99)

        # Restore
        importlib.reload(scripts.routing)


if __name__ == "__main__":
    unittest.main()
