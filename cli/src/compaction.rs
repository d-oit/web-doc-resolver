//! Content compaction and token optimization.

use std::collections::HashSet;

/// Compact content by removing boilerplate and redundant information
pub fn compact_content(content: &str, max_chars: usize) -> String {
    let mut unique_lines = HashSet::new();
    let mut compacted = Vec::new();
    let mut in_code_block = false;
    let mut current_chars = 0;

    for line in content.lines() {
        let trimmed = line.trim();

        // Handle code block markers
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            compacted.push(line.to_string());
            current_chars += line.len() + 1;
            if current_chars > max_chars {
                break;
            }
            continue;
        }

        // Preserve everything inside code blocks (including indentation)
        if in_code_block {
            compacted.push(line.to_string());
            current_chars += line.len() + 1;
            if current_chars > max_chars {
                break;
            }
            continue;
        }

        if trimmed.is_empty() {
            compacted.push("".to_string());
            current_chars += 1;
            continue;
        }

        // Basic boilerplate detection (simple heuristics)
        if is_boilerplate(trimmed) {
            continue;
        }

        // Deduplication for non-code lines
        // We still trim for the sake of the hash set, but we keep the original line if it's not a duplicate
        if !unique_lines.contains(trimmed) {
            compacted.push(line.to_string());
            unique_lines.insert(trimmed.to_string());
            current_chars += line.len() + 1;
        }

        if current_chars > max_chars {
            break;
        }
    }

    let joined = compacted.join("\n");

    // Truncate to max_chars safely (avoiding UTF-8 slicing panics)
    if joined.len() <= max_chars {
        joined
    } else {
        joined.chars().take(max_chars).collect()
    }
}

fn is_boilerplate(line: &str) -> bool {
    let lower = line.to_lowercase();
    let boilerplate_terms = [
        "cookie policy",
        "all rights reserved",
        "terms of service",
        "privacy policy",
        "subscribe to our newsletter",
        "follow us on",
        "click here",
    ];

    if boilerplate_terms.iter().any(|&term| lower.contains(term)) {
        return true;
    }

    // Protect Markdown structural elements and LaTeX markers from being treated as boilerplate
    let protected_markers = [
        "```",
        "$$",
        "---",
        "***",
        "___",
        "###",
        "|",
        ">",
        "{\\displaystyle",
        "\\textstyle",
        "\\begin{aligned}",
        "\\end{aligned}",
        "<pre",
        "<code",
    ];
    if protected_markers.iter().any(|&m| line.contains(m)) {
        return false;
    }

    // Heuristic: very short lines with only symbols are often junk,
    // UNLESS they are part of a code block (which we handle in compact_content)
    // or they are common Markdown/LaTeX markers (handled above).
    line.len() < 10 && !line.is_empty() && line.chars().all(|c| !c.is_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_block_preservation() {
        let content = "
Intro
```rust
fn main() {
    println!(\"Hello\");
}
```
Outro";
        let compacted = compact_content(content, 1000);
        assert!(compacted.contains("    println!(\"Hello\");"));
        assert!(compacted.contains("```rust"));
        assert!(compacted.contains("```"));
    }

    #[test]
    fn test_deduplication() {
        let content = "Line 1\nLine 2\nLine 1";
        let compacted = compact_content(content, 1000);
        let lines: Vec<&str> = compacted.lines().filter(|l| !l.is_empty()).collect();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "Line 1");
        assert_eq!(lines[1], "Line 2");
    }

    #[test]
    fn test_identical_lines_in_code_block() {
        let content = "```\nidentical\nidentical\n```";
        let compacted = compact_content(content, 1000);
        assert_eq!(compacted.matches("identical").count(), 2);
    }

    #[test]
    fn test_boilerplate_in_code_block() {
        let content = "```\nprivacy policy\n```";
        let compacted = compact_content(content, 1000);
        assert!(compacted.contains("privacy policy"));
    }

    #[test]
    fn test_early_termination() {
        let content = "Line 1\nLine 2\nLine 3\nLine 4";
        // "Line 1\nLine 2" is 6+1+6 = 13 chars.
        let compacted = compact_content(content, 15);
        assert!(compacted.contains("Line 1"));
        assert!(compacted.contains("Line 2"));
        assert!(!compacted.contains("Line 3"));
    }

    #[test]
    fn test_utf8_truncation_safety() {
        let content = "🦀🦀🦀🦀🦀";
        // Each 🦀 is 4 bytes, but 1 char.
        let compacted = compact_content(content, 2);
        assert_eq!(compacted.chars().count(), 2);
        assert_eq!(compacted, "🦀🦀");
    }

    #[test]
    fn test_markdown_separators() {
        let content = "Header\n***\n---\n___\nFooter";
        let compacted = compact_content(content, 1000);
        assert!(compacted.contains("***"));
        assert!(compacted.contains("---"));
        assert!(compacted.contains("___"));
    }
}
