import { describe, it, expect } from "vitest";
import { parseProviderResults } from "../lib/results";

describe("parseProviderResults with metadata", () => {
  it("should return undefined for various placeholder authors", () => {
    const placeholders = ["N/A", "na", "unknown", "none", "-", "–", "", "  "];
    placeholders.forEach((placeholder) => {
      const markdown = `
Title: Test Result
URL: https://example.com
Author: ${placeholder}
Published: 2023-01-01

Highlights:
Test snippet
`;
      const results = parseProviderResults(markdown);
      expect(results[0].author, `Failed for placeholder: "${placeholder}"`).toBeUndefined();
    });
  });

  it("should return undefined for various placeholder published dates", () => {
    const placeholders = ["N/A", "na", "unknown", "none", "-", "–", "", "  "];
    placeholders.forEach((placeholder) => {
      const markdown = `
Title: Test Result
URL: https://example.com
Author: John Doe
Published: ${placeholder}

Highlights:
Test snippet
`;
      const results = parseProviderResults(markdown);
      expect(results[0].published, `Failed for placeholder: "${placeholder}"`).toBeUndefined();
    });
  });

  it("should return valid author and published date", () => {
    const markdown = `
Title: Test Result
URL: https://example.com
Author: John Doe
Published: 2023-01-01

Highlights:
Test snippet
`;
    const results = parseProviderResults(markdown);
    expect(results[0].author).toBe("John Doe");
    expect(results[0].published).toBe("2023-01-01");
  });
});
