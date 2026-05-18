#[derive(Debug, Clone)]
pub struct QualityScore {
    pub score: f32,
    pub too_short: bool,
    pub missing_links: bool,
    pub duplicate_heavy: bool,
    pub noisy: bool,
    pub acceptable: bool,
}

pub fn score_content(markdown: &str, links: &[String], threshold: f32) -> QualityScore {
    let trimmed = markdown.trim();
    let len = trimmed.len();

    let too_short = len < 500;
    let missing_links = links.is_empty();
    let lines: Vec<&str> = trimmed.lines().collect();
    let unique_lines = lines
        .iter()
        .copied()
        .collect::<std::collections::HashSet<_>>()
        .len();
    let duplicate_heavy = !lines.is_empty() && unique_lines < std::cmp::max(5, lines.len() / 3);
    let lower = trimmed.to_lowercase();
    let noisy_count = lower.matches("cookie").count()
        + lower.matches("subscribe").count()
        + lower.matches("javascript").count()
        + lower.matches("log in").count()
        + lower.matches("sign up").count();
    let noisy = noisy_count > 6;

    let has_frontmatter = trimmed.starts_with("---") && trimmed.contains("relevance_score:");
    let has_structural_anchors = trimmed.contains("[ANCHOR: SUMMARY]")
        && trimmed.contains("[ANCHOR: TECHNICAL_DETAILS]")
        && trimmed.contains("[ANCHOR: COMPARISON]")
        && trimmed.contains("[ANCHOR: CITATIONS]");

    let mut score = 1.0_f32;
    if too_short {
        score -= 0.25;
    }
    if missing_links {
        score -= 0.10;
    }
    if duplicate_heavy {
        score -= 0.15;
    }
    if noisy {
        score -= 0.10;
    }

    if has_frontmatter {
        score += 0.05;
    }
    if has_structural_anchors {
        score += 0.05;
    }

    let score = score.clamp(0.0, 1.0);
    let acceptable = score >= threshold && !too_short;

    QualityScore {
        score,
        too_short,
        missing_links,
        duplicate_heavy,
        noisy,
        acceptable,
    }
}
