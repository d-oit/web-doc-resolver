# Additional Improvements Plan

**Created**: 2026-03-24
**Last Updated**: 2026-03-24
**Status**: Planning
**Scope**: Performance, Security, Accessibility, Code Quality, UX, Testing

---

## Executive Summary

This plan identifies improvements beyond the UI enhancements, covering performance optimizations, security hardening, accessibility compliance, code quality, and testing gaps. All improvements maintain backward compatibility.

---

## 1. Performance Optimizations

### 1.1 Caching Improvements

**Current State**:
- Cache uses in-memory `Map<string, CacheEntry>` (line 15, `web/lib/cache.ts`)
- No persistence across server restarts
- No size limits or eviction policy

**Improvements**:

#### 1.1.1 Add LRU Eviction
**File**: `web/lib/cache.ts`

```typescript
interface CacheConfig {
  maxSize: number;          // Default: 1000
  defaultTtlMs: number;     // Default: 24h
  evictBatchSize: number;   // Default: 100
}

class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];

  constructor(private config: CacheConfig) {}

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    return entry.result;
  }

  set(key: string, result: unknown, ttlMs: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evict(this.config.evictBatchSize);
    }
    this.cache.set(key, { result, expiresAt: Date.now() + ttlMs });
    this.accessOrder.push(key);
  }

  private evict(count: number): void {
    const toRemove = this.accessOrder.slice(0, count);
    toRemove.forEach(key => this.cache.delete(key));
    this.accessOrder = this.accessOrder.slice(count);
  }
}
```

#### 1.1.2 Add Cache Warming
**File**: `web/lib/cache.ts`

```typescript
export async function warmCache(popularQueries: string[]): Promise<void> {
  // Pre-warm cache with popular queries
  for (const query of popularQueries) {
    // Fire-and-forget background refresh
    fetch('/api/resolve', {
      method: 'POST',
      body: JSON.stringify({ query, skipCache: true }),
    }).catch(() => {});
  }
}
```

### 1.2 API Route Optimization

**Current State**:
- Provider functions defined in route.ts (602 lines)
- No parallel execution optimization for mixed query/URL providers

**Improvements**:

#### 1.2.1 Extract Provider Functions
**File**: `web/lib/providers/index.ts` (new)

```typescript
export interface ProviderResult {
  content: string;
  provider: string;
  latencyMs: number;
  quality: number;
}

export interface ProviderConfig {
  name: string;
  type: 'query' | 'url';
  isFree: boolean;
  execute: (input: string, keys: ProviderKeys, maxChars: number) => Promise<string | null>;
}

export const providers: ProviderConfig[] = [
  { name: 'exa_mcp', type: 'query', isFree: true, execute: searchViaExaMcp },
  { name: 'jina', type: 'url', isFree: true, execute: extractViaJina },
  // ... etc
];
```

#### 1.2.2 Add Request Deduplication
**File**: `web/lib/request-dedup.ts` (new)

```typescript
const pendingRequests = new Map<string, Promise<unknown>>();

export async function dedupedRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn();
  pendingRequests.set(key, promise);
  
  try {
    return await promise;
  } finally {
    pendingRequests.delete(key);
  }
}
```

### 1.3 Client-Side Performance

#### 1.3.1 Add React.memo to Components
**File**: `web/app/components/History.tsx`

```typescript
export default React.memo(function History({ onLoad }: HistoryProps) {
  // Component implementation
});
```

#### 1.3.2 Optimize State Updates
**File**: `web/app/page.tsx`

```typescript
// Use useCallback for event handlers
const handleSubmit = useCallback(async (e?: React.FormEvent) => {
  // Implementation
}, [query, loading, apiKeys, activeProviders, deepResearch, maxChars, skipCache]);

// Use useMemo for derived state
const activeProviders = useMemo(() => {
  return selectedProviders.length > 0
    ? selectedProviders.filter(...)
    : profileProviders;
}, [selectedProviders, profileProviders, isQuery]);
```

---

## 2. Security Enhancements

### 2.1 Input Validation

**Current State**:
- Basic URL detection via regex (line 30-32, `route.ts`)
- No sanitization of user input

**Improvements**:

#### 2.1.1 Add Input Sanitization
**File**: `web/lib/sanitize.ts` (new)

