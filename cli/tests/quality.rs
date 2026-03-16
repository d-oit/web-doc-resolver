use wdr_lib::quality::score_content;

#[test]
fn test_quality_scoring() {
    let good_content =
        "This is a long enough content that should be considered acceptable and unique.\n"
            .repeat(20);
    let links = vec!["https://example.com".to_string()];

    let score = score_content(&good_content, &links, 0.65);
    assert!(score.acceptable);
    assert!(score.score > 0.7);

    let short_content = "Too short";
    let score = score_content(short_content, &links, 0.65);
    assert!(!score.acceptable);
    assert!(score.too_short);
}

#[test]
fn test_noisy_content() {
    let noisy_content =
        "Accept cookies. Subscribe to our newsletter. JavaScript is required. ".repeat(5);
    let links = vec!["https://example.com".to_string()];

    let score = score_content(&noisy_content, &links, 0.65);
    assert!(score.noisy);
}
