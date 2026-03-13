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
    output::{ConfigOutput, JsonOutput, ProviderList, TextOutput},
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
fn build_config(
    skip: Option<String>,
    providers_order: Option<String>,
    max_chars: Option<usize>,
    min_chars: Option<usize>,
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

    config
}

/// Handle the resolve command
async fn handle_resolve(
    input: &str,
    output: Option<&str>,
    provider: Option<&str>,
    config: Config,
    json: bool,
) -> Result<()> {
    tracing::info!("Resolving: {}", input);

    let resolver = Resolver::with_config(config);

    let result = if let Some(p) = provider {
        let provider_type: ProviderType = p
            .parse()
            .map_err(|e| anyhow::anyhow!("Invalid provider: {}", e))?;
        resolver.resolve_direct(input, provider_type).await
    } else {
        resolver.resolve(input).await
    };

    match result {
        Ok(res) => {
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
        wdr_lib::cli::Commands::Resolve {
            input,
            output,
            provider,
            skip,
            providers_order,
            max_chars,
            min_chars,
            json,
            skip_cache: _,
        } => {
            let config = build_config(skip, providers_order, max_chars, min_chars);
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(handle_resolve(
                    &input,
                    output.as_deref(),
                    provider.as_deref(),
                    config,
                    json,
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
            // TODO: Implement when semantic cache is integrated
            TextOutput::print_info("Cache statistics not yet available");
            Ok(())
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
