# New Provider Integration Plan

## Overview

This plan details the integration of 7 new providers (excluding Brave Search as requested) to expand the resolver's capabilities, coverage, and free tier options.

---

## Provider Priority Matrix

| Priority | Provider | Type | Free Tier | Effort | Impact |
|----------|----------|------|-----------|--------|--------|
| **P1** | Tavily Extract | URL | 1,000/mo | Low | Reuses existing key |
| **P1** | ScrapingAnt | URL | 10,000/mo | Low | Most generous free tier |
| **P2** | ScrapeGraph AI | URL | 50 credits | Medium | AI-powered extraction |
| **P2** | SearchAPI.io | Query | 100 requests | Medium | 40+ search engines |
| **P3** | ScrapingBee | URL | 1,000 credits | Medium | AI extraction, proxies |
| **P3** | You.com API | Both | Free signup | Medium | Research synthesis |
| **P4** | Perplexity API | Query | Free tier | Medium | AI-synthesized answers |

---

## Phase 1: Tavily Extract Integration (Week 1)

### Overview
Enhances existing Tavily integration with URL extraction capabilities using the same API key.

### Implementation

**File:** `scripts/providers_impl.py`

```python
def resolve_with_tavily_extract(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """Extract content from URL using Tavily Extract API.
    
    Uses the same TAVILY_API_KEY as Tavily search.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key or _is_rate_limited("tavily_extract"):
        return None
    
    try:
        from tavily import TavilyClient
        
        client = TavilyClient(api_key=api_key)
        
        # Use Tavily's extract endpoint
        response = client.extract(
            urls=[url],
            include_images=False,
            extract_depth="basic"  # or "advanced" for more content
        )
        
        if response and response.get("results"):
            result = response["results"][0]
            content = result.get("raw_content", "")
            
            if content and len(content) >= MIN_CHARS:
                return ResolvedResult(
                    source="tavily_extract",
                    content=compact_content(content, max_chars),
                    url=url,
                    metadata={
                        "title": result.get("title", ""),
                        "extract_depth": result.get("extract_depth", "basic")
                    }
                )
                
    except Exception as e:
        if "429" in str(e) or "rate limit" in str(e).lower():
            _set_rate_limit("tavily_extract", 60)
        logger.warning(f"Tavily Extract failed for {url}: {e}")
    
    return None
```

**File:** `cli/src/providers/tavily_extract.rs`

```rust
//! Tavily Extract provider for URL content extraction

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::ResolverError;
use crate::providers::Provider;
use crate::types::ResolvedResult;

pub struct TavilyExtractProvider {
    client: Arc<Client>,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

#[derive(Serialize)]
struct ExtractRequest {
    urls: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    extract_depth: Option<String>,
    include_images: bool,
}

#[derive(Deserialize)]
struct ExtractResponse {
    results: Vec<ExtractResult>,
}

#[derive(Deserialize)]
struct ExtractResult {
    url: String,
    raw_content: String,
    title: Option<String>,
}

impl TavilyExtractProvider {
    pub fn new(client: Arc<Client>) -> Self {
        let api_key = env::var("TAVILY_API_KEY").ok();
        Self {
            client,
            api_key,
            rate_limited: Arc::new(AtomicBool::new(false)),
        }
    }
    
    fn is_rate_limited(&self) -> bool {
        self.rate_limited.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl Provider for TavilyExtractProvider {
    fn name(&self) -> &str {
        "tavily_extract"
    }
    
    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }
    
    fn is_paid(&self) -> bool {
        true
    }
    
    async fn execute(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        let api_key = self.api_key.as_ref()
            .ok_or_else(|| ResolverError::Config("TAVILY_API_KEY not set".to_string()))?;
        
        let request = ExtractRequest {
            urls: vec![url.to_string()],
            extract_depth: Some("basic".to_string()),
            include_images: false,
        };
        
        let response = self.client
            .post("https://api.tavily.com/extract")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&request)
            .send()
            .await?;
        
        if response.status() == 429 {
            self.rate_limited.store(true, Ordering::SeqCst);
            return Err(ResolverError::RateLimit("Tavily Extract rate limited".to_string()));
        }
        
        let data: ExtractResponse = response.json().await?;
        
        if let Some(result) = data.results.first() {
            if !result.raw_content.is_empty() {
                return Ok(ResolvedResult {
                    source: "tavily_extract".to_string(),
                    url: url.to_string(),
                    content: result.raw_content.clone(),
                    score: None,
                    metadata: result.title.clone().map(|t| {
                        let mut map = std::collections::HashMap::new();
                        map.insert("title".to_string(), t);
                        map
                    }),
                });
            }
        }
        
        Err(ResolverError::Provider("Tavily Extract returned empty content".to_string()))
    }
}
```