```typescript
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  // Remove control characters
  const cleaned = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Limit length
  const truncated = cleaned.slice(0, 10000);
  
  // Sanitize HTML
  return DOMPurify.sanitize(truncated, { ALLOWED_TAGS: [] });
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http(s)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    // Block private/internal IPs
    if (isPrivateIp(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function isPrivateIp(hostname: string): boolean {
  // Check for localhost, private IPs, etc.
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc/,
    /^fd/,
    /^fe80/,
  ];
  return privateRanges.some(range => range.test(hostname));
}
```

#### 2.1.2 Add Rate Limiting
**File**: `web/lib/rate-limit.ts` (new)

```typescript
interface RateLimitConfig {
  windowMs: number;    // e.g., 60000 (1 minute)
  maxRequests: number; // e.g., 10
}

const requests = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now > record.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (record.count >= config.maxRequests) {
    return false;
  }

  record.count++;
  return true;
}
```

### 2.2 API Key Security

#### 2.2.1 Add Key Encryption
**File**: `web/lib/encryption.ts` (new)

```typescript
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

export async function encryptKey(key: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('web-resolver-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    derivedKey,
    encoder.encode(key)
  );

  return `${Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')}:${Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
```

---

## 3. Accessibility Improvements

### 3.1 ARIA Labels

**Current State**:
- Some buttons lack proper labels
- Screen reader support incomplete

**Improvements**:

#### 3.1.1 Add ARIA Labels
**File**: `web/app/page.tsx`

```typescript
// Provider buttons
<button
  aria-pressed={isManual}
  aria-label={`${provider.label} provider ${isManual ? 'selected' : available ? 'available' : 'unavailable'}`}
  // ...
>

// Clear button
<button
  aria-label="Clear input and results"
  // ...
>

// Copy button
<button
  aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
  aria-live="polite"
  // ...
>
```

#### 3.1.2 Add Focus Management
**File**: `web/app/page.tsx`

```typescript
// Focus input on mount
useEffect(() => {
  inputRef.current?.focus();
}, []);

// Focus result after submission
useEffect(() => {
  if (result && textareaRef.current) {
    textareaRef.current.focus();
  }
}, [result]);

// Ref for textarea
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

#### 3.1.3 Add Skip Links
**File**: `web/app/page.tsx`

```typescript
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### 3.2 Keyboard Navigation

#### 3.2.1 Add Keyboard Shortcuts
**File**: `web/app/page.tsx`

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl/Cmd + K: Focus input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      inputRef.current?.focus();
    }
    // Escape: Clear input
    if (e.key === 'Escape' && document.activeElement === inputRef.current) {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 4. Code Quality Improvements

### 4.1 Type Safety

**Current State**:
- Some `any` types in API responses
- Missing types for provider responses

**Improvements**:

#### 4.1.1 Add Strict Types
**File**: `web/types/providers.ts` (new)

```typescript
export interface ExaMcpResponse {
  result?: {
    content?: Array<{ type: string; text?: string }>;
  };
}

export interface SerperResponse {
  organic?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    position?: number;
  }>;
}

export interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string;
    score?: number;
  }>;
}

export interface MistralResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
```

#### 4.1.2 Add Response Validation
**File**: `web/lib/validation.ts` (new)

```typescript
import { z } from 'zod';

export const ResolveRequestSchema = z.object({
  query: z.string().optional(),
  url: z.string().url().optional(),
  maxChars: z.number().min(100).max(50000).optional(),
  profile: z.enum(['free', 'fast', 'balanced', 'quality']).optional(),
  providers: z.array(z.string()).optional(),
  deepResearch: z.boolean().optional(),
  skipCache: z.boolean().optional(),
}).refine(data => data.query || data.url, {
  message: 'Either query or url is required',
});

export const HistoryEntrySchema = z.object({
  id: z.string().uuid(),
  query: z.string(),
  url: z.string().url().nullable(),
  result: z.string(),
  provider: z.string(),
  timestamp: z.number(),
  charCount: z.number(),
  resolveTime: z.number(),
});
```

### 4.2 Error Handling

#### 4.2.1 Add Error Boundaries
**File**: `web/app/components/ErrorBoundary.tsx` (new)

```typescript
'use client';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border-2 border-[#ff4444]">
          <p className="text-[13px] text-[#ff4444]">Something went wrong</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-[11px] text-[#888] hover:text-[#00ff41]"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### 4.2.2 Add Structured Logging
**File**: `web/lib/logger.ts` (new)

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }

  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }
}

