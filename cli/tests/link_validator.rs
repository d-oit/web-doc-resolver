use do_wdr_lib::link_validator;

#[tokio::test]
async fn test_validate_empty_links() {
    let links: Vec<String> = vec![];
    let result = link_validator::validate_links(&links).await;
    assert!(result.is_empty());
}

#[tokio::test]
async fn test_validate_non_url_skipped() {
    let links = vec!["not-a-url".to_string(), "also not".to_string()];
    let result = link_validator::validate_links(&links).await;
    assert!(result.is_empty());
}

#[tokio::test]
async fn test_validate_all_non_urls_skipped() {
    // Non-URLs should be silently skipped, only real URLs sent to client
    let links = vec!["not-a-url".to_string()];
    let result = link_validator::validate_links(&links).await;
    // No real HTTP URLs → no validations attempted → empty result
    assert!(result.is_empty());
}

#[tokio::test]
async fn test_validate_respects_url_format() {
    // Only http/https URLs pass the is_url check
    let links = vec![
        "ftp://example.com/file.txt".to_string(),
        "file:///etc/passwd".to_string(),
        "javascript:alert(1)".to_string(),
    ];
    let result = link_validator::validate_links(&links).await;
    // None of these are http/https, so all skipped
    assert!(result.is_empty());
}
