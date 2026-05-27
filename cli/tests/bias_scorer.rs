use do_wdr_lib::bias_scorer::score_result;

#[test]
fn test_score_range_is_zero_to_one() {
    let score = score_result("https://example.com", "some content");
    assert!((0.0..=1.0).contains(&score));
}

#[test]
fn test_edu_domain_boost() {
    // Need >= 50 words to avoid short-content penalty (-0.15)
    let content = "research ".repeat(60); // 60 words, avoids penalty
    let score = score_result("https://cs.stanford.edu/research", &content);
    // .edu TLD gives +0.2, starting from 0.5 → >= 0.7
    assert!(score >= 0.7, "Expected >= 0.7, got {}", score);
}

#[test]
fn test_gov_domain_boost() {
    let content = "exploration ".repeat(60);
    let score = score_result("https://www.nasa.gov/mission", &content);
    assert!(score >= 0.7, "Expected >= 0.7, got {}", score);
}

#[test]
fn test_github_domain_boost() {
    let content = "project ".repeat(60);
    let score = score_result("https://github.com/rust-lang/rust", &content);
    // github.com is a dev site → +0.2, starting from 0.5 → >= 0.7
    assert!(score >= 0.7, "Expected >= 0.7, got {}", score);
}

#[test]
fn test_news_domain_boost() {
    let content = "news ".repeat(60);
    let score = score_result("https://www.bbc.co.uk/news/article", &content);
    // bbc.co.uk is a news site → +0.1, starting from 0.5 → >= 0.6
    assert!(score >= 0.6, "Expected >= 0.6, got {}", score);
}

#[test]
fn test_short_content_penalized() {
    let score = score_result("https://example.com", "very short");
    // < 50 words → -0.15, starting from 0.5 → 0.35
    assert!(
        score < 0.5,
        "Expected < 0.5 for short content, got {}",
        score
    );
}

#[test]
fn test_long_content_boosted() {
    // 2 words per repetition, 300 reps = 600 words, > 500 → +0.2
    // Each rep is ~20 chars, 300 * 20 = 6000 chars > 2000 → +0.1
    let content = "documentation word ".repeat(300);
    let score = score_result("https://example.com", &content);
    // No domain boost for example.com, starting from 0.5 + 0.2 + 0.1 ≈ 0.8
    assert!(score > 0.79, "Expected > 0.79, got {}", score);
}

#[test]
fn test_content_length_boost_graduated() {
    // 200 words, 800 chars → not enough for word bonus but > 150 words → +0.1
    let content = "doc ".repeat(200); // 200 words, ~800 chars
    let score = score_result("https://example.com", &content);
    assert!(
        score >= 0.6,
        "Expected >= 0.6 for medium content, got {}",
        score
    );
}

#[test]
fn test_spam_terms_penalized() {
    // "buy now" is a spam term → -0.1 per match
    let content = "Buy now and get the best deal! ".repeat(20);
    let score = score_result("https://example.com", &content);
    // Has "buy now", "cheap" not present, but "buy now" alone → -0.1
    // Starting from 0.5, with enough words (+0.1 or more), net score should
    // be below what it would be without spam terms
    assert!(score < 0.8, "Expected < 0.8 with spam terms, got {}", score);
}

#[test]
fn test_multiple_spam_terms_cumulative() {
    let content = "buy now cheap discount free trial best price ".repeat(5);
    let score = score_result("https://example.com", &content);
    // 5 spam terms → -0.5, starting from 0.5 → clamps to 0.0
    assert!(
        score < 0.3,
        "Expected significantly penalized, got {}",
        score
    );
}

#[test]
fn test_invalid_url_no_boost() {
    // URL that can't be parsed → no domain boost, score = 0.5 + content bonuses
    let score = score_result("not-a-url", "some content");
    // No TLD/dev/news boost because URL parse fails
    assert!((0.0..=1.0).contains(&score));
}

#[test]
fn test_score_clamped_to_max_1_0() {
    // Max boosts: .edu (+0.2) + dev site github (+0.2) + >500 words (+0.2) + >2000 chars (+0.1)
    // Starting from 0.5 → would be 1.2, clamped to 1.0
    let content = "documentation word ".repeat(600); // 1200 words
    // github.com is a dev site, .io TLD is trusted? .io IS in trusted_tlds
    let score = score_result("https://github.com/project", &content);
    // github.com matches dev_sites (+0.2), .com doesn't match trusted_tlds
    // >500 words (+0.2), >2000 chars (+0.1) → 0.5 + 0.2 + 0.2 + 0.1 = 1.0
    assert!(score <= 1.0);
    assert!(score >= 0.95, "Expected near 1.0, got {}", score);
}

#[test]
fn test_content_length_char_count_boost() {
    // Test char count boost thresholds independently
    // 150 words (enough to avoid penalty), 1100 chars (>1000, +0.05)
    let content = "a".repeat(1100); // 1100 chars, but split_whitespace is 1 word
    let score = score_result("https://example.com", &content);
    // 1 word (< 50) → -0.15 for word count, but +0.05 for chars > 1000
    // Starting from 0.5 → 0.5 - 0.15 + 0.05 = 0.40
    assert!((0.0..=1.0).contains(&score));
}

#[test]
fn test_stackoverflow_domain_boost() {
    let content = "code ".repeat(60);
    let score = score_result("https://stackoverflow.com/questions/123", &content);
    // stackoverflow.com is a dev site → +0.2
    assert!(score >= 0.7, "Expected >= 0.7, got {}", score);
}

#[test]
fn test_docs_rs_domain_boost() {
    let score = score_result("https://docs.rs/tokio/latest/tokio/", "tokio documentation");
    // docs.rs is a dev site → +0.2
    assert!(score >= 0.7, "Expected >= 0.7, got {}", score);
}
