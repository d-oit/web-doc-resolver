# New Features Implementation Plan

## Overview

This plan implements 12 new features across 4 priority tiers: quick wins, strategic features, enterprise capabilities, and future roadmap items.

---

## Phase 1: Quick Wins (Weeks 1-2)

### Feature 1: Structured JSON Output Format

**Description:** Return extracted content as structured JSON with sections, metadata, and links.

**Use Cases:**
- RAG pipelines requiring chunked content
- API consumers needing programmatic access
- Data extraction workflows

**Implementation:**

```python
# scripts/resolve.py

from dataclasses import dataclass
from typing import List, Dict, Optional
import re

@dataclass
class StructuredContent:
    title: str
    url: str
    sections: List[Dict]
    links: List[Dict]
    images: List[Dict]
    metadata: Dict

def parse_markdown_structure(content: str, url: str) -> StructuredContent:
    """Parse markdown into structured sections."""
    
    # Extract title (first H1)
    title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    title = title_match.group(1) if title_match else ""
    
    # Parse sections by headers
    sections = []
    current_section = {"heading": "", "content": [], "level": 0}
    
    for line in content.split('\n'):
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        
        if header_match:
            # Save previous section
            if current_section["content"]:
                sections.append({
                    "heading": current_section["heading"],
                    "content": '\n'.join(current_section["content"]).strip(),
                    "level": current_section["level"]
                })
            
            # Start new section
            level = len(header_match.group(1))
            heading = header_match.group(2)
            current_section = {
                "heading": heading,
                "content": [],
                "level": level
            }
        else:
            current_section["content"].append(line)
    
    # Add final section
    if current_section["content"]:
        sections.append({
            "heading": current_section["heading"],
            "content": '\n'.join(current_section["content"]).strip(),
            "level": current_section["level"]
        })
    
    # Extract links
    links = []
    for match in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', content):
        links.append({
            "text": match.group(1),
            "url": match.group(2)
        })
    
    return StructuredContent(
        title=title,
        url=url,
        sections=sections,
        links=links,
        images=[],  # Extract from markdown images
        metadata={}
    )

def resolve_url(
    url: str, 
    max_chars: int = MAX_CHARS,
    output_format: str = "markdown"  # "markdown" | "json"
) -> dict:
    """Resolve URL with format option."""
    
    # Get markdown result
    result = resolve_url_markdown(url, max_chars)
    
    if output_format == "json":
        structured = parse_markdown_structure(
            result["content"], 
            result["url"]
        )
        return {
            "source": result["source"],
            "url": result["url"],
            "score": result.get("score"),
            "content": structured.__dict__,
            "metrics": result.get("metrics")
        }
    
    return result
```

**CLI Usage:**
```bash
python -m scripts.cli "https://example.com" --format json
./target/release/do-wdr resolve "https://example.com" --format json
```

**Web API:**
```bash
POST /api/resolve
{
  "input": "https://example.com",
  "format": "json"
}
```

---

### Feature 2: Batch Resolution API

**Description:** Process multiple URLs/queries in a single request.

**Implementation:**

```python
# scripts/batch_resolve.py

import asyncio
from typing import List, Dict, Union
from dataclasses import dataclass
from scripts.resolve import resolve

@dataclass
class BatchRequest:
    id: str
    input: str
    max_chars: int = 8000
    profile: str = "balanced"

@dataclass
class BatchResult:
    id: str
    status: str  # "success" | "error"
    result: Union[dict, None]
    error: Union[str, None]
    latency_ms: int

async def resolve_batch(
    requests: List[BatchRequest],
    max_concurrent: int = 5
) -> List[BatchResult]:
    """Resolve multiple inputs in parallel."""
    
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def resolve_single(req: BatchRequest) -> BatchResult:
        async with semaphore:
            start = time.time()
            try:
                result = await resolve_async(
                    req.input,
                    max_chars=req.max_chars,
                    profile=req.profile
                )
                return BatchResult(
                    id=req.id,
                    status="success",
                    result=result,
                    error=None,
                    latency_ms=int((time.time() - start) * 1000)
                )
            except Exception as e:
                return BatchResult(
                    id=req.id,
                    status="error",
                    result=None,
                    error=str(e),
                    latency_ms=int((time.time() - start) * 1000)
                )
    
    # Process all requests in parallel
    tasks = [resolve_single(req) for req in requests]
    results = await asyncio.gather(*tasks)
    
    return list(results)

# Web API endpoint
# web/app/api/resolve/batch/route.ts
```