### Cascade Integration

**File:** `scripts/resolve.py` (line ~192)

```python
# Add to URL cascade
cascade_map = {
    # ... existing providers
    "tavily_extract": (
        ProviderType.TAVILY_EXTRACT, 
        lambda: resolve_with_tavily_extract(url, max_chars)
    ),
    # ... rest of providers
}
```

**File:** `cli/src/resolver/cascade.rs`

Add `TavilyExtract` to the URL cascade between Jina and Firecrawl.

### Environment Variables

Already supported: `TAVILY_API_KEY`

### Testing

```python
# tests/test_providers.py
@pytest.mark.live
@pytest.mark.skipif(not os.getenv("TAVILY_API_KEY"), reason="No Tavily API key")
def test_live_tavily_extract():
    result = resolve_with_tavily_extract("https://example.com", max_chars=5000)
    assert result is not None
    assert result.source == "tavily_extract"
    assert len(result.content) > 200
```

---

## Phase 2: ScrapingAnt Integration (Week 1-2)

### Overview
Generous free tier (10,000 credits/month) with JS rendering and proxy rotation.

### Implementation

**File:** `scripts/providers_impl.py`

```python
def resolve_with_scrapingant(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """Extract content using ScrapingAnt API.
    
    Free tier: 10,000 API credits/month
    """
    api_key = os.getenv("SCRAPINGANT_API_KEY")
    if not api_key or _is_rate_limited("scrapingant"):
        return None
    
    try:
        api_url = "https://api.scrapingant.com/v2/general"
        
        headers = {
            "x-api-key": api_key
        }
        
        params = {
            "url": url,
            "js_rendering": "true",
            "proxy_type": "datacenter"  # or "residential" for harder targets
        }
        
        response = requests.get(api_url, headers=headers, params=params, timeout=30)
        
        if response.status_code == 429:
            _set_rate_limit("scrapingant", 60)
            return None
        
        response.raise_for_status()
        content = response.text
        
        if len(content) >= MIN_CHARS:
            return ResolvedResult(
                source="scrapingant",
                content=compact_content(content, max_chars),
                url=url,
                metadata={"proxy_type": "datacenter"}
            )
            
    except Exception as e:
        logger.warning(f"ScrapingAnt failed for {url}: {e}")
    
    return None
```

**File:** `cli/src/providers/scrapingant.rs`

```rust
//! ScrapingAnt provider

use async_trait::async_trait;
use reqwest::Client;
use std::env;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::ResolverError;
use crate::providers::Provider;
use crate::types::ResolvedResult;

pub struct ScrapingAntProvider {
    client: Arc<Client>,
    api_key: Option<String>,
    rate_limited: Arc<AtomicBool>,
}

impl ScrapingAntProvider {
    pub fn new(client: Arc<Client>) -> Self {
        let api_key = env::var("SCRAPINGANT_API_KEY").ok();
        Self {
            client,
            api_key,
            rate_limited: Arc::new(AtomicBool::new(false)),
        }
    }
    
    fn is_rate_limited(&self) -> bool {
        self.rate_limited.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl Provider for ScrapingAntProvider {
    fn name(&self) -> &str {
        "scrapingant"
    }
    
    fn is_available(&self) -> bool {
        self.api_key.is_some() && !self.is_rate_limited()
    }
    
    fn is_paid(&self) -> bool {
        false  // Has generous free tier
    }
    
    async fn execute(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        let api_key = self.api_key.as_ref()
            .ok_or_else(|| ResolverError::Config("SCRAPINGANT_API_KEY not set".to_string()))?;
        
        let response = self.client
            .get("https://api.scrapingant.com/v2/general")
            .header("x-api-key", api_key)
            .query(&[
                ("url", url),
                ("js_rendering", "true"),
                ("proxy_type", "datacenter"),
            ])
            .send()
            .await?;
        
        if response.status() == 429 {
            self.rate_limited.store(true, Ordering::SeqCst);
            return Err(ResolverError::RateLimit("ScrapingAnt rate limited".to_string()));
        }
        
        let content = response.text().await?;
        
        if content.is_empty() {
            return Err(ResolverError::Provider("ScrapingAnt returned empty content".to_string()));
        }
        
        Ok(ResolvedResult {
            source: "scrapingant".to_string(),
            url: url.to_string(),
            content,
            score: None,
            metadata: None,
        })
    }
}
```

