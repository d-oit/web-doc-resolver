//! Docling provider for PDF/DOCX/PPTX parsing.

use crate::error::ResolverError;
use crate::providers::UrlProvider;
use crate::types::ResolvedResult;
use async_trait::async_trait;

pub struct DoclingProvider;

impl DoclingProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DoclingProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl UrlProvider for DoclingProvider {
    fn name(&self) -> &str {
        "docling"
    }

    fn is_available(&self) -> bool {
        // In a real implementation, this would check if the docling CLI or service is available
        true
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        if !url.ends_with(".pdf") && !url.ends_with(".docx") && !url.ends_with(".pptx") {
            return Err(ResolverError::Provider(
                "Not a supported document format".to_string(),
            ));
        }

        tracing::info!("Attempting to parse document with docling: {}", url);

        // In a real implementation, we would use the docling CLI or Python bridge
        // For now, we attempt to call 'docling' command if available
        let output = tokio::process::Command::new("docling")
            .arg("--format")
            .arg("markdown")
            .arg(url)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let content = String::from_utf8_lossy(&out.stdout).to_string();
                Ok(ResolvedResult::new(url, Some(content), "docling", 1.0))
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).to_string();
                Err(ResolverError::Provider(format!("Docling failed: {}", err)))
            }
            Err(_) => {
                // Command not found or other exec error
                Err(ResolverError::Provider(
                    "Docling CLI not found in environment".to_string(),
                ))
            }
        }
    }
}