**CLI Usage:**
```bash
# Batch file (JSON)
cat > batch.json << 'EOF'
[
  {"id": "1", "input": "https://example.com"},
  {"id": "2", "input": "Python tutorial"}
]
EOF

./target/release/do-wdr resolve-batch batch.json --output results.json
```

**Limitations:**
- Max 20 requests per batch
- Max 5 concurrent
- 60 second timeout

---

### Feature 3: Content Change Detection

**Description:** Track content hashes and detect when cached content has changed.

**Implementation:**

```python
# scripts/change_detection.py

import hashlib
import time
from typing import Optional
from scripts.utils import _get_from_cache, _save_to_cache

def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    return hashlib.sha256(content.encode()).hexdigest()[:16]

def check_content_changed(
    url: str, 
    provider: str = "any"
) -> dict:
    """Check if content has changed since last fetch."""
    
    cache_key = f"hash:{provider}:{url}"
    
    # Get cached hash
    cached = _get_from_cache(cache_key, "content_hash")
    cached_hash = cached.get("hash") if cached else None
    cached_time = cached.get("timestamp") if cached else None
    
    # Fetch current content
    from scripts.resolve import resolve_url
    result = resolve_url(url, max_chars=1000)  # Small sample
    
    if result.get("source") == "none":
        return {
            "url": url,
            "status": "error",
            "error": "Failed to fetch content"
        }
    
    # Compute current hash
    current_hash = compute_content_hash(result["content"])
    
    # Save new hash
    _save_to_cache(cache_key, "content_hash", {
        "hash": current_hash,
        "timestamp": time.time()
    })
    
    # Compare
    if cached_hash is None:
        return {
            "url": url,
            "status": "new",
            "changed": True,
            "previous_hash": None,
            "current_hash": current_hash
        }
    
    changed = cached_hash != current_hash
    
    return {
        "url": url,
        "status": "changed" if changed else "unchanged",
        "changed": changed,
        "previous_hash": cached_hash,
        "current_hash": current_hash,
        "last_checked": cached_time
    }

# Web API endpoint
# web/app/api/cache/check/route.ts
```

**CLI Usage:**
```bash
./target/release/do-wdr cache-check "https://example.com"
```

---

### Feature 4: Export Format Options

**Description:** Support multiple output formats beyond markdown.

**Implementation:**

