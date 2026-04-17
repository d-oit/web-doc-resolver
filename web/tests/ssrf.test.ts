import { describe, expect, it } from "vitest";
import { validateUrl } from "../lib/validation";

describe("SSRF Validation", () => {
  it("rejects IPv6-mapped IPv4 addresses", () => {
    const urls = [
      "http://[::ffff:127.0.0.1]/test",
      "http://[::ffff:7f00:1]/test",
      "http://[::ffff:10.0.0.1]/test",
    ];
    for (const url of urls) {
      expect(validateUrl(url).valid).toBe(false);
    }
  });

  it("rejects various IPv6 private/unspecified addresses", () => {
    const urls = [
      "http://[::1]/test",
      "http://[::]/test",
      "http://[fc00::1]/test",
      "http://[fe80::1]/test",
      "http://[2001:db8::1]/test",
    ];
    for (const url of urls) {
      expect(validateUrl(url).valid).toBe(false);
    }
  });

  it("rejects CGNAT range (100.64.0.0/10)", () => {
    expect(validateUrl("http://100.64.0.1/test").valid).toBe(false);
    expect(validateUrl("http://100.127.255.255/test").valid).toBe(false);
    expect(validateUrl("http://100.128.0.1/test").valid).toBe(true);
  });

  it("accepts valid public URLs and legitimate domains", () => {
    const urls = [
      "https://google.com",
      "https://github.com",
      "http://1.1.1.1",
      "http://[2606:4700:4700::1111]",
      "https://fcc.gov",
      "https://fda.gov",
      "https://10.example.com",
      "https://127.example.com",
      "https://192.168.example.com",
      "https://169.254.example.com",
      "https://172.16.example.com",
      "https://100.64.example.com",
    ];
    for (const url of urls) {
      expect(validateUrl(url).valid).toBe(true);
    }
  });

  it("handles case insensitivity and square brackets in isPrivateIp", () => {
      // isPrivateIp is called by validateUrl
      expect(validateUrl("http://[::FFFF:127.0.0.1]").valid).toBe(false);
      expect(validateUrl("http://LOCALHOST").valid).toBe(false);
  });
});