export const logger = new Logger();
```

---

## 5. UX Improvements

### 5.1 Loading States

**Current State**:
- Basic loading text "..."
- No progress indication

**Improvements**:

#### 5.1.1 Add Progress Indicators
**File**: `web/app/components/ProgressIndicator.tsx` (new)

```typescript
'use client';

interface Props {
  provider?: string;
  attempt?: number;
  maxAttempts?: number;
}

export default function ProgressIndicator({ provider, attempt, maxAttempts }: Props) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#00ff41] animate-pulse">
      <div className="flex gap-1">
        {[...Array(maxAttempts || 3)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < (attempt || 0) ? 'bg-[#00ff41]' : 'bg-[#333]'
            }`}
          />
        ))}
      </div>
      {provider && <span>Trying {provider}...</span>}
    </div>
  );
}
```

#### 5.1.2 Add Skeleton Loading
**File**: `web/app/components/SkeletonLoader.tsx` (new)

```typescript
export default function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-2 p-4">
      <div className="h-4 bg-[#222] rounded w-1/4" />
      <div className="h-4 bg-[#222] rounded w-3/4" />
      <div className="h-4 bg-[#222] rounded w-1/2" />
    </div>
  );
}
```

### 5.2 Toast Notifications

#### 5.2.1 Add Toast System
**File**: `web/app/components/Toast.tsx` (new)

```typescript
'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-2 text-[12px] ${
              toast.type === 'success' ? 'bg-[#00ff41] text-[#0c0c0c]' :
              toast.type === 'error' ? 'bg-[#ff4444] text-white' :
              'bg-[#333] text-[#e8e6e3]'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

### 5.3 Keyboard Shortcuts Help

#### 5.3.1 Add Shortcuts Modal
**File**: `web/app/components/ShortcutsModal.tsx` (new)

```typescript
'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: 'Ctrl/Cmd + K', action: 'Focus input' },
  { key: 'Escape', action: 'Clear input' },
  { key: 'Enter', action: 'Submit query' },
  { key: 'Ctrl/Cmd + C', action: 'Copy result' },
];

export default function ShortcutsModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-[#0c0c0c] border-2 border-[#333] p-6 max-w-md w-full">
        <div className="flex justify-between mb-4">
          <h2 className="text-[13px] font-bold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-[#666] hover:text-[#e8e6e3]">×</button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="flex justify-between text-[11px]">
              <span className="text-[#888]">{action}</span>
              <kbd className="bg-[#222] px-2 py-1">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Testing Improvements

### 6.1 Unit Test Coverage

**Current State**:
- Basic route tests (237 lines)
- No provider tests
- No integration tests

**Improvements**:

#### 6.1.1 Add Provider Tests
**File**: `web/tests/unit/providers.test.ts` (new)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchViaExaMcp, extractViaJina, searchViaDuckDuckGoLite } from '@/lib/providers';

describe('Provider Functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe('searchViaExaMcp', () => {
    it('returns content on success', async () => {
      const mockResponse = new Response('data: {"result":{"content":[{"text":"test content"}]}}');
      vi.mocked(fetch).mockResolvedValue(mockResponse);

      const result = await searchViaExaMcp('test query', 8000);
      expect(result).toBe('test content');
    });

    it('returns null on failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const result = await searchViaExaMcp('test query', 8000);
      expect(result).toBeNull();
    });
  });
});
```

#### 6.1.2 Add Integration Tests
**File**: `web/tests/integration/resolve.test.ts` (new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { POST } from '@/app/api/resolve/route';

describe('Resolve API Integration', () => {
  it('resolves a URL successfully', async () => {
    const request = new Request('http://localhost/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('markdown');
  });
});
```

### 6.2 E2E Test Improvements

#### 6.2.1 Add History Tests
**File**: `web/tests/e2e/history.spec.ts` (new)

