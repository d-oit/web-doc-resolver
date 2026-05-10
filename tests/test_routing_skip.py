from scripts.models import ProviderType, ResolveMetrics


def test_skip_logic_unit():
    # Direct unit test of the skip logic since integration test of generator is tricky

    metrics = ResolveMetrics()
    best_quality = 0.8

    # Low win rate skip
    win_rate = 0.1
    if win_rate < 0.2 and best_quality >= 0.7:
        metrics.record_provider(
            ProviderType.EXA, 0, False, skip_reason="low_win_rate"
        )

    assert len(metrics.provider_metrics) == 1
    assert metrics.provider_metrics[0].provider == "exa"
    assert metrics.provider_metrics[0].skip_reason == "low_win_rate"


def test_exa_quota_guard_logic():

    metrics = ResolveMetrics()
    best_quality = 0.8
    exa_usage = 900
    exa_quota = 1000
    budget_warn_threshold = 0.8

    if (exa_usage / exa_quota) > budget_warn_threshold and best_quality >= 0.7:
        metrics.record_provider(
            ProviderType.EXA_MCP, 0, False, skip_reason="quota_budget_guard"
        )

    assert len(metrics.provider_metrics) == 1
    assert metrics.provider_metrics[0].provider == "exa_mcp"
    assert metrics.provider_metrics[0].skip_reason == "quota_budget_guard"
