//! AI synthesis and summarization of multiple results.

use crate::types::ResolvedResult;
use crate::error::ResolverError;
use reqwest::Client;
use serde_json::json;

/// Synthesize multiple results into a single cohesive response
pub async fn synthesize_results(
    query: &str,
    results: &[ResolvedResult],
    api_key: &str,
    model: &str,
) -> Result<String, ResolverError> {
    if results.is_empty() {
        return Ok("No results to synthesize.".to_string());
    }

    let client = Client::new();

    let mut context = String::new();
    for (i, res) in results.iter().enumerate() {
        if let Some(content) = &res.content {
            context.push_str(&format!("\nResult {}:\nURL: {}\nContent: {}\n---\n", i + 1, res.url, content));
        }
    }

    let prompt = format!(
        "Synthesize the following research results for the query: '{}'. \
        Provide a cohesive, well-structured answer in markdown format. \
        Cite sources using [1], [2], etc.\n\nContext:\n{}",
        query, context
    );

    let response = client
        .post("https://api.mistral.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful research assistant."},
                {"role": "user", "content": prompt}
            ]
        }))
        .send()
        .await
        .map_err(|e| ResolverError::Provider(format!("Synthesis request failed: {}", e)))?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| ResolverError::Provider(format!("Failed to parse synthesis response: {}", e)))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| ResolverError::Provider("Invalid synthesis response format".to_string()))?;

    Ok(content.to_string())
}