```typescript
import { test, expect } from '@playwright/test';

test.describe('History Feature', () => {
  test('can save and load history entry', async ({ page }) => {
    await page.goto('/');
    
    // Perform a query
    await page.locator('input[placeholder*="URL"]').fill('test query');
    await page.getByRole('button', { name: 'Fetch' }).click();
    await page.waitForSelector('textarea');

    // Open history
    await page.locator('text=History').click();
    await expect(page.locator('text=test query')).toBeVisible();

    // Load entry
    await page.locator('button').filter({ hasText: 'test query' }).click();
    await expect(page.locator('input[placeholder*="URL"]')).toHaveValue('test query');
  });

  test('can delete history entry', async ({ page }) => {
    // ... similar structure
  });
});
```

---

## 7. Monitoring & Analytics

### 7.1 Add Performance Monitoring

**File**: `web/lib/monitoring.ts` (new)

```typescript
import { Analytics } from '@vercel/analytics';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  startMeasurement(name: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.metrics.push({
        name,
        value: duration,
        timestamp: Date.now(),
      });
    };
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverage(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
  }
}

export const perfMonitor = new PerformanceMonitor();
```

---

## 8. Documentation Improvements

### 8.1 Add API Documentation

**File**: `web/docs/API.md` (new)

```markdown
# API Documentation

## Resolve Endpoint

### POST /api/resolve

Resolves a URL or query to markdown content.

**Request Body:**
```json
{
  "query": "string",          // Search query
  "url": "string",           // URL to resolve
  "maxChars": 8000,          // Max characters to return
  "profile": "balanced",     // Provider profile
  "providers": ["jina"],     // Custom provider order
  "deepResearch": false,     // Use parallel providers
  "skipCache": false         // Skip cache lookup
}
```

**Response:**
```json
{
  "markdown": "# Content",
  "provider": "jina",
  "quality": { "score": 0.85, "acceptable": true },
  "budget": { "attempts": 1, "elapsedMs": 1200 },
  "cache_hit": false
}
```
```

---

## Implementation Priority

### Phase 1 (High Priority)
1. Input validation and sanitization
2. Rate limiting
3. Error boundaries
4. Structured logging

### Phase 2 (Medium Priority)
1. Cache LRU eviction
2. Accessibility improvements (ARIA labels)
3. Toast notifications
4. Provider function extraction

### Phase 3 (Low Priority)
1. Request deduplication
2. Cache warming
3. Performance monitoring
4. API documentation

---

## File Changes Summary

### New Files
- `web/lib/sanitize.ts` - Input validation
- `web/lib/rate-limit.ts` - Rate limiting
- `web/lib/encryption.ts` - Key encryption
- `web/lib/validation.ts` - Zod schemas
- `web/lib/logger.ts` - Structured logging
- `web/lib/monitoring.ts` - Performance monitoring
- `web/lib/request-dedup.ts` - Request deduplication
- `web/lib/providers/index.ts` - Provider extraction
- `web/types/providers.ts` - Type definitions
- `web/app/components/ErrorBoundary.tsx`
- `web/app/components/ProgressIndicator.tsx`
- `web/app/components/SkeletonLoader.tsx`
- `web/app/components/Toast.tsx`
- `web/app/components/ShortcutsModal.tsx`
- `web/tests/unit/providers.test.ts`
- `web/tests/integration/resolve.test.ts`
- `web/tests/e2e/history.spec.ts`
- `web/docs/API.md`

### Modified Files
- `web/lib/cache.ts` - Add LRU eviction
- `web/app/page.tsx` - ARIA labels, keyboard shortcuts, memoization
- `web/app/components/History.tsx` - React.memo
- `web/app/api/resolve/route.ts` - Validation, logging
- `web/app/api/ui-state/route.ts` - Rate limiting
- `web/app/api/history/route.ts` - Validation

---

## Dependencies to Add

```json
{
  "dependencies": {
    "isomorphic-dompurify": "^2.0.0",
    "zod": "^3.22.0"
  }
}
```

---

## Acceptance Criteria

- [ ] All inputs validated and sanitized
- [ ] Rate limiting prevents abuse
- [ ] Error boundaries catch React errors
- [ ] Structured logging for debugging
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation fully supported
- [ ] Cache eviction prevents memory leaks
- [ ] Toast notifications for user feedback
- [ ] Unit test coverage >80%
- [ ] E2E tests for all new features
