//! Web Documentation Resolver CLI - Main Entry Point
//!
//! This binary provides a command-line interface for resolving web URLs
//! and queries into documentation content.

use anyhow::Result;
use std::process::ExitCode;
use tracing_subscriber::{EnvFilter, fmt};

use wdr_lib::{
    cli::Cli,
    config::Config,
    output::{ConfigOutput, JsonOutput, ProviderList},
    resolver::Resolver,
    types::ProviderType,
};

/// Initialize logging based on verbosity level
fn init_logging(verbose: u8) {
    let filter = match verbose {
        0 => EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("wdr=info,wdr_lib=info")),
        1 => EnvFilter::new("wdr=debug,wdr_lib=debug"),
        _ => EnvFilter::new("wdr=trace,wdr_lib=trace"),
    };

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();
}

/// Build config from CLI args
#[allow(clippy::too_many_arguments)]
fn build_config(
    skip: Option<String>,
    providers_order: Option<String>,
    max_chars: Option<usize>,
    min_chars: Option<usize>,
    profile: Option<String>,
    quality_threshold: Option<f32>,
    max_provider_attempts: Option<usize>,
    max_paid_attempts: Option<usize>,
    max_total_latency_ms: Option<u64>,
    disable_routing_memory: bool,
) -> Config {
    let mut config = Config::load();

    if let Some(s) = skip {
        config.skip_providers = s.split(',').map(|p| p.trim().to_string()).collect();
    }

    if let Some(p) = providers_order {
        config.providers_order = p.split(',').map(|p| p.trim().to_string()).collect();
    }

    if let Some(m) = max_chars {
        config.max_chars = m;
    }

    if let Some(m) = min_chars {
        config.min_chars = m;
    }

    if let Some(p) = profile {
        if let Ok(prof) = p.parse() {
            config.profile = prof;
        }
    }

    if let Some(v) = quality_threshold {
        config.quality_threshold = Some(v);
    }
    if let Some(v) = max_provider_attempts {
        config.max_provider_attempts = Some(v);
    }
    if let Some(v) = max_paid_attempts {
        config.max_paid_attempts = Some(v);
    }
    if let Some(v) = max_total_latency_ms {
        config.max_total_latency_ms = Some(v);
    }
    if disable_routing_memory {
        config.disable_routing_memory = true;
    }

    config
}

/// Handle the resolve command
#[allow(clippy::too_many_arguments)]
async fn handle_resolve(
    input: &str,
    output: Option<&str>,
    provider: Option<&str>,
    config: Config,
    json: bool,
    metrics_json: bool,
    metrics_file: Option<String>,
    skip_cache: bool,
    synthesize: bool,
) -> Result<()> {
    tracing::info!("Resolving: {}", input);

    let mut config = config;
    if skip_cache {
        config.semantic_cache.enabled = false;
    }
    let resolver = Resolver::with_config(config);

    let result = if synthesize {
        resolver.resolve_aggregated(input).await
    } else if let Some(p) = provider {
        let provider_type: ProviderType = p
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid provider: {}", e))?;
        resolver.resolve_direct(input, provider_type).await
    } else {
        resolver.resolve(input).await
    };

    match result {
        Ok(res) => {
            if let Some(metrics) = &res.metrics {
                if metrics_json {
                    println!("{}", serde_json::to_string_pretty(metrics)?);
                }
                if let Some(path) = metrics_file {
                    std::fs::write(path, serde_json::to_string_pretty(metrics)?)?;
                }
            }

            if json {
                let json_output = JsonOutput::from_result(&res);
                if let Some(out_path) = output {
                    let json_str = serde_json::to_string_pretty(&json_output)?;
                    std::fs::write(out_path, &json_str)?;
                } else {
                    json_output.print();
                }
            } else {
                let content = res.content.unwrap_or_default();
                if let Some(out_path) = output {
                    std::fs::write(out_path, &content)?;
                } else {
                    println!("{}", content);
                }
            }
            Ok(())
        }
        Err(e) => {
            if json {
                let err_msg = e.to_string();
                let json_output = JsonOutput::error(&err_msg);
                json_output.print();
            }
            Err(anyhow::anyhow!("{}", e))
        }
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse_args();

    // Initialize logging
    init_logging(cli.verbose);

    // Run the appropriate command
    let result = match cli.command {
        wdr_lib::cli::Commands::Resolve(args) => {
            let config = build_config(
                args.skip.clone(),
                args.providers_order.clone(),
                args.max_chars,
                args.min_chars,
                args.profile.clone(),
                args.quality_threshold,
                args.max_provider_attempts,
                args.max_paid_attempts,
                args.max_total_latency_ms,
                args.disable_routing_memory,
            );
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(handle_resolve(
                    &args.input,
                    args.output.as_deref(),
                    args.provider.as_deref(),
                    config,
                    args.json,
                    args.metrics_json,
                    args.metrics_file.clone(),
                    args.skip_cache,
                    args.synthesize,
                ))
        }
        wdr_lib::cli::Commands::Providers => {
            ProviderList::print();
            Ok(())
        }
        wdr_lib::cli::Commands::Config => {
            let config = Config::load();
            ConfigOutput::print(&config);
            Ok(())
        }
        wdr_lib::cli::Commands::CacheStats => {
            let config = Config::load();
            tokio::runtime::Runtime::new().unwrap().block_on(async {
                if let Some(cache) = wdr_lib::SemanticCache::new(&config)? {
                    let stats = cache.stats().await?;
                    wdr_lib::output::CacheStatsOutput::print(&stats);
                    Ok(())
                } else {
                    eprintln!("Info: Semantic cache is disabled");
                    Ok(())
                }
            })
        }
    };

    match result {
        Ok(_) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("Error: {}", e);
            ExitCode::FAILURE
        }
    }
}
