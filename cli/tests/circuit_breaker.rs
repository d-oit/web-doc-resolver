use std::time::Duration;
use wdr_lib::circuit_breaker::CircuitBreakerRegistry;

#[test]
fn test_circuit_breaker() {
    let mut registry = CircuitBreakerRegistry::default();
    let provider = "exa";

    assert!(!registry.is_open(provider));

    registry.record_failure(provider, 2, Duration::from_secs(60));
    assert!(!registry.is_open(provider));

    registry.record_failure(provider, 2, Duration::from_secs(60));
    assert!(registry.is_open(provider));

    registry.record_success(provider);
    assert!(!registry.is_open(provider));
}
