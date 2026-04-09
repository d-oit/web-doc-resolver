# UI/UX Improvements Plan

## Overview

This plan implements 10 UI/UX improvements across Web UI, CLI, and design system integration to enhance user experience, accessibility, and visual consistency.

---

## Phase 1: Critical Improvements (Week 1)

### Improvement 1: Cascade Progress Stepper

**Description:** Visual stepper showing real-time provider cascade progress during resolution.

**Current Issue:** Users see only "Fetching..." with no provider visibility during 2-10s operations.

**Implementation:**

```typescript
// web/app/components/ResolveStepper.tsx

import React from 'react';
import { Check, Loader2, X, Clock } from 'lucide-react';

interface Step {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  latency?: number;
}

interface ResolveStepperProps {
  steps: Step[];
  currentProvider?: string;
}

export function ResolveStepper({ steps, currentProvider }: ResolveStepperProps) {
  return (
    <div className="stepper-container">
      <div className="stepper">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`step ${step.status}`}
          >
            <div className="step-icon">
              {step.status === 'pending' && <Clock size={16} />}
              {step.status === 'running' && <Loader2 size={16} className="animate-spin" />}
              {step.status === 'complete' && <Check size={16} />}
              {step.status === 'failed' && <X size={16} />}
              {step.status === 'skipped' && <span className="skipped-icon">−</span>}
            </div>
            <div className="step-content">
              <span className="step-name">{step.name}</span>
              {step.latency && step.status === 'complete' && (
                <span className="step-latency">{step.latency}ms</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`step-connector ${step.status === 'complete' ? 'active' : ''}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

```css
/* web/app/components/ResolveStepper.css */

.stepper-container {
  background: var(--do-wdr-color-bg-secondary);
  border-radius: var(--do-wdr-radius-lg);
  padding: var(--do-wdr-space-4);
  margin-bottom: var(--do-wdr-space-4);
}

.stepper {
  display: flex;
  flex-direction: column;
  gap: var(--do-wdr-space-2);
}

.step {
  display: flex;
  align-items: center;
  gap: var(--do-wdr-space-3);
  padding: var(--do-wdr-space-2);
  border-radius: var(--do-wdr-radius-md);
  transition: background-color 0.2s ease;
}

.step:hover {
  background-color: var(--do-wdr-color-bg-tertiary);
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
}

.step.pending .step-icon {
  background: var(--do-wdr-color-bg-tertiary);
  color: var(--do-wdr-color-text-tertiary);
}

.step.running .step-icon {
  background: var(--do-wdr-color-info);
  color: var(--do-wdr-color-info-contrast);
}

.step.complete .step-icon {
  background: var(--do-wdr-color-success);
  color: var(--do-wdr-color-success-contrast);
}

.step.failed .step-icon {
  background: var(--do-wdr-color-error);
  color: var(--do-wdr-color-error-contrast);
}

.step-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-name {
  font-size: var(--do-wdr-font-size-sm);
  color: var(--do-wdr-color-text-primary);
}

.step-latency {
  font-size: var(--do-wdr-font-size-xs);
  color: var(--do-wdr-color-text-tertiary);
  font-family: var(--do-wdr-font-mono);
}

.step-connector {
  width: 2px;
  height: 16px;
  background: var(--do-wdr-color-border);
  margin-left: 11px;
  margin-top: -8px;
  margin-bottom: -8px;
}

.step-connector.active {
  background: var(--do-wdr-color-success);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .step-icon .animate-spin {
    animation: none;
  }
  
  .step {
    transition: none;
  }
}

/* High contrast support */
@media (forced-colors: active) {
  .step-icon {
    border: 2px solid currentColor;
  }
}
```

