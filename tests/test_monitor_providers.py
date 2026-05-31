import os
import unittest
from unittest.mock import MagicMock, mock_open, patch

from scripts.monitor_providers import (
    CheckResult,
    check_jina,
    log_issue,
    open_github_issue,
    update_routing_priority,
)


class TestMonitorProviders(unittest.TestCase):
    @patch("os.path.exists", return_value=True)
    @patch("builtins.open", new_callable=mock_open, read_data='base = ["jina", "duckduckgo"]')
    def test_update_routing_priority_basic(self, mock_file, mock_exists):
        update_routing_priority("jina")

        # Check that it was called to write
        mock_file.assert_called_with("scripts/routing.py", "w")
        handle = mock_file()
        # Find the write call that contains the updated list
        all_writes = "".join(call.args[0] for call in handle.write.call_args_list)
        self.assertIn('base = ["duckduckgo", "jina"]', all_writes)

    @patch("os.path.exists", return_value=True)
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data='base = [\n    "jina",\n    "duckduckgo"\n]',
    )
    def test_update_routing_priority_multiline(self, mock_file, mock_exists):
        update_routing_priority("jina")

        handle = mock_file()
        all_writes = "".join(call.args[0] for call in handle.write.call_args_list)
        self.assertIn('"duckduckgo",', all_writes)
        self.assertIn('"jina",', all_writes)
        # Check jina is after duckduckgo
        self.assertTrue(all_writes.find('"jina"') > all_writes.find('"duckduckgo"'))

    @patch("scripts.monitor_providers.get_session")
    def test_check_jina_healthy(self, mock_get_session):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "Some markdown content"
        mock_get_session.return_value.get.return_value = mock_resp

        result, error = check_jina()
        self.assertEqual(result, CheckResult.HEALTHY)
        self.assertIsNone(error)

    @patch("scripts.monitor_providers.get_session")
    def test_check_jina_failed(self, mock_get_session):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_get_session.return_value.get.return_value = mock_resp

        result, error = check_jina()
        self.assertEqual(result, CheckResult.FAILED)
        self.assertIn("HTTP 500", error)

    @patch("os.path.exists", return_value=True)
    @patch(
        "builtins.open",
        new_callable=mock_open,
        read_data="# Provider Alert: jina unstable\n- **Date**: 2026-05-20",
    )
    @patch("scripts.monitor_providers.open_github_issue")
    def test_log_issue_duplicate(self, mock_github, mock_file, mock_exists):
        # We need to freeze time or mock datetime to test exact date matching if we want to be precise,
        # but for now we rely on the mocked read_data containing today's date (simulated)
        with patch("scripts.monitor_providers.datetime") as mock_date:
            mock_date.now.return_value.strftime.return_value = "2026-05-20"
            log_issue("jina", "Some error")

            # Should NOT append because it exists for today
            self.assertFalse(any(call.args[0] == "a" for call in mock_file.call_args_list))

    @patch("requests.post")
    @patch("requests.get")
    @patch.dict(os.environ, {"GITHUB_TOKEN": "test", "GITHUB_REPOSITORY": "owner/repo"})
    def test_open_github_issue_deduplication(self, mock_get, mock_post):
        # Mock existing issue
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [{"title": "Provider Alert: jina unstable"}]

        open_github_issue("jina", "error")

        # post (creation) should NOT be called
        mock_post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
