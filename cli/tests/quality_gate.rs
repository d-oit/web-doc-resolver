use do_wdr_lib::config::Config;
use do_wdr_lib::metrics::ResolveMetrics;
use do_wdr_lib::types::ResolvedResult;

#[tokio::test]
async fn test_quality_gate_logic() {
    let mut config = Config::default();
    config.routing.min_free_quality_to_skip_paid = Some(0.70);

    let mut metrics = ResolveMetrics::new();

    // Simulate high quality free result
    let mut free_res = ResolvedResult::new(
        "http://free.com",
        Some("content".to_string()),
        "exa_mcp",
        0.8,
    );
    // Add routing decision for quality check
    free_res
        .routing_decisions
        .push(do_wdr_lib::types::RoutingDecision {
            provider: "exa_mcp".to_string(),
            attempt_index: 0,
            quality_score: Some(0.8),
            accepted: true,
            skip_reason: None,
            stop_reason: None,
            negative_cache_hit: false,
            circuit_open: false,
            paid_provider: false,
        });

    let best_free_result = Some(free_res);

    // Logic check (matching what I added to cascade)
    if let Some(ref result) = best_free_result {
        let score = result.score as f32;

        if score >= config.routing.min_free_quality_to_skip_paid.unwrap_or(0.70) {
            metrics.record_gate(score);
        }
    }

    assert!(metrics.quality_gate_passed);
    assert_eq!(metrics.quality_gate_score, Some(0.8));
}