**Integration:**
```typescript
// web/app/page.tsx

import { ResolveStepper } from './components/ResolveStepper';

// In the resolve function:
const providerSteps = [
  { id: 'cache', name: 'Cache Check', status: 'complete', latency: 5 },
  { id: 'llms_txt', name: 'llms.txt Probe', status: 'failed' },
  { id: 'jina', name: 'Jina Reader', status: 'running' },
  { id: 'firecrawl', name: 'Firecrawl', status: 'pending' },
  // ...
];

// Render during resolution
<ResolveStepper steps={providerSteps} currentProvider="jina" />
```

---

### Improvement 2: Streaming Response UI

**Description:** Real-time content display using Server-Sent Events (SSE).

**Implementation:**

```typescript
// web/app/components/StreamingResult.tsx

import { useEffect, useState } from 'react';
import { StreamIndicator } from './StreamIndicator';

interface StreamingResultProps {
  input: string;
}

export function StreamingResult({ input }: StreamingResultProps) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [providerStatus, setProviderStatus] = useState<string>('');
  
  useEffect(() => {
    const eventSource = new EventSource('/api/resolve/stream', {
      body: JSON.stringify({ input })
    });
    
    eventSource.addEventListener('provider_start', (e) => {
      const data = JSON.parse(e.data);
      setProviderStatus(`Trying ${data.provider}...`);
    });
    
    eventSource.addEventListener('result', (e) => {
      const data = JSON.parse(e.data);
      setContent(prev => prev + data.content);
      setIsStreaming(true);
    });
    
    eventSource.addEventListener('complete', (e) => {
      setIsStreaming(false);
      eventSource.close();
    });
    
    eventSource.addEventListener('error', (e) => {
      setIsStreaming(false);
      eventSource.close();
    });
    
    return () => eventSource.close();
  }, [input]);
  
  return (
    <div className="streaming-result">
      {isStreaming && <StreamIndicator provider={providerStatus} />}
      <div className="content markdown-body">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
```

```typescript
// web/app/components/StreamIndicator.tsx

import { Loader2, Zap } from 'lucide-react';

interface StreamIndicatorProps {
  provider: string;
}

export function StreamIndicator({ provider }: StreamIndicatorProps) {
  return (
    <div className="stream-indicator" role="status" aria-live="polite">
      <div className="stream-indicator-icon">
        <Loader2 className="animate-spin" size={16} />
      </div>
      <div className="stream-indicator-content">
        <span className="stream-indicator-text">{provider}</span>
        <span className="stream-indicator-pulse">
          <Zap size={12} />
          Streaming...
        </span>
      </div>
    </div>
  );
}
```

---

### Improvement 3: Syntax Highlighting for Code Blocks

**Description:** Syntax highlighting for code blocks in markdown output.

**Implementation:**

```typescript
// web/app/components/CodeBlock.tsx

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const highlighted = Prism.highlight(
    code,
    Prism.languages[language] || Prism.languages.text,
    language
  );
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <button 
          className="code-block-copy"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className={`language-${language}`}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
```

```css
/* web/app/components/CodeBlock.css */

.code-block {
  background: var(--do-wdr-codeblock-bg);
  border-radius: var(--do-wdr-radius-md);
  margin: var(--do-wdr-space-4) 0;
  overflow: hidden;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--do-wdr-space-2) var(--do-wdr-space-3);
  background: var(--do-wdr-codeblock-header-bg);
  border-bottom: 1px solid var(--do-wdr-color-border);
}

.code-block-language {
  font-size: var(--do-wdr-font-size-xs);
  color: var(--do-wdr-color-text-tertiary);
  text-transform: uppercase;
  font-family: var(--do-wdr-font-mono);
}

.code-block-copy {
  display: flex;
  align-items: center;
  gap: var(--do-wdr-space-1);
  padding: var(--do-wdr-space-1) var(--do-wdr-space-2);
  font-size: var(--do-wdr-font-size-xs);
  color: var(--do-wdr-color-text-secondary);
  background: transparent;
  border: 1px solid var(--do-wdr-color-border);
  border-radius: var(--do-wdr-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.code-block-copy:hover {
  background: var(--do-wdr-color-bg-tertiary);
  border-color: var(--do-wdr-color-border-hover);
}

.code-block pre {
  margin: 0;
  padding: var(--do-wdr-space-3);
  overflow-x: auto;
  font-family: var(--do-wdr-font-mono);
  font-size: var(--do-wdr-font-size-sm);
  line-height: 1.5;
}

.code-block code {
  color: var(--do-wdr-codeblock-text-color);
}

/* Syntax highlighting tokens */
.token-keyword { color: var(--do-wdr-codeblock-keyword); }
.token-string { color: var(--do-wdr-codeblock-string); }
.token-comment { color: var(--do-wdr-codeblock-comment); }
.token-function { color: var(--do-wdr-codeblock-function); }
.token-number { color: var(--do-wdr-codeblock-number); }
```

