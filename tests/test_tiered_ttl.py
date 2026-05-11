import os
import tempfile
import unittest
from unittest.mock import patch

from scripts.utils import get_config_data, get_ttl


class TestGetTTL(unittest.TestCase):
    def setUp(self):
        get_config_data.cache_clear()

    def tearDown(self):
        get_config_data.cache_clear()

    def test_default_ttls(self):
        self.assertEqual(get_ttl("firecrawl"), 21600)
        self.assertEqual(get_ttl("exa"), 14400)
        self.assertEqual(get_ttl("exa_mcp"), 14400)
        self.assertEqual(get_ttl("jina"), 7200)
        self.assertEqual(get_ttl("duckduckgo"), 3600)
        self.assertEqual(get_ttl("llms_txt"), 28800)
        self.assertEqual(get_ttl("synthesis"), 43200)
        self.assertEqual(get_ttl("unknown"), 3600)

    def test_env_var_override(self):
        with patch.dict(os.environ, {"DO_WDR_CACHE_TTL_FIRECRAWL": "123"}):
            self.assertEqual(get_ttl("firecrawl"), 123)

    def test_config_dict_override(self):
        config = {
            "cache": {"ttl": {"firecrawl": 456, "exa": 789, "default": 10}},
        }
        self.assertEqual(get_ttl("firecrawl", config), 456)
        self.assertEqual(get_ttl("exa", config), 789)
        self.assertEqual(get_ttl("exa_mcp", config), 789)
        self.assertEqual(get_ttl("unknown", config), 10)

    def test_provider_alias_uses_exa_ttl(self):
        config = {"cache": {"ttl": {"exa": 321, "default": 10}}}
        self.assertEqual(get_ttl("exa_mcp", config), 321)

    def test_config_file_loading(self):
        with tempfile.NamedTemporaryFile("w", suffix=".toml") as config_file:
            config_file.write("[cache.ttl]\nfirecrawl = 456\ndefault = 10\n")
            config_file.flush()
            with patch.dict(os.environ, {"DO_WDR_CONFIG": config_file.name}):
                get_config_data.cache_clear()
                self.assertEqual(get_ttl("firecrawl"), 456)
                self.assertEqual(get_ttl("unknown"), 10)


if __name__ == "__main__":
    unittest.main()
