# Exa MCP Analysis

## Executive Summary

**Exa MCP does NOT require an LLM API for basic operation.** The confusion likely stems from the existence of two modes:

1. **Basic Exa MCP** (`exa_mcp`) - Completely free, no API key required
2. **Enhanced Exa MCP with Mistral** (`exa_mcp_mistral`) - Uses Mistral LLM to synthesize results

## Current Implementation

### Basic Exa MCP (Free, No LLM Required)

**File:** `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts` (lines 256-300)

```typescript
async function searchViaExaMcp(query: string, maxChars: number): Promise<string | null> {
  const mcpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query,
        numResults: 8,
      },
    },
  };
  const res = await fetchWithTimeout("https://mcp.exa.ai/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mcpRequest),
  });
  // ... parses streaming response with "data: " lines
}
```

**Key characteristics:**
- Endpoint: `https://mcp.exa.ai/mcp`
- Protocol: JSON-RPC 2.0 over HTTP
- Method: `tools/call` with `web_search_exa` tool
- **No authentication required**
- Returns search results with highlighted content
- Rate limited (unknown limits)

### Enhanced Exa MCP with Mistral (Requires LLM API)

**File:** `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts` (lines 333-372)

```typescript
async function searchViaExaMcpWithMistral(query: string, apiKey: string, maxChars: number): Promise<string | null> {
  // 1. Fetch results from Exa MCP (free)
  const exaContext = await searchViaExaMcp(query, Math.min(maxChars * 2, 16000));

  // 2. Use Mistral LLM to synthesize the results (paid)
  const res = await fetchWithTimeout(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are a documentation research assistant..." },
          { role: "user", content: `User query: ${query}\n\nExa MCP context:\n${exaContext}` },
        ],
        max_tokens: 4000,
      }),
    },
    25000
  );
}
```

**This mode:**
- First fetches raw results from Exa MCP (free)
- Then passes results to Mistral LLM for synthesis
- Requires `MISTRAL_API_KEY`
- Activated automatically when both Exa MCP and Mistral Web Search are selected

## Provider Definitions

**File:** `/home/doit/projects/web-doc-resolver/web/lib/providers.ts`

```typescript
{
  id: "exa_mcp",
  label: "Exa MCP",
  description: "Free neural search via Model Context Protocol",
  type: "query",
  free: true,
  alwaysActive: false,
}
```

The `free: true` flag indicates this provider requires no API key.

## Cascade Flow

**File:** `/home/doit/projects/web-doc-resolver/web/lib/routing.ts`

```typescript
const QUERY_CASCADE = ["exa_mcp", "exa", "tavily", "serper", "mistral_websearch", "duckduckgo"];
```

When no API keys are configured:
1. Exa MCP is tried first (free)
2. Falls back to DuckDuckGo (free)

When `MISTRAL_API_KEY` is present:
- Exa MCP can be upgraded to `exa_mcp_mistral` for enhanced synthesis
- DuckDuckGo is deprioritized (line 91-96 in routing.ts)

## Answer to User's Question

### Does Exa MCP Need an LLM API?

**No, basic Exa MCP does NOT need an LLM API.** It works completely free with:
- No API key required
- Direct JSON-RPC calls to `https://mcp.exa.ai/mcp`
- Returns structured search results

### Why the Confusion?

The `exa_mcp_mistral` mode (which combines Exa MCP + Mistral) DOES require an LLM API. This mode:
- Uses Exa MCP for search (free)
- Uses Mistral for result synthesis (paid)
- Is automatically activated when Mistral key is present

### Free LLM Options (If Synthesis Is Desired)

If you want the enhanced synthesis mode without paying for Mistral, these free options exist:

| Provider | Free Tier | API Endpoint | Notes |
|----------|-----------|--------------|-------|
| **OpenRouter** | Some free models | `https://openrouter.ai/api/v1/chat/completions` | Supports many models, some free |
| **Groq** | Free tier available | `https://api.groq.com/openai/v1/chat/completions` | Fast inference, free tier |
| **Together AI** | Free credits | `https://api.together.xyz/v1/chat/completions` | Open source models |
| **Google AI Studio** | Free tier | `https://generativelanguage.googleapis.com/v1beta/models/` | Gemini models |

### Code Changes Needed for Free LLM Support

To support free LLM APIs for synthesis, you would need to:

1. **Add new environment variables:**
   ```typescript
   interface ProviderKeys {
     // Existing
     MISTRAL_API_KEY?: string;
     // New options
     OPENROUTER_API_KEY?: string;
     GROQ_API_KEY?: string;
     TOGETHER_API_KEY?: string;
     GOOGLE_AI_KEY?: string;
   }
   ```

2. **Create a generic LLM synthesis function:**
   ```typescript
   async function synthesizeWithLLM(
     query: string,
     context: string,
     provider: string,
     apiKey: string
   ): Promise<string | null> {
     const endpoints: Record<string, { url: string; model: string }> = {
       mistral: { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
       openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3-8b-instruct:free" },
       groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama3-8b-8192" },
       together: { url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3-8b-chat-hf" },
     };
     // ... make request
   }
   ```

3. **Update routing logic** to select available LLM for synthesis

## Conclusion

**No changes are required for basic Exa MCP to work.** It is completely free and requires no LLM API. The LLM is only needed if you want the enhanced synthesis mode (`exa_mcp_mistral`), which provides higher-quality, AI-synthesized results.

### Recommended Approach

1. **For free users:** Exa MCP works as-is without any API keys
2. **For enhanced quality:** Add support for free LLM providers (OpenRouter, Groq) as synthesis backends
3. **The current implementation correctly marks Exa MCP as `free: true`** in the provider definitions

## Files Analyzed

- `/home/doit/projects/web-doc-resolver/web/app/api/resolve/route.ts` - Main API route with Exa MCP implementation
- `/home/doit/projects/web-doc-resolver/web/lib/providers.ts` - Provider definitions
- `/home/doit/projects/web-doc-resolver/web/lib/routing.ts` - Cascade ordering and budget logic
- `/home/doit/projects/web-doc-resolver/cli/src/providers/exa_mcp.rs` - Rust CLI implementation
- `/home/doit/projects/web-doc-resolver/cli/src/synthesis.rs` - Rust synthesis module (uses Mistral)
- `/home/doit/projects/web-doc-resolver/scripts/resolve.py` - Python resolver
- `/home/doit/projects/web-doc-resolver/scripts/synthesis.py` - Python synthesis module
- `/home/doit/projects/web-doc-resolver/.agents/skills/do-web-doc-resolver/references/PROVIDERS.md` - Provider documentation
- `/home/doit/projects/web-doc-resolver/.agents/skills/do-web-doc-resolver/references/CASCADE.md` - Cascade flow documentation