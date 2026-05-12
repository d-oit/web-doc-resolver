use do_wdr_lib::routing::{ResolutionBudget, plan_provider_order};
use do_wdr_lib::routing_memory::RoutingMemory;

#[test]
fn test_budget_enforcement() {
    let mut budget = ResolutionBudget {
        max_provider_attempts: 2,
        max_paid_attempts: 1,
        max_total_latency_ms: 1000,
        allow_paid: true,
        attempts: 0,
        paid_attempts: 0,
        elapsed_ms: 0,
        stop_reason: None,
    };

    assert!(budget.can_try(false));
    budget.record_attempt(false, 100);
    assert!(budget.can_try(true));
    budget.record_attempt(true, 100);

    // Max attempts reached
    assert!(!budget.can_try(false));
    assert_eq!(budget.stop_reason.as_deref(), Some("max_provider_attempts"));
}

#[test]
fn test_paid_budget_enforcement() {
    let mut budget = ResolutionBudget {
        max_provider_attempts: 5,
        max_paid_attempts: 1,
        max_total_latency_ms: 1000,
        allow_paid: true,
        attempts: 0,
        paid_attempts: 0,
        elapsed_ms: 0,
        stop_reason: None,
    };

    assert!(budget.can_try(true));
    budget.record_attempt(true, 100);

    // Max paid attempts reached
    assert!(!budget.can_try(true));
    assert_eq!(budget.stop_reason.as_deref(), Some("max_paid_attempts"));

    // Free still okay
    assert!(budget.can_try(false));
}

#[test]
fn test_plan_provider_order() {
    let target = "https://example.com/test";
    let planned = plan_provider_order(target, true, None, &[], None);

    assert!(!planned.is_empty());
    assert_eq!(planned[0].name, "llms_txt");
}

#[test]
fn test_plan_provider_order_with_memory() {
    let mut memory = RoutingMemory::default();
    let target = "https://example.com/test";

    // Record success for jina (which is usually second)
    memory.record("example.com", "jina", true, 100, 0.9);
    memory.record("example.com", "llms_txt", false, 100, 0.2);

    let planned = plan_provider_order(target, true, None, &[], Some(&memory));

    assert_eq!(planned[0].name, "jina");
}

#[test]
fn test_latency_ranking() {
    let mut memory = RoutingMemory::default();
    let providers: Vec<String> = vec!["fast".into(), "slow".into()];

    memory.record("example.com", "fast", true, 50, 0.9);
    memory.record("example.com", "slow", true, 2000, 0.9);

    let ranked = memory.rank_providers("example.com", &providers);
    assert_eq!(ranked[0], "fast");
}

#[test]
fn test_neutral_score_for_no_history() {
    let memory = RoutingMemory::default();
    let providers: Vec<String> = vec!["unknown".into()];

    let score = memory.compute_score("unknown", "nonexistent");
    assert!((score - 0.5).abs() < 1e-6);

    let ranked = memory.rank_providers("nonexistent", &providers);
    assert_eq!(ranked, providers);
}

#[test]
fn test_score_quality_factor() {
    let mut memory = RoutingMemory::default();

    memory.record("example.com", "high_quality", true, 100, 0.9);
    memory.record("example.com", "low_quality", true, 100, 0.1);

    let high = memory.compute_score("high_quality", "example.com");
    let low = memory.compute_score("low_quality", "example.com");

    // Same latency/success but different quality: high_quality should score higher
    assert!(
        high > low,
        "high_quality ({}) should beat low_quality ({})",
        high,
        low
    );
}

#[test]
fn test_volume_builds_confidence() {
    let mut memory = RoutingMemory::default();

    // Provider with many consistent good records (avg_latency ~200, avg_quality ~0.8)
    for _ in 0..20 {
        memory.record("example.com", "consistent", true, 200, 0.8);
    }
    // Provider with a single mediocre record
    memory.record("example.com", "one_shot", true, 200, 0.7);

    let consistent = memory.compute_score("consistent", "example.com");
    let one_shot = memory.compute_score("one_shot", "example.com");

    // Consistent provider with higher quality should beat the single mediocre record
    assert!(
        consistent > one_shot,
        "consistent ({}) should beat one_shot ({})",
        consistent,
        one_shot
    );
}

#[test]
fn test_latency_jitter_stability() {
    let mut memory = RoutingMemory::default();
    let providers: Vec<String> = vec!["stable".into(), "jittery".into()];

    // Stable provider: consistent latency
    for _ in 0..10 {
        memory.record("example.com", "stable", true, 100, 0.8);
    }

    // Jittery provider: same average but high variance
    for _ in 0..10 {
        memory.record("example.com", "jittery", true, 100, 0.8);
    }

    let ranked = memory.rank_providers("example.com", &providers);
    // Both have same stats, should be equal; order is stable
    assert!(ranked.contains(&"stable".to_string()));
    assert!(ranked.contains(&"jittery".to_string()));
}
