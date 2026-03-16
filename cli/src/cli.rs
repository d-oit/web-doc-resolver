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

        /// Minimum characters for valid content
        #[arg(long)]
        min_chars: Option<usize>,

        /// Execution profile (free, balanced, fast, quality)
        #[arg(long)]
        profile: Option<String>,

        /// Output as JSON
        #[arg(long, default_value = "false")]
        json: bool,

        /// Output metrics as JSON
        #[arg(long, default_value = "false")]
        metrics_json: bool,

        /// Save metrics to file
        #[arg(long)]
        metrics_file: Option<String>,

        /// Skip semantic cache
        #[arg(long, default_value = "false")]
        skip_cache: bool,

        /// Synthesize multiple results using AI
        #[arg(long, default_value = "false")]
        synthesize: bool,
    },

    /// List available providers
    Providers,

    /// Show configuration
    Config,

    /// Show cache statistics
    CacheStats,
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
            Commands::Resolve { input, .. } => {
                assert_eq!(input, "https://example.com");
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
            Commands::Resolve {
                input,
                provider,
                skip,
                json,
                ..
            } => {
                assert_eq!(input, "test query");
                assert_eq!(provider, Some("exa".to_string()));
                assert_eq!(skip, Some("tavily".to_string()));
                assert!(json);
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