```python
# scripts/export_formats.py

from typing import Dict
import html
import csv
import io

def convert_to_format(content: str, format_type: str) -> str:
    """Convert markdown content to various formats."""
    
    if format_type == "markdown":
        return content
    
    elif format_type == "plain":
        # Strip markdown syntax
        import re
        # Remove headers
        plain = re.sub(r'^#{1,6}\s*', '', content, flags=re.MULTILINE)
        # Remove links, keep text
        plain = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', plain)
        # Remove code fences
        plain = re.sub(r'```[\s\S]*?```', '', plain)
        # Remove inline code
        plain = re.sub(r'`([^`]+)`', r'\1', plain)
        # Remove bold/italic
        plain = re.sub(r'\*\*?|__?', '', plain)
        return plain.strip()
    
    elif format_type == "html":
        # Simple markdown to HTML conversion
        html_content = html.escape(content)
        # Convert headers
        for i in range(6, 0, -1):
            html_content = re.sub(
                rf'^#{i}\s+(.+)$',
                rf'<h{i}>\1</h{i}>',
                html_content,
                flags=re.MULTILINE
            )
        # Convert paragraphs
        html_content = '<p>' + html_content.replace('\n\n', '</p><p>') + '</p>'
        return f"<!DOCTYPE html><html><body>{html_content}</body></html>"
    
    elif format_type == "csv":
        # Try to extract tabular data
        # This is a simplified version
        lines = content.split('\n')
        output = io.StringIO()
        writer = csv.writer(output)
        
        for line in lines:
            if '|' in line:
                # Markdown table row
                cells = [c.strip() for c in line.split('|') if c.strip()]
                writer.writerow(cells)
        
        return output.getvalue()
    
    else:
        raise ValueError(f"Unknown format: {format_type}")

# Supported formats
EXPORT_FORMATS = ["markdown", "plain", "html", "csv"]
```

**CLI Usage:**
```bash
./target/release/do-wdr resolve "https://example.com" --format html
./target/release/do-wdr resolve "https://example.com" --format plain --output output.txt
```

---

## Phase 2: Strategic Features (Weeks 3-6)

### Feature 5: Streaming Response Support (SSE)

**Description:** Stream resolution progress in real-time using Server-Sent Events.

**Implementation:**

```typescript
// web/app/api/resolve/stream/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { input, profile = 'balanced' } = body;
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial event
      controller.enqueue(encoder.encode(
        `event: start\ndata: ${JSON.stringify({ input, profile })}\n\n`
      ));
      
      try {
        // Resolve with streaming callbacks
        const result = await resolveWithCallbacks(input, {
          onProviderStart: (provider: string) => {
            controller.enqueue(encoder.encode(
              `event: provider_start\ndata: ${JSON.stringify({ provider })}\n\n`
            ));
          },
          onProviderComplete: (provider: string, result: any) => {
            controller.enqueue(encoder.encode(
              `event: provider_complete\ndata: ${JSON.stringify({ provider, result })}\n\n`
            ));
          },
          onResult: (partial: any) => {
            controller.enqueue(encoder.encode(
              `event: result\ndata: ${JSON.stringify(partial)}\n\n`
            ));
          }
        });
        
        // Send completion event
        controller.enqueue(encoder.encode(
          `event: complete\ndata: ${JSON.stringify(result)}\n\n`
        ));
        
      } catch (error) {
        controller.enqueue(encoder.encode(
          `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`
        ));
      } finally {
        controller.close();
      }
    }
  });
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Web UI Component:**
```typescript
// Web UI streaming handler
const eventSource = new EventSource('/api/resolve/stream');

eventSource.addEventListener('provider_start', (e) => {
  const data = JSON.parse(e.data);
  updateStepper(data.provider, 'running');
});

eventSource.addEventListener('result', (e) => {
  const data = JSON.parse(e.data);
  appendPartialContent(data.content);
});

eventSource.addEventListener('complete', (e) => {
  const data = JSON.parse(e.data);
  finalizeResult(data);
  eventSource.close();
});
```

---

### Feature 6: Webhook & Async Callback System

**Description:** Support async resolution with webhook callbacks.

**Implementation:**

```python
# scripts/async_jobs.py

import asyncio
import json
import aiohttp
import uuid
from typing import Optional
from dataclasses import dataclass
from datetime import datetime

# Simple in-memory job store (use Redis in production)
_jobs: dict = {}

@dataclass
class Job:
    id: str
    status: str  # "pending" | "running" | "completed" | "failed"
    input: str
    webhook_url: Optional[str]
    result: Optional[dict]
    error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

async def create_job(
    input: str,
    webhook_url: Optional[str] = None,
    max_chars: int = 8000
) -> str:
    """Create a new async job."""
    job_id = str(uuid.uuid4())
    
    job = Job(
        id=job_id,
        status="pending",
        input=input,
        webhook_url=webhook_url,
        result=None,
        error=None,
        created_at=datetime.now(),
        completed_at=None
    )
    
    _jobs[job_id] = job
    
    # Start async processing
    asyncio.create_task(_process_job(job_id, max_chars))
    
    return job_id

async def _process_job(job_id: str, max_chars: int):
    """Process job in background."""
    job = _jobs[job_id]
    job.status = "running"
    
    try:
        from scripts.resolve import resolve
        result = resolve(job.input, max_chars=max_chars)
        
        job.result = result
        job.status = "completed"
        job.completed_at = datetime.now()
        
        # Send webhook if configured
        if job.webhook_url:
            await _send_webhook(job)
            
    except Exception as e:
        job.error = str(e)
        job.status = "failed"
        job.completed_at = datetime.now()

def get_job_status(job_id: str) -> Optional[dict]:
    """Get job status and result."""
    job = _jobs.get(job_id)
    if not job:
        return None
    
    return {
        "id": job.id,
        "status": job.status,
        "input": job.input,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "completed_at": job.completed_at.isoformat() if job.completed_at else None
    }

async def _send_webhook(job: Job):
    """Send result to webhook URL."""
    if not job.webhook_url:
        return
    
    payload = {
        "job_id": job.id,
        "status": job.status,
        "input": job.input,
        "result": job.result,
        "error": job.error
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                job.webhook_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status >= 400:
                    logger.warning(f"Webhook failed for job {job.id}: {resp.status}")
    except Exception as e:
        logger.error(f"Webhook error for job {job.id}: {e}")
```