### Environment Variables

```bash
export SCRAPINGANT_API_KEY="your-api-key"
```

### Cascade Position

Add after Firecrawl in the URL cascade (position 7).

---

## Phase 3: ScrapeGraph AI Integration (Week 2-3)

### Overview
AI-powered extraction using natural language prompts. Multiple endpoints available.

### Implementation

**File:** `scripts/providers_impl.py`

```python
def resolve_with_scrapegraph(
    url: str, 
    max_chars: int = MAX_CHARS,
    extract_prompt: str | None = None
) -> ResolvedResult | None:
    """Extract content using ScrapeGraph AI.
    
    Free tier: 50 API credits (one-time) + 10 requests/min
    Endpoints:
    - /v1/markdownify (2 credits) - Simple extraction
    - /v1/smartscraper (10 credits) - AI-powered with prompts
    """
    api_key = os.getenv("SCRAPEGRAPH_API_KEY")
    if not api_key or _is_rate_limited("scrapegraph"):
        return None
    
    try:
        # Use markdownify endpoint for standard extraction
        api_url = "https://api.scrapegraphai.com/v1/markdownify"
        
        headers = {
            "accept": "application/json",
            "Content-Type": "application/json",
            "SGAI-APIKEY": api_key
        }
        
        data = {
            "website_url": url,
            "user_prompt": extract_prompt or "Extract all the main content"
        }
        
        response = requests.post(api_url, headers=headers, json=data, timeout=45)
        
        if response.status_code == 429:
            _set_rate_limit("scrapegraph", 60)
            return None
        
        response.raise_for_status()
        result = response.json()
        
        content = result.get("result", {}).get("markdown_content", "")
        
        if len(content) >= MIN_CHARS:
            return ResolvedResult(
                source="scrapegraph",
                content=compact_content(content, max_chars),
                url=url,
                metadata={
                    "credits_used": 2,
                    "endpoint": "markdownify"
                }
            )
            
    except Exception as e:
        logger.warning(f"ScrapeGraph AI failed for {url}: {e}")
    
    return None
```

### Environment Variables

```bash
export SCRAPEGRAPH_API_KEY="your-api-key"
```

---

## Phase 4: SearchAPI.io Integration (Week 3-4)

### Overview
40+ search engines with rich structured data and geo-targeting.

### Implementation

**File:** `scripts/providers_impl.py`

