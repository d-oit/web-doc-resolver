//! Content compaction and token optimization.

use std::collections::HashSet;
use std::sync::OnceLock;

use regex::RegexSet;

static BOILERPLATE_SET: OnceLock<RegexSet> = OnceLock::new();
static PROTECTED_SET: OnceLock<RegexSet> = OnceLock::new();

/// Compact content by removing boilerplate and redundant information
pub fn compact_content(content: &str, max_chars: usize) -> String {
    let lines = content.lines();
    let mut unique_lines = HashSet::new();
    let mut compacted = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            compacted.push("");
            continue;
        }

        // Basic boilerplate detection (simple heuristics)
        if is_boilerplate(trimmed) {
            continue;
        }

        // Deduplication
        if !unique_lines.contains(trimmed) {
            compacted.push(trimmed);
            unique_lines.insert(trimmed);
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
    let boilerplate_set = BOILERPLATE_SET.get_or_init(|| {
        RegexSet::new([
            "(?i)cookie policy",
            "(?i)all rights reserved",
            "(?i)terms of service",
            "(?i)privacy policy",
            "(?i)subscribe to our newsletter",
            "(?i)follow us on",
            "(?i)click here",
        ])
        .expect("Invalid boilerplate regex patterns")
    });

    if boilerplate_set.is_match(line) {
        return true;
    }

    // Protect Markdown structural elements and LaTeX markers from being treated as boilerplate
    let protected_set = PROTECTED_SET.get_or_init(|| {
        RegexSet::new([
            r"```",
            r"\$\$",
            r"---",
            r"###",
            r"\|",
            r">",
            r"\{\\displaystyle",
            r"\\textstyle",
            r"\\begin\{aligned\}",
            r"\\end\{aligned\}",
            r"<pre",
            r"<code",
        ])
        .expect("Invalid protected marker regex patterns")
    });

    if protected_set.is_match(line) {
        return false;
    }

    line.len() < 10 && !line.is_empty() && line.chars().all(|c| !c.is_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_boilerplate() {
        assert!(is_boilerplate("Cookie Policy"));
        assert!(is_boilerplate("all rights reserved"));
        assert!(is_boilerplate("!!!"));
        assert!(!is_boilerplate("This is normal content"));
        assert!(!is_boilerplate("```rust"));
        assert!(!is_boilerplate("$$ E=mc^2 $$"));
        assert!(!is_boilerplate("### Heading"));
    }

    #[test]
    fn test_compact_content() {
        let input = "Line 1\n\nLine 1\nCookie Policy\nLine 2";
        let compacted = compact_content(input, 100);
        assert_eq!(compacted, "Line 1\n\nLine 2");
    }
}
