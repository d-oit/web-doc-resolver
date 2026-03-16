//! CLI argument parsing module.
//!
//! Extracts CLI arguments into a separate module for better organization.

use clap::{Parser, Subcommand};

/// CLI argument parser
#[derive(Parser, Debug)]
#[command(name = "wdr")]
#[command(about = "Web Documentation Resolver - Resolve URLs and queries into documentation", long_about = None)]
#[command(version = "0.1.0")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Enable verbose logging (-v, -vv, -vvv)
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,
}

/// CLI commands
#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Resolve a URL or query to markdown documentation
    Resolve(Box<ResolveArgs>),

    /// List available providers
    Providers,

    /// Show configuration
    Config,

    /// Show cache statistics
    CacheStats,
}

#[derive(Parser, Debug, Clone)]
pub struct ResolveArgs {
    /// URL or query to resolve
    pub input: String,

    /// Output file (stdout if not specified)
    #[arg(short, long)]
    pub output: Option<String>,

    /// Provider to use (auto-detect if not specified)
    #[arg(short, long)]
    pub provider: Option<String>,

    /// Skip specific providers (comma-separated)
    #[arg(long)]
    pub skip: Option<String>,

    /// Custom provider order (comma-separated)
    #[arg(long)]
    pub providers_order: Option<String>,

    /// Maximum characters in output
    #[arg(long)]
    pub max_chars: Option<usize>,

    /// Minimum characters for valid content
    #[arg(long)]
    pub min_chars: Option<usize>,

    /// Execution profile (free, balanced, fast, quality)
    #[arg(long)]
    pub profile: Option<String>,

    /// Output as JSON
    #[arg(long, default_value = "false")]
    pub json: bool,

    /// Output metrics as JSON
    #[arg(long, default_value = "false")]
    pub metrics_json: bool,

    /// Save metrics to file
    #[arg(long)]
    pub metrics_file: Option<String>,

    /// Skip semantic cache
    #[arg(long, default_value = "false")]
    pub skip_cache: bool,

    /// Synthesize multiple results using AI
    #[arg(long, default_value = "false")]
    pub synthesize: bool,

    /// Quality threshold for content scoring
    #[arg(long)]
    pub quality_threshold: Option<f32>,

    /// Maximum provider attempts
    #[arg(long)]
    pub max_provider_attempts: Option<usize>,

    /// Maximum paid provider attempts
    #[arg(long)]
    pub max_paid_attempts: Option<usize>,

    /// Maximum total latency in milliseconds
    #[arg(long)]
    pub max_total_latency_ms: Option<u64>,

    /// Disable routing memory
    #[arg(long, default_value_t = false)]
    pub disable_routing_memory: bool,
}

impl Cli {
    /// Parse CLI arguments
    pub fn parse_args() -> Self {
        Cli::parse()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parse_resolve() {
        let cli = Cli::parse_from(&["wdr", "resolve", "https://example.com"]);
        match cli.command {
            Commands::Resolve(args) => {
                assert_eq!(args.input, "https://example.com");
            }
            _ => panic!("Expected Resolve command"),
        }
    }

    #[test]
    fn test_cli_parse_resolve_with_options() {
        let cli = Cli::parse_from(&[
            "wdr",
            "resolve",
            "test query",
            "--provider",
            "exa",
            "--skip",
            "tavily",
            "--json",
        ]);
        match cli.command {
            Commands::Resolve(args) => {
                assert_eq!(args.input, "test query");
                assert_eq!(args.provider, Some("exa".to_string()));
                assert_eq!(args.skip, Some("tavily".to_string()));
                assert!(args.json);
            }
            _ => panic!("Expected Resolve command"),
        }
    }

    #[test]
    fn test_cli_parse_providers() {
        let cli = Cli::parse_from(&["wdr", "providers"]);
        match cli.command {
            Commands::Providers => {}
            _ => panic!("Expected Providers command"),
        }
    }

    #[test]
    fn test_cli_parse_config() {
        let cli = Cli::parse_from(&["wdr", "config"]);
        match cli.command {
            Commands::Config => {}
            _ => panic!("Expected Config command"),
        }
    }

    #[test]
    fn test_cli_verbose_flag() {
        let cli = Cli::parse_from(&["wdr", "-v", "resolve", "test"]);
        assert_eq!(cli.verbose, 1);

        let cli = Cli::parse_from(&["wdr", "-vv", "resolve", "test"]);
        assert_eq!(cli.verbose, 2);
    }
}
