use url::Url;

use crate::routing_memory::RoutingMemory;

#[derive(Debug, Clone)]
pub struct PreflightResult {
    pub platform: Option<&'static str>,
    pub preferred_strategy: &'static str,
    pub confidence: f32,
    pub js_heavy: bool,
}

#[derive(Debug, Clone)]
pub struct ResolutionBudget {
    pub max_provider_attempts: usize,
    pub max_paid_attempts: usize,
    pub max_total_latency_ms: u64,
    pub allow_paid: bool,
    pub attempts: usize,
    pub paid_attempts: usize,
    pub elapsed_ms: u64,
    pub stop_reason: Option<String>,
}

impl ResolutionBudget {
    pub fn can_try(&mut self, is_paid: bool) -> bool {
        if self.attempts >= self.max_provider_attempts {
            self.stop_reason = Some("max_provider_attempts".into());
            return false;
        }
        if is_paid && !self.allow_paid {
            self.stop_reason = Some("paid_disabled".into());
            return false;
        }
        if is_paid && self.paid_attempts >= self.max_paid_attempts {
            self.stop_reason = Some("max_paid_attempts".into());
            return false;
        }
        if self.elapsed_ms >= self.max_total_latency_ms {
            self.stop_reason = Some("max_total_latency_ms".into());
            return false;
        }
        true
    }

    pub fn record_attempt(&mut self, is_paid: bool, latency_ms: u64) {
        self.attempts += 1;
        self.elapsed_ms += latency_ms;
        if is_paid {
            self.paid_attempts += 1;
        }
    }
}

#[derive(Debug, Clone)]
pub struct PlannedProvider {
    pub name: String,
    pub is_paid: bool,
    pub skip_reason: Option<String>,
}

pub fn detect_doc_platform(url: &str) -> Option<&'static str> {
    let parsed = Url::parse(url).ok()?;
    let hostname = parsed.host_str()?.to_ascii_lowercase();
    let path = parsed.path().to_ascii_lowercase();

    if hostname == "gitbook.io" || hostname.ends_with(".gitbook.io") {
        return Some("gitbook");
    }
    if hostname == "gitbook.com" || hostname.ends_with(".gitbook.com") {
        return Some("gitbook");
    }
    if hostname == "readthedocs.io" || hostname.ends_with(".readthedocs.io") {
        return Some("sphinx");
    }
    if hostname == "rtfd.io" || hostname.ends_with(".rtfd.io") {
        return Some("sphinx");
    }
    if hostname == "mkdocs.org" || hostname == "www.mkdocs.org" {
        return Some("mkdocs");
    }
    if hostname == "notion.so" || hostname.ends_with(".notion.so") {
        return Some("notion");
    }
    if hostname == "notion.site" || hostname.ends_with(".notion.site") {
        return Some("notion");
    }
    if (hostname.ends_with(".atlassian.net") && path.starts_with("/wiki"))
        || hostname.contains("confluence")
        || path.contains("confluence")
    {
        return Some("confluence");
    }

    None
}

pub fn preflight_route(url: &str) -> PreflightResult {
    let platform = detect_doc_platform(url);
    let parsed = Url::parse(url).ok();
    let hostname = parsed
        .as_ref()
        .and_then(|u| u.host_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    let path = parsed
        .as_ref()
        .map(|u| u.path().to_ascii_lowercase())
        .unwrap_or_default();

    if matches!(platform, Some("gitbook" | "sphinx" | "mkdocs")) {
        return PreflightResult {
            platform,
            preferred_strategy: "llms_txt",
            confidence: 0.85,
            js_heavy: false,
        };
    }

    if matches!(platform, Some("notion" | "confluence")) {
        return PreflightResult {
            platform,
            preferred_strategy: "extraction",
            confidence: 0.8,
            js_heavy: true,
        };
    }

    let doc_signals = [
        "docs.",
        "doc.",
        "documentation",
        "/docs/",
        "/doc/",
        "/api/",
        "/reference/",
    ];
    if doc_signals
        .iter()
        .any(|s| hostname.contains(s) || path.contains(s))
    {
        return PreflightResult {
            platform: None,
            preferred_strategy: "llms_txt",
            confidence: 0.6,
            js_heavy: false,
        };
    }

    if ["github.com", "gitlab.com", "bitbucket.org"]
        .iter()
        .any(|d| hostname.contains(d))
    {
        return PreflightResult {
            platform: None,
            preferred_strategy: "direct_fetch",
            confidence: 0.7,
            js_heavy: false,
        };
    }

    PreflightResult {
        platform: None,
        preferred_strategy: "llms_txt",
        confidence: 0.4,
        js_heavy: false,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn plan_provider_order(
    target: &str,
    is_url: bool,
    custom_order: Option<&[String]>,
    skip_providers: &[String],
    routing_memory: Option<&RoutingMemory>,
) -> Vec<PlannedProvider> {
    let mut base: Vec<String> = if let Some(custom) = custom_order {
        custom
            .iter()
            .filter(|p| {
                if let Ok(pt) = p.parse::<crate::types::ProviderType>() {
                    if is_url {
                        pt.is_url_provider()
                    } else {
                        pt.is_query_provider()
                    }
                } else {
                    false
                }
            })
            .cloned()
            .collect()
    } else if is_url {
        let preflight = preflight_route(target);

        if matches!(preflight.platform, Some("notion" | "confluence")) || preflight.js_heavy {
            vec![
                "firecrawl".into(),
                "mistral_browser".into(),
                "jina".into(),
                "direct_fetch".into(),
                "duckduckgo".into(),
            ]
        } else if preflight.preferred_strategy == "direct_fetch" {
            vec![
                "direct_fetch".into(),
                "llms_txt".into(),
                "jina".into(),
                "firecrawl".into(),
                "mistral_browser".into(),
                "duckduckgo".into(),
            ]
        } else {
            vec![
                "llms_txt".into(),
                "jina".into(),
                "firecrawl".into(),
                "direct_fetch".into(),
                "mistral_browser".into(),
                "duckduckgo".into(),
            ]
        }
    } else {
        // DuckDuckGo deprioritized due to instability (Alert 2026-04-20)
        vec![
            "exa_mcp".into(),
            "exa".into(),
            "tavily".into(),
            "serper".into(),
            "mistral_websearch".into(),
            "duckduckgo".into(),
        ]
    };

    if let Some(memory) = routing_memory {
        let domain = if is_url {
            crate::resolver::cascade::extract_domain_or_default(target)
        } else {
            "query".to_string()
        };
        base = memory.rank_providers(&domain, &base);
    }

    base.into_iter()
        .filter(|p| !skip_providers.contains(p))
        .map(|name| PlannedProvider {
            is_paid: matches!(
                name.as_str(),
                "exa" | "tavily" | "firecrawl" | "mistral_browser" | "mistral_websearch" | "serper"
            ),
            name,
            skip_reason: None,
        })
        .collect()
}
