//! Web Documentation Resolver CLI - Main Entry Point
//!
//! This binary provides a command-line interface for resolving web URLs
//! and queries into documentation content.

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::process::ExitCode;
use tracing_subscriber::{EnvFilter, fmt};

mod config;
mod error;
mod providers;
mod resolver;
mod types;

use config::Config;
use resolver::Resolver;
use types::ProviderType;

/// CLI argument parser
#[derive(Parser, Debug)]
#[command(name = "wdr")]
#[command(about = "Web Documentation Resolver - Resolve URLs and queries into documentation", long_about = None)]
#[command(version = "0.1.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose logging
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,
}

/// CLI commands
#[derive(Subcommand, Debug)]
enum Commands {
    /// Resolve a URL or query to markdown documentation
    Resolve {
        /// URL or query to resolve
        input: String,

        /// Output file (stdout if not specified)
        #[arg(short, long)]
        output: Option<String>,

        /// Provider to use (auto-detect if not specified)
        #[arg(short, long)]
        provider: Option<String>,

        /// Skip specific providers (comma-separated)
        #[arg(long)]
        skip: Option<String>,

        /// Custom provider order (comma-separated)
        #[arg(long)]
        providers_order: Option<String>,

        /// Maximum characters in output
        #[arg(long)]
        max_chars: Option<usize>,

        /// Output as JSON
        #[arg(long, default_value = "false")]
        json: bool,
    },

    /// List available providers
    Providers,

    /// Show configuration
    Config,
}

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
                let json_output = serde_json::to_string_pretty(&res)?;
                if let Some(out_path) = output {
                    std::fs::write(out_path, &json_output)?;
                } else {
                    println!("{}", json_output);
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
                let json_output = serde_json::json!({ "error": e.to_string() });
                println!("{}", serde_json::to_string_pretty(&json_output)?);
            }
            Err(anyhow::anyhow!("{}", e))
        }
    }
}

/// Handle the providers command
fn handle_providers() {
    println!("Available providers:");
    println!();
    println!("Query providers:");
    println!("  - exa_mcp: Exa MCP (free, no API key required)");
    println!("  - exa: Exa SDK (requires EXA_API_KEY)");
    println!("  - tavily: Tavily search (requires TAVILY_API_KEY)");
    println!("  - duckduckgo: DuckDuckGo (free, no API key required)");
    println!("  - mistral_websearch: Mistral web search (requires MISTRAL_API_KEY)");
    println!();
    println!("URL providers:");
    println!("  - llms_txt: Check for llms.txt (free)");
    println!("  - jina: Jina Reader (free)");
    println!("  - firecrawl: Firecrawl extraction (requires FIRECRAWL_API_KEY)");
    println!("  - direct_fetch: Direct HTTP fetch (free)");
    println!("  - mistral_browser: Mistral browser (requires MISTRAL_API_KEY)");
}

/// Handle the config command
fn handle_config() {
    let config = Config::load();
    println!("Current configuration:");
    println!("  max_chars: {}", config.max_chars);
    println!("  min_chars: {}", config.min_chars);
    println!("  exa_results: {}", config.exa_results);
    println!("  tavily_results: {}", config.tavily_results);
    println!("  output_limit: {}", config.output_limit);
    println!("  log_level: {}", config.log_level);
    println!("  skip_providers: {:?}", config.skip_providers);
    println!("  providers_order: {:?}", config.providers_order);
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    // Initialize logging
    init_logging(cli.verbose);

    // Run the appropriate command
    let result = match cli.command {
        Commands::Resolve {
            input,
            output,
            provider,
            skip,
            providers_order,
            max_chars,
            json,
        } => {
            let config = build_config(skip, providers_order, max_chars);
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
        Commands::Providers => {
            handle_providers();
            Ok(())
        }
        Commands::Config => {
            handle_config();
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
