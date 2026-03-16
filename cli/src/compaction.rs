//! Content compaction and token optimization.

use std::collections::HashSet;

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

    boilerplate_terms.iter().any(|&term| lower.contains(term)) || (line.len() < 10 && line.chars().all(|c| !c.is_alphanumeric()))
}