```python
def resolve_with_searchapi(
    query: str, 
    max_chars: int = MAX_CHARS,
    engine: str = "google"
) -> ResolvedResult | None:
    """Search using SearchAPI.io.
    
    Free tier: 100 requests (no credit card)
    Supports: google, bing, yandex, duckduckgo, amazon, youtube, etc.
    """
    api_key = os.getenv("SEARCHAPI_KEY")
    if not api_key or _is_rate_limited("searchapi"):
        return None
    
    try:
        api_url = "https://www.searchapi.io/api/v1/search"
        
        params = {
            "engine": engine,
            "q": query,
            "api_key": api_key
        }
        
        response = requests.get(api_url, params=params, timeout=30)
        
        if response.status_code == 429:
            _set_rate_limit("searchapi", 60)
            return None
        
        response.raise_for_status()
        data = response.json()
        
        # Extract organic results
        organic_results = data.get("organic_results", [])
        
        if not organic_results:
            return None
        
        # Format results as markdown
        content_parts = [f"# Search Results for: {query}\n"]
        
        for i, result in enumerate(organic_results[:5], 1):
            title = result.get("title", "")
            link = result.get("link", "")
            snippet = result.get("snippet", "")
            
            content_parts.append(f"## {i}. {title}\n")
            content_parts.append(f"**URL:** {link}\n")
            content_parts.append(f"{snippet}\n")
        
        content = "\n".join(content_parts)
        
        return ResolvedResult(
            source="searchapi",
            content=compact_content(content, max_chars),
            query=query,
            metadata={
                "engine": engine,
                "total_results": len(organic_results)
            }
        )
        
    except Exception as e:
        logger.warning(f"SearchAPI.io failed for '{query}': {e}")
    
    return None
```

### Environment Variables

```bash
export SEARCHAPI_KEY="your-api-key"
```

---

## Phase 5: ScrapingBee Integration (Week 4-5)

### Overview
AI-powered extraction with proxy rotation and JS rendering.

### Environment Variables

```bash
export SCRAPINGBEE_API_KEY="your-api-key"
```

---

## Phase 6: You.com API Integration (Week 5-6)

### Overview
Research API with multi-step reasoning for comprehensive answers.

### Environment Variables

```bash
export YOU_API_KEY="your-api-key"
```

---

## Phase 7: Perplexity API Integration (Week 6)

### Overview
AI-synthesized answers with citations. OpenAI-compatible API.

### Environment Variables

```bash
export PERPLEXITY_API_KEY="your-api-key"
```

---

## Updated Cascade Diagrams

### Query Resolution Cascade (Final)

```
1. Cache Check
2. Exa MCP (FREE)
3. Exa SDK (PAID)
4. Tavily (PAID)
5. Serper (PAID)
6. SearchAPI.io (PAID) ← NEW
7. DuckDuckGo (FREE)
8. Mistral Web Search (PAID)
9. You.com API (PAID) ← NEW
10. Perplexity (PAID) ← NEW
```

### URL Resolution Cascade (Final)

```
1. Cache Check
2. File Type Detection (Docling/OCR)
3. llms.txt (FREE)
4. Jina Reader (FREE)
5. Tavily Extract (PAID) ← NEW
6. Firecrawl (PAID)
7. ScrapingAnt (FREE) ← NEW
8. ScrapingBee (PAID) ← NEW
9. ScrapeGraph AI (PAID) ← NEW
10. Direct Fetch (FREE)
11. Mistral Browser (PAID)
12. DuckDuckGo (FREE)
```

---

## Environment Variables Summary

| Variable | Provider | Type | Required For |
|----------|----------|------|--------------|
| `TAVILY_API_KEY` | Tavily Extract | URL | Extraction endpoint |
| `SCRAPINGANT_API_KEY` | ScrapingAnt | URL | 10K free credits |
| `SCRAPEGRAPH_API_KEY` | ScrapeGraph AI | URL | AI extraction |
| `SEARCHAPI_KEY` | SearchAPI.io | Query | 40+ engines |
| `SCRAPINGBEE_API_KEY` | ScrapingBee | URL | Proxy rotation |
| `YOU_API_KEY` | You.com | Both | Research API |
| `PERPLEXITY_API_KEY` | Perplexity | Query | AI synthesis |

---

## Testing Checklist

- [ ] Unit tests with mocked responses
- [ ] Live integration tests (marked with `@pytest.mark.live`)
- [ ] Rate limit handling tests
- [ ] Error condition tests
- [ ] Cascade integration tests
- [ ] Documentation updates (PROVIDERS.md, CASCADE.md)

---

## Documentation Updates

1. **PROVIDERS.md**: Add new provider details
2. **CASCADE.md**: Update cascade diagrams
3. **README.md**: Add to provider list
4. **CONFIG.md**: Add environment variables
5. **CHANGELOG.md**: Document new providers
