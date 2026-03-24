export interface QualityScore {
  score: number;
  tooShort: boolean;
  missingLinks: boolean;
  duplicateHeavy: boolean;
  noisy: boolean;
  acceptable: boolean;
}

const NOISY_SIGNALS = ["cookie", "subscribe", "javascript", "log in", "sign up"];

export function scoreContent(markdown: string, links?: string[]): QualityScore {
  const text = (markdown ?? "").trim();
  const linkCount = links?.length ?? 0;

  const tooShort = text.length < 500;
  const missingLinks = linkCount === 0;

  const lines = text.split("\n");
  const numLines = lines.length;
  let duplicateHeavy = false;
  if (numLines > 0) {
    const uniqueLines = new Set(lines.map((l) => l.trim()).filter(Boolean)).size;
    duplicateHeavy = uniqueLines < Math.max(5, Math.floor(numLines / 2));
  }

  const lowerText = text.toLowerCase();
  const noiseCount = NOISY_SIGNALS.reduce((n, sig) => n + (lowerText.includes(sig) ? 1 : 0), 0);
  const noisy = noiseCount > 6;

  let score = 1.0;
  if (tooShort) score -= 0.35;
  if (missingLinks) score -= 0.15;
  if (duplicateHeavy) score -= 0.25;
  if (noisy) score -= 0.2;
  score = Math.max(0, score);

  const acceptable = score >= 0.65 && !tooShort;

  return { score, tooShort, missingLinks, duplicateHeavy, noisy, acceptable };
}
