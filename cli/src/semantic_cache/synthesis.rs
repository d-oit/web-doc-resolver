use crate::ResolverError;
use super::{CacheStats, SemanticCache, StdResult};

#[cfg(feature = "semantic-cache")]
use std::collections::HashMap;

impl SemanticCache {
    #[cfg(feature = "semantic-cache")]
    pub async fn get_synthesis(&self, key: &str) -> StdResult<Option<String>, ResolverError> {
        if let Ok(Some(concept)) = self.framework.get_concept(key).await {
            if let Some(expires_at_val) = concept.metadata.get("expires_at") {
                if let Some(expires_at) = expires_at_val.as_i64() {
                    let now = chrono::Utc::now().timestamp();
                    if now < expires_at {
                        if let Some(content_val) = concept.metadata.get("content") {
                            if let Some(content) = content_val.as_str() {
                                return Ok(Some(content.to_string()));
                            }
                        }
                    } else {
                        let _ = self.framework.delete_concept(key).await;
                    }
                }
            }
        }
        Ok(None)
    }

    #[cfg(not(feature = "semantic-cache"))]
    pub async fn get_synthesis(&self, _key: &str) -> StdResult<Option<String>, ResolverError> {
        Ok(None)
    }

    #[cfg(feature = "semantic-cache")]
    pub async fn set_synthesis(
        &self,
        key: &str,
        content: &str,
        ttl_secs: u64,
    ) -> StdResult<(), ResolverError> {
        let mut metadata = HashMap::new();
        metadata.insert(
            "content".to_string(),
            serde_json::Value::String(content.to_string()),
        );
        let expires_at = chrono::Utc::now().timestamp() + ttl_secs as i64;
        metadata.insert(
            "expires_at".to_string(),
            serde_json::Value::Number(expires_at.into()),
        );
        metadata.insert(
            "type".to_string(),
            serde_json::Value::String("synthesis".to_string()),
        );

        let vector = self.encode_query(key);

        self.framework
            .inject_concept_with_metadata(key.to_string(), vector, metadata)
            .await
            .map_err(|e| ResolverError::Cache(format!("inject synthesis failed: {}", e)))?;

        Ok(())
    }

    #[cfg(not(feature = "semantic-cache"))]
    pub async fn set_synthesis(
        &self,
        _key: &str,
        _content: &str,
        _ttl_secs: u64,
    ) -> StdResult<(), ResolverError> {
        Ok(())
    }

    #[cfg(feature = "semantic-cache")]
    pub async fn stats(&self) -> StdResult<CacheStats, ResolverError> {
        Ok(CacheStats {
            entries: 0,
            hit_rate: 0.0,
            path: self.config.path.clone(),
        })
    }

    #[cfg(not(feature = "semantic-cache"))]
    #[allow(dead_code)]
    pub async fn stats(&self) -> StdResult<CacheStats, ResolverError> {
        Ok(CacheStats {
            entries: 0,
            hit_rate: 0.0,
            path: String::new(),
        })
    }
}
