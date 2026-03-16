//! OCR provider for image text extraction.

use crate::error::ResolverError;
use crate::types::ResolvedResult;
use async_trait::async_trait;
use crate::providers::UrlProvider;

pub struct OcrProvider;

impl OcrProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl UrlProvider for OcrProvider {
    fn name(&self) -> &str {
        "ocr"
    }

    fn is_available(&self) -> bool {
        true
    }

    async fn extract(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        if !url.ends_with(".png") && !url.ends_with(".jpg") && !url.ends_with(".jpeg") {
            return Err(ResolverError::Provider("Not a supported image format".to_string()));
        }

        tracing::info!("Attempting image OCR: {}", url);

        // Try 'tesseract' as a common OCR tool
        let output = tokio::process::Command::new("tesseract")
            .arg(url)
            .arg("stdout")
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let content = String::from_utf8_lossy(&out.stdout).to_string();
                Ok(ResolvedResult::new(url, Some(content), "ocr-tesseract", 1.0))
            }
            _ => {
                // If tesseract fails or is missing, try 'surya' if available
                let surya_output = tokio::process::Command::new("surya_ocr")
                    .arg(url)
                    .output()
                    .await;

                match surya_output {
                    Ok(out) if out.status.success() => {
                        let content = String::from_utf8_lossy(&out.stdout).to_string();
                        Ok(ResolvedResult::new(url, Some(content), "ocr-surya", 1.0))
                    }
                    _ => Err(ResolverError::Provider("No OCR tool (tesseract or surya) found in environment".to_string()))
                }
            }
        }
    }
}