**API Endpoints:**

```typescript
// POST /api/jobs
// Create async job
{
  "input": "https://example.com",
  "webhook_url": "https://myapp.com/webhook",
  "max_chars": 8000
}

// Response: { "job_id": "uuid" }

// GET /api/jobs/{id}
// Check job status

// Response:
{
  "id": "uuid",
  "status": "completed",
  "input": "https://example.com",
  "result": { /* ... */ },
  "created_at": "2024-01-01T12:00:00",
  "completed_at": "2024-01-01T12:00:05"
}
```

---

### Feature 7: Metrics Dashboard

**Description:** Web-based dashboard for usage analytics and cost tracking.

**Implementation:**

```typescript
// web/app/dashboard/page.tsx

import { useEffect, useState } from 'react';
import { LineChart, BarChart, PieChart } from 'recharts';

interface MetricsData {
  daily_requests: { date: string; count: number }[];
  provider_usage: { provider: string; count: number }[];
  latency_trends: { date: string; p50: number; p95: number }[];
  cache_hit_rate: number;
  cost_breakdown: { provider: string; cost: number }[];
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  
  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, []);
  
  if (!metrics) return <Loading />;
  
  return (
    <div className="dashboard">
      <h1>Resolver Metrics</h1>
      
      <div className="metrics-grid">
        <Card title="Daily Requests">
          <LineChart data={metrics.daily_requests}>
            {/* Chart implementation */}
          </LineChart>
        </Card>
        
        <Card title="Provider Usage">
          <PieChart data={metrics.provider_usage}>
            {/* Chart implementation */}
          </PieChart>
        </Card>
        
        <Card title="Latency Trends">
          <LineChart data={metrics.latency_trends}>
            {/* Chart implementation */}
          </LineChart>
        </Card>
        
        <Card title="Cache Hit Rate">
          <div className="metric-value">{metrics.cache_hit_rate}%</div>
        </Card>
      </div>
    </div>
  );
}
```

---

## Phase 3: Enterprise Features (Weeks 6-8)

### Feature 8: CSS Selector Extraction

**Description:** Target specific content areas using CSS selectors.

**CLI Usage:**
```bash
./target/release/do-wdr resolve "https://example.com" \
  --selector "article.main-content" \
  --exclude-selector "nav,footer,aside"
```

**Implementation:** Use Playwright or BeautifulSoup for selector-based extraction.

---

### Feature 9: Image Captioning

**Description:** Automatically caption images using vision models.

**Implementation:**
```python
async def caption_images(content: str) -> str:
    """Add captions to images in content."""
    # Extract image URLs
    # Use Jina VLM or Mistral vision API
    # Add captions as alt text
```

---

### Feature 10: Team/Workspace Support

**Description:** Multi-user workspaces with shared history and API keys.

**Implementation:**
- Clerk/Auth0 integration
- Workspace-scoped data
- Role-based permissions
- Team billing

---

## API Summary

### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/resolve/batch` | POST | Batch resolution |
| `/api/resolve/stream` | POST | Streaming (SSE) |
| `/api/jobs` | POST | Create async job |
| `/api/jobs/{id}` | GET | Job status |
| `/api/cache/check` | POST | Change detection |
| `/api/metrics` | GET | Usage metrics |
| `/api/export` | POST | Export formats |

### New CLI Commands

```bash
do-wdr resolve-batch <file.json>
do-wdr cache-check <url>
do-wdr jobs create <input> [--webhook <url>]
do-wdr jobs status <id>
do-wdr dashboard  # Open web dashboard
```

---

## Dependencies

### Python
```
aiohttp>=3.9.0
aiodns>=3.1.0
pytest-asyncio>=0.21.0
```

### Web
```json
{
  "recharts": "^2.10",
  "date-fns": "^2.30"
}
```

---

## Testing Plan

1. **Unit tests** for each feature
2. **Integration tests** for API endpoints
3. **Load tests** for streaming and batch
4. **E2E tests** for dashboard

---

## Timeline

| Week | Features |
|------|----------|
| 1-2 | Structured JSON, Batch API, Change Detection, Export Formats |
| 3-6 | Streaming (SSE), Webhooks, Metrics Dashboard |
| 6-8 | CSS Selectors, Image Captioning, Team Support |
