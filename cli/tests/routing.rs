use wdr_lib::routing::{ResolutionBudget, plan_provider_order};
use wdr_lib::routing_memory::RoutingMemory;

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
