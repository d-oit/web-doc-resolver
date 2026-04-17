from scripts.utils import is_safe_url


def test_new_blocked_ranges() -> None:
    """Test that new blocked ranges are correctly identified as unsafe."""
    # CGNAT
    assert not is_safe_url("http://100.64.0.1")
    assert not is_safe_url("http://100.127.255.255")
    assert is_safe_url("http://100.128.0.1")

    # Documentation ranges
    assert not is_safe_url("http://192.0.2.1")
    assert not is_safe_url("http://198.51.100.1")
    assert not is_safe_url("http://203.0.113.1")
    assert not is_safe_url("http://[2001:db8::1]")

    # IPv4-mapped IPv6
    assert not is_safe_url("http://[::ffff:127.0.0.1]")
    assert not is_safe_url("http://[::ffff:169.254.169.254]")
    assert not is_safe_url("http://[::ffff:192.168.1.1]")
    assert not is_safe_url("http://[::ffff:100.64.0.1]")

    # Global public IPs should be safe
    assert is_safe_url("https://google.com")
    assert is_safe_url("https://8.8.8.8")
    assert is_safe_url("https://[2001:4860:4860::8888]")