---

### Improvement 4: Error Recovery & Form Validation

**Description:** Comprehensive error handling with actionable recovery options.

**Implementation:**

```typescript
// web/app/components/ErrorDisplay.tsx

import { AlertCircle, RefreshCw, Settings, HelpCircle } from 'lucide-react';

interface ErrorAction {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  variant: 'primary' | 'secondary';
}

interface ErrorDisplayProps {
  error: string;
  type: 'network' | 'rate_limit' | 'provider_failure' | 'validation' | 'unknown';
  onRetry?: () => void;
  onSkipProvider?: () => void;
  onHelp?: () => void;
}

export function ErrorDisplay({ 
  error, 
  type, 
  onRetry, 
  onSkipProvider, 
  onHelp 
}: ErrorDisplayProps) {
  const getErrorDetails = () => {
    switch (type) {
      case 'network':
        return {
          title: 'Network Error',
          description: 'Unable to reach the resolution service. Please check your connection.',
          actions: [
            { label: 'Retry', icon: <RefreshCw size={16} />, action: onRetry, variant: 'primary' }
          ]
        };
      case 'rate_limit':
        return {
          title: 'Rate Limited',
          description: 'Too many requests. Please wait a moment before trying again.',
          actions: [
            { label: 'Retry with Different Provider', icon: <RefreshCw size={16} />, action: onSkipProvider, variant: 'primary' },
            { label: 'View Rate Limits', icon: <HelpCircle size={16} />, action: onHelp, variant: 'secondary' }
          ]
        };
      case 'provider_failure':
        return {
          title: 'Provider Failed',
          description: 'The selected provider is currently unavailable.',
          actions: [
            { label: 'Try Alternative Provider', icon: <RefreshCw size={16} />, action: onSkipProvider, variant: 'primary' },
            { label: 'Check Provider Status', icon: <Settings size={16} />, action: onHelp, variant: 'secondary' }
          ]
        };
      default:
        return {
          title: 'Resolution Failed',
          description: error,
          actions: [
            { label: 'Retry', icon: <RefreshCw size={16} />, action: onRetry, variant: 'primary' }
          ]
        };
    }
  };
  
  const details = getErrorDetails();
  
  return (
    <div className="error-display" role="alert">
      <div className="error-icon">
        <AlertCircle size={24} />
      </div>
      <div className="error-content">
        <h3 className="error-title">{details.title}</h3>
        <p className="error-description">{details.description}</p>
        <div className="error-actions">
          {details.actions.map((action, index) => (
            <button
              key={index}
              className={`error-action ${action.variant}`}
              onClick={action.action}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 2: Accessibility & Mobile (Week 2)

### Improvement 5: Keyboard Navigation for Provider Selection

**Description:** Full keyboard navigation for provider grid using roving tabindex pattern.

```typescript
// web/app/hooks/useRovingTabindex.ts

import { useState, useCallback, useRef } from 'react';

export function useRovingTabindex(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(itemCount - 1);
        break;
    }
  }, [itemCount]);
  
  const getItemProps = useCallback((index: number) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    onKeyDown: handleKeyDown,
    onFocus: () => setActiveIndex(index),
    role: 'button',
    'aria-pressed': false,
  }), [activeIndex, handleKeyDown]);
  
  return {
    containerRef,
    activeIndex,
    getItemProps,
  };
}
```

---

### Improvement 6: Mobile-Optimized History View

**Description:** Touch-friendly history with swipe actions and card layout.

```typescript
// web/app/components/MobileHistoryCard.tsx

