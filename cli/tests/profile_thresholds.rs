use do_wdr_lib::config::routing_profile_defaults;

#[test]
fn test_rust_profile_thresholds() {
    let free = routing_profile_defaults("free");
    assert_eq!(free.min_free_quality_to_skip_paid, 0.70);

    let balanced = routing_profile_defaults("balanced");
    assert_eq!(balanced.min_free_quality_to_skip_paid, 0.70);

    let fast = routing_profile_defaults("fast");
    assert_eq!(fast.min_free_quality_to_skip_paid, 0.70);

    let quality = routing_profile_defaults("quality");
    assert_eq!(quality.min_free_quality_to_skip_paid, 0.75);
}
