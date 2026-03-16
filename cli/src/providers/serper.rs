//! Serper (Google Search) provider.
//!
//! Provides Google search results via Serper.dev API.
//! Free tier: 2,500 credits (1 query = 1 credit).

use crate::error::{ResolverError, detect_error_type};
use crate::types::ResolvedResult;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::env;
use std::result::Result;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

/// Maximum Serper credits (free tier)
pub const SERPER_MAX_CREDITS: u32 = 2500;

/// Serper search provider
pub struct SerperProvider {
    client: reqwest::Client,
    api_key: Option<String>,
    /// Credits used (persisted in state)
    credits_used: Arc<AtomicU32>,
    /// Whether permanently rate limited
    rate_limited: Arc<AtomicBool>,
}

impl SerperProvider {
    /// Create a new Serper provider
    pub fn new() -> Self {
        let api_key = env::var("SERPER_API_KEY").ok();

        // Load persisted credits from state file
        let credits = Self::load_credits();

        tracing::debug!("Serper provider initialized, credits used: {}", credits);

        Self {
            client: reqwest::Client::new(),
            api_key,
            credits_used: Arc::new(AtomicU32::new(credits)),
            rate_limited: Arc::new(AtomicBool::new(credits >= SERPER_MAX_CREDITS)),
        }
    }

    /// Load credits from state file
    fn load_credits() -> u32 {
        let state_path = std::path::Path::new(".wdr_state.toml");
        if let Ok(content) = std::fs::read_to_string(state_path) {
            if let Ok(state) = content.parse::<toml::Value>() {
                if let Some(credits) = state
                    .get("serper_credits_used")
                    .and_then(|v| v.as_integer())
                {
                    return credits as u32;
                }
            }
        }
        0
    }

    /// Save credits to state file
    fn save_credits(credits: u32) {
        let state_path = std::path::Path::new(".wdr_state.toml");
        let mut state = if let Ok(content) = std::fs::read_to_string(state_path) {
            content
                .parse::<toml::Value>()
                .unwrap_or(toml::Value::Table(toml::map::Map::new()))
        } else {
            toml::Value::Table(toml::map::Map::new())
        };

        if let Some(table) = state.as_table_mut() {
            table.insert(
                "serper_credits_used".to_string(),
                toml::Value::Integer(credits as i64),
            );
        }

        if let Ok(s) = toml::to_string(&state) {
            let _ = std::fs::write(state_path, s);
        }
    }

    /// Get current credits used
    pub fn credits_used(&self) -> u32 {
        self.credits_used.load(Ordering::SeqCst)
    }

    /// Check if rate limited
    pub fn is_rate_limited(&self) -> bool {
        self.rate_limited.load(Ordering::SeqCst)
    }

    /// Set rate limit
    pub fn set_rate_limited(&self, limited: bool) {
        self.rate_limited.store(limited, Ordering::SeqCst);
    }
}

impl Default for SerperProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl crate::providers::QueryProvider for SerperProvider {
    fn name(&self) -> &str {
        "serper"
    }

    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }

    async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ResolvedResult>, ResolverError> {
        let api_key = self
            .api_key
            .as_ref()
            .ok_or_else(|| ResolverError::AuthError("SERPER_API_KEY not set".to_string()))?;

        // Check credits before making request
        let credits = self.credits_used.load(Ordering::SeqCst);
        if credits >= SERPER_MAX_CREDITS {
            tracing::warn!(
                "Serper credits exhausted ({} used), skipping permanently",
                credits
            );
            return Err(ResolverError::Quota(format!(
                "Serper credits exhausted: {}/{}",
                credits, SERPER_MAX_CREDITS
            )));
        }

        if self.is_rate_limited() {
            return Err(ResolverError::RateLimitError(
                "Serper is rate limited".to_string(),
            ));
        }

        tracing::debug!("Attempting serper for query='{}'", query);

        let response = self
            .client
            .post("https://google.serper.dev/search")
            .header("X-API-KEY", api_key)
            .header("Content-Type", "application/json")
            .json(&SerperRequest {
                q: query.to_string(),
                num: limit,
            })
            .send()
            .await
            .map_err(|e| ResolverError::NetworkError(e.to_string()))?;

        // Handle HTTP errors
        if response.status() == 429 {
            self.set_rate_limited(true);
            return Err(ResolverError::RateLimitError(
                "Serper rate limit exceeded".to_string(),
            ));
        }

        if response.status() == 401 || response.status() == 403 {
            return Err(ResolverError::AuthError(
                "Serper API key invalid".to_string(),
            ));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(detect_error_type(&error_text));
        }

        let serper_response: SerperResponse = response
            .json()
            .await
            .map_err(|e| ResolverError::ParseError(e.to_string()))?;

        // Increment and save credits
        let new_credits = self.credits_used.fetch_add(1, Ordering::SeqCst) + 1;
        Self::save_credits(new_credits);

        tracing::info!(
            "Serper credits used: {}/{}",
            new_credits,
            SERPER_MAX_CREDITS
        );

        // Parse organic results
        let results: Vec<ResolvedResult> = serper_response
            .organic
            .unwrap_or_default()
            .into_iter()
            .map(|r| ResolvedResult::new(
                r.link,
                Some(r.snippet),
                "serper",
                r.sitelinks.map(|_| 1.0).unwrap_or(0.8),
            ))
            .collect();

        let total_chars: usize = results
            .iter()
            .filter_map(|r| r.content.as_ref())
            .map(|c| c.len())
            .sum();

        tracing::info!(
            "serper success: {} results, chars={}",
            results.len(),
            total_chars
        );

        if results.is_empty() {
            return Err(ResolverError::Provider(
                "No results from Serper".to_string(),
            ));
        }

        Ok(results)
    }
}

#[derive(Debug, Serialize)]
struct SerperRequest {
    q: String,
    num: usize,
}

#[derive(Debug, Deserialize)]
struct SerperResponse {
    #[serde(default)]
    organic: Option<Vec<SerperOrganicResult>>,
    #[allow(dead_code)]
    #[serde(default)]
    knowledge_graph: Option<SerperKnowledgeGraph>,
}

#[derive(Debug, Deserialize)]
struct SerperOrganicResult {
    #[allow(dead_code)]
    title: String,
    link: String,
    snippet: String,
    #[serde(default)]
    sitelinks: Option<Vec<SerperSitelink>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct SerperSitelink {
    title: String,
    link: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct SerperKnowledgeGraph {
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    url: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::QueryProvider;

    #[test]
    fn test_provider_name() {
        let provider = SerperProvider::new();
        assert_eq!(provider.name(), "serper");
    }

    #[test]
    fn test_credits_loading() {
        // Test that credits can be loaded from state
        let provider = SerperProvider::new();
        let _ = provider.credits_used();
    }
}