import { useState } from 'react';
import { Trash2, ExternalLink } from 'lucide-react';

interface HistoryCardProps {
  entry: {
    id: string;
    input: string;
    timestamp: string;
    provider: string;
  };
  onDelete: () => void;
  onSelect: () => void;
}

export function MobileHistoryCard({ entry, onDelete, onSelect }: HistoryCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    // Touch start logic
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    // Swipe logic
  };
  
  const handleTouchEnd = () => {
    if (swipeOffset > 100) {
      onDelete();
    }
    setSwipeOffset(0);
  };
  
  return (
    <div 
      className="mobile-history-card"
      style={{ transform: `translateX(${swipeOffset}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onSelect}
    >
      <div className="card-content">
        <h4 className="card-title">{entry.input}</h4>
        <div className="card-meta">
          <span className="card-provider">{entry.provider}</span>
          <span className="card-time">
            {new Date(entry.timestamp).toLocaleDateString()}
          </span>
        </div>
      </div>
      <button 
        className="card-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete entry"
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
}
```

---

## Phase 3: Polish & Power User Features (Week 3)

### Improvement 7: CLI Colors & Progress Bars

**Description:** Colored CLI output with progress indicators.

**Implementation:**

```rust
// cli/src/output/colored.rs

use colored::*;
use indicatif::{ProgressBar, ProgressStyle};

pub struct ColoredOutput;

impl ColoredOutput {
    pub fn success(msg: &str) {
        println!("{}", msg.green());
    }
    
    pub fn error(msg: &str) {
        eprintln!("{} {}", "Error:".red().bold(), msg);
    }
    
    pub fn info(msg: &str) {
        println!("{} {}", "Info:".blue(), msg);
    }
    
    pub fn warning(msg: &str) {
        println!("{} {}", "Warning:".yellow(), msg);
    }
    
    pub fn create_progress_bar(total: u64) -> ProgressBar {
        let pb = ProgressBar::new(total);
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("#>-"),
        );
        pb
    }
}

// Usage in resolver
pub fn print_provider_attempt(provider: &str) {
    ColoredOutput::info(&format!("Trying provider: {}", provider.cyan()));
}

pub fn print_provider_success(provider: &str, latency: u64) {
    ColoredOutput::success(&format!(
        "✓ {} resolved in {}ms", 
        provider.green(), 
        latency.to_string().yellow()
    ));
}

pub fn print_provider_failure(provider: &str, error: &str) {
    ColoredOutput::error(&format!(
        "✗ {} failed: {}", 
        provider, 
        error
    ));
}
```

**Dependencies:**
```toml
[dependencies]
colored = "2.0"
indicatif = "0.17"
```

---

### Improvement 8: Toast Notifications

**Description:** Stacking toast notifications with actions.

```typescript
// web/app/components/Toast.tsx

import { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div 
      className="toast-container"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          index={index}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, index, onDismiss }: { 
  toast: Toast; 
  index: number;
  onDismiss: () => void;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  
  useEffect(() => {
    if (isPaused || !toast.duration) return;
    
    const interval = setInterval(() => {
      setProgress(p => {
        if (p <= 0) {
          onDismiss();
          return 0;
        }
        return p - (100 / (toast.duration! / 100));
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPaused, toast.duration, onDismiss]);
  
  const icon = {
    success: <Check size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertCircle size={20} />,
    info: <Info size={20} />,
  }[toast.type];
  
  return (
    <div
      className={`toast toast-${toast.type}`}
      style={{ transform: `translateY(${index * 100}%)` }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      <div className="toast-icon">{icon}</div>
      <div className="toast-content">
        <h4 className="toast-title">{toast.title}</h4>
        {toast.message && <p className="toast-message">{toast.message}</p>}
        {toast.action && (
          <button className="toast-action" onClick={toast.action.onClick}>
            {toast.action.label}
          </button>
        )}
      </div>
      <button 
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
      {toast.duration && (
        <div 
          className="toast-progress"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}
```

---

## Phase 4: Accessibility Compliance (Week 4)

### Improvement 9: Reduced Motion Support

**Description:** Respect `prefers-reduced-motion` for animations.

```css
/* web/app/globals.css */

/* Default animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse,
  .animate-spin {
    animation: none;
  }
  
  .step {
    transition: none;
  }
  
  .toast {
    transition: none;
  }
  
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### Improvement 10: High Contrast Mode

**Description:** Support Windows High Contrast mode.

```css
/* web/app/globals.css */

@media (forced-colors: active) {
  /* Use system colors */
  .step-icon,
  .code-block,
  .button,
  .input {
    border: 2px solid currentColor;
  }
  
  /* Ensure sufficient contrast */
  .text-secondary {
    color: CanvasText;
  }
  
  /* Remove decorative backgrounds */
  .gradient-bg,
  .blur-effect {
    background: Canvas;
  }
}
```

---

## Dependencies

### Web
```json
{
  "prismjs": "^1.29",
  "@types/prismjs": "^1.26",
  "recharts": "^2.10",
  "lucide-react": "latest"
}
```

### Rust CLI
```toml
[dependencies]
colored = "2.0"
indicatif = "0.17"
```

---

## Testing

1. **Accessibility audit** with axe-core
2. **Keyboard navigation** test
3. **Screen reader** test (VoiceOver, NVDA)
4. **Mobile responsiveness** test
5. **Reduced motion** test
6. **High contrast** test

---

## Success Metrics

- [ ] All components keyboard accessible
- [ ] WCAG 2.2 AA compliance
- [ ] Mobile-friendly history
- [ ] CLI color support
- [ ] Reduced motion support
- [ ] High contrast support

---

## Phase 5: Result Experience Enhancements (Week 5)

### Improvement 11: Result Canonicalization & Deduplication

**Description:** Normalize URLs, strip redundant mirrors (e.g., `llm-digest` prefixes), and collapse duplicate entries before rendering cards or history rows. This keeps provider output readable even when upstream feeds surface the same document multiple ways.

```typescript
// web/app/lib/normalizeResults.ts

const NORMALIZERS = [
  (url: URL) => {
    if (url.hostname === 'nextjs.org' && url.pathname.startsWith('/docs/llm-digest/')) {
      url.pathname = url.pathname.replace('/docs/llm-digest', '/docs');
    }
    return url;
  },
  (url: URL) => {
    url.hash = '';
    return url;
  },
];

export function normalizeResult(result: ProviderResult) {
  try {
    const url = NORMALIZERS.reduce((acc, fn) => fn(acc), new URL(result.url));
    const normalizedUrl = url.toString();
    return { ...result, url: normalizedUrl, dedupeKey: normalizedUrl.toLowerCase() };
  } catch (_) {
    return { ...result, dedupeKey: result.url.toLowerCase() };
  }
}

export function dedupeResults(results: ProviderResult[]) {
  const seen = new Map<string, ProviderResult>();
  results.forEach((raw) => {
    const normalized = normalizeResult(raw);
    if (!seen.has(normalized.dedupeKey)) {
      seen.set(normalized.dedupeKey, normalized);
    }
  });
  return Array.from(seen.values());
}
```

### Improvement 12: Provider Status Tooltips & CTA

**Description:** Replace the static "provider unavailable" buttons with contextual tooltips explaining why they are disabled (e.g., missing API key) plus a single-click CTA to open the API Keys panel.

```tsx
<ProviderPill
  disabled={!hasTavilyKey}
  description={hasTavilyKey ? 'Ready' : 'Add API key to unlock Tavily search'}
  onClick={hasTavilyKey ? enableProvider : () => setPanel('keys')}
  tooltip={!hasTavilyKey ? 'Click to open API key drawer' : undefined}
  aria-describedby={!hasTavilyKey ? 'tavily-help' : undefined}
/>

<VisuallyHidden id="tavily-help">
  Tavily requires `TAVILY_API_KEY`. Open the API Keys drawer to add it.
</VisuallyHidden>
```

### Improvement 13: Search Profile Combobox Refactor

**Description:** Swap the current native select + textbox hack for a headless combobox so keyboard users can change profiles without polluting the query field. Capture arrow keys, typeahead, and announce the active profile via `aria-live`.

```tsx
// web/app/components/ProfileCombobox.tsx

import { useCombobox } from 'downshift';

export function ProfileCombobox({ options, value, onChange }: Props) {
  const combobox = useCombobox({
    items: options,
    selectedItem: options.find((opt) => opt.value === value),
    onSelectedItemChange: ({ selectedItem }) => selectedItem && onChange(selectedItem.value),
  });

  return (
    <div {...combobox.getComboboxProps()} className="profile-combobox">
      <button {...combobox.getToggleButtonProps()} aria-label="Change search profile">
        {combobox.selectedItem?.label}
      </button>
      <ul {...combobox.getMenuProps()}>
        {combobox.isOpen && options.map((item, index) => (
          <li
            key={item.value}
            {...combobox.getItemProps({ item, index })}
            className={item.value === value ? 'active' : ''}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Improvement 14: Quick Toggles for Advanced Flags

**Description:** Surface `Skip cache`, `Deep research`, and latency budget presets directly next to the profile selector so power users can run "Balanced + Deep research" without reopening the drawer.

```tsx
<div className="profile-flags">
  <ToggleChip
    label="Deep research"
    pressed={settings.deepResearch}
    onPressedChange={(pressed) => updateSettings({ deepResearch: pressed })}
  />
  <ToggleChip
    label="Skip cache"
    pressed={settings.skipCache}
    onPressedChange={(pressed) => updateSettings({ skipCache: pressed })}
  />
  <LatencyPresetSelect
    value={settings.latencyBudget}
    options={[8000, 12000, 20000]}
    onChange={(latencyBudget) => updateSettings({ latencyBudget })}
  />
</div>
```

### Improvement 15: Result Cards Instead of Textarea

**Description:** Replace the monolithic textarea with discrete cards so each hit can show metadata, actions, and accessible markup. Enables per-result copy, open-in-new-tab, and "helpful" toggles.

```tsx
// web/app/components/ResultCard.tsx

export function ResultCard({ result }: { result: ProviderResult }) {
  return (
    <article className="result-card" aria-labelledby={`result-${result.id}-title`}>
      <header>
        <a id={`result-${result.id}-title`} href={result.url} target="_blank" rel="noreferrer">
          {result.title}
        </a>
        <span className="result-meta">{result.provider}</span>
      </header>
      <p className="result-snippet">{result.summary}</p>
      <footer>
        <button onClick={() => copyMarkdown(result)}>Copy Markdown</button>
        <button onClick={() => markHelpful(result.id)}>Helpful</button>
      </footer>
    </article>
  );
}
```

### Improvement 16: History Storage Cleanup

**Description:** Store normalized URLs + profile metadata in history entries so duplicates collapse automatically and filters (by profile or flags) work. This also lets us highlight which providers fed each response without fetching new data.

```ts
type HistoryEntry = {
  id: string;
  input: string;
  profile: SearchProfile;
  flags: { deepResearch: boolean; skipCache: boolean };
  providers: string[];
  normalizedUrlHashes: string[];
};

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id'>) {
  const id = crypto.randomUUID();
  const payload = { ...entry, id };
  historyStore.update((current) => {
    const deduped = current.filter((existing) => !hasSameUrls(existing, payload));
    return [payload, ...deduped].slice(0, 50);
  });
}
```

---
