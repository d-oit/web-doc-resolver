# Deep Research & Evaluation Plan

## Overview

This plan implements deep research capabilities and a comprehensive evaluation framework for the do-web-doc-resolver project. Focus on quality, accuracy, and performance measurement.

**Status:** Active Development  
**Priority:** P0 (Critical)  
**Duration:** 2 weeks  
**No New Providers Required**

---

## Phase 1: Deep Research Framework (Week 1)

### Task 1.1: Multi-Step Research Engine

**Description:** Enable iterative, multi-step research that builds context over multiple queries.

**Implementation:**

```python
# scripts/deep_research.py
"""
Deep research engine for multi-step iterative research.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Callable
from enum import Enum
import json
import time

class ResearchStepType(Enum):
    INITIAL_QUERY = "initial"
    FOLLOW_UP = "follow_up"
    SYNTHESIS = "synthesis"
    VERIFICATION = "verification"

@dataclass
class ResearchStep:
    step_number: int
    step_type: ResearchStepType
    query: str
    results: List[Dict]
    insights: List[str]
    timestamp: float = field(default_factory=time.time)

@dataclass
class ResearchSession:
    session_id: str
    initial_query: str
    steps: List[ResearchStep]
    final_report: Optional[str] = None
    metrics: Dict = field(default_factory=dict)

class DeepResearchEngine:
    """
    Multi-step research engine with iterative refinement.
    """
    
    def __init__(
        self,
        max_steps: int = 5,
        min_insights_per_step: int = 3,
        synthesis_threshold: float = 0.8
    ):
        self.max_steps = max_steps
        self.min_insights_per_step = min_insights_per_step
        self.synthesis_threshold = synthesis_threshold
        
    async def research(
        self,
        query: str,
        progress_callback: Optional[Callable] = None
    ) -> ResearchSession:
        """
        Execute multi-step research.
        
        Args:
            query: Initial research query
            progress_callback: Optional callback for progress updates
            
        Returns:
            ResearchSession with all steps and final report
        """
        import uuid
        session = ResearchSession(
            session_id=str(uuid.uuid4()),
            initial_query=query,
            steps=[]
        )
        
        # Step 1: Initial broad search
        step1 = await self._execute_step(
            session, 1, ResearchStepType.INITIAL_QUERY, query
        )
        session.steps.append(step1)
        
        if progress_callback:
            progress_callback(1, self.max_steps, "initial_search_complete")
        
        # Steps 2-N: Iterative refinement
        for step_num in range(2, self.max_steps + 1):
            # Generate follow-up queries based on insights
            follow_up_queries = self._generate_follow_ups(session)
            
            if not follow_up_queries:
                break
                
            # Execute follow-up searches
            for follow_up in follow_up_queries[:2]:  # Max 2 per step
                step = await self._execute_step(
                    session, step_num, ResearchStepType.FOLLOW_UP, follow_up
                )
                session.steps.append(step)
                
            if progress_callback:
                progress_callback(step_num, self.max_steps, f"step_{step_num}_complete")
        
        # Final synthesis
        synthesis_step = await self._synthesize(session)
        session.steps.append(synthesis_step)
        
        if progress_callback:
            progress_callback(self.max_steps, self.max_steps, "synthesis_complete")
        
        # Calculate metrics
        session.metrics = self._calculate_metrics(session)
        
        return session
    
    async def _execute_step(
        self,
        session: ResearchSession,
        step_number: int,
        step_type: ResearchStepType,
        query: str
    ) -> ResearchStep:
        """Execute a single research step."""
        from scripts.resolve import resolve_query
        
        # Resolve the query
        result = resolve_query(query, max_chars=8000)
        
        # Extract insights using simple NLP
        insights = self._extract_insights(result.get("content", ""))
        
        return ResearchStep(
            step_number=step_number,
            step_type=step_type,
            query=query,
            results=[result],
            insights=insights
        )
    
    def _extract_insights(self, content: str) -> List[str]:
        """Extract key insights from content."""
        insights = []
        
        # Simple extraction: bullet points, key sentences
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            # Look for bullet points
            if line.startswith('- ') or line.startswith('* '):
                insights.append(line[2:])
            # Look for numbered points
            elif line[:2].isdigit() and line[2:4] in ['. ', ') ']:
                insights.append(line[3:])
            # Key sentences (containing key phrases)
            elif any(phrase in line.lower() for phrase in ['important', 'key', 'critical', 'essential']):
                if len(line) > 50:
                    insights.append(line)
        
        return insights[:10]  # Max 10 insights
    
    def _generate_follow_ups(self, session: ResearchSession) -> List[str]:
        """Generate follow-up queries based on accumulated insights."""
        if not session.steps:
            return []
        
        # Collect all insights
        all_insights = []
        for step in session.steps:
            all_insights.extend(step.insights)
        
        if len(all_insights) < self.min_insights_per_step:
            return []
        
        # Generate queries around gaps
        follow_ups = []
        
        # Query 1: Deeper dive into most mentioned topic
        from collections import Counter
        words = ' '.join(all_insights).lower().split()
        common_words = Counter(w for w in words if len(w) > 5).most_common(3)
        
        if common_words:
            topic = common_words[0][0]
            follow_ups.append(f"{session.initial_query} {topic} detailed analysis")
        
        # Query 2: Recent developments
        follow_ups.append(f"{session.initial_query} latest updates 2024")
        
        # Query 3: Comparison/contrast
        if len(common_words) > 1:
            topic2 = common_words[1][0]
            follow_ups.append(f"{common_words[0][0]} vs {topic2}")
        
        return follow_ups[:3]
    
    async def _synthesize(self, session: ResearchSession) -> ResearchStep:
        """Synthesize all research into final report."""
        all_content = []
        for step in session.steps:
            for result in step.results:
                all_content.append(result.get("content", ""))
        
        # Combine and deduplicate
        combined = '\n\n'.join(all_content)
        
        # Generate synthesis insights
        synthesis_insights = [
            f"Research covered {len(session.steps)} steps",
            f"Total sources: {len(all_content)}",
            f"Total insights extracted: {sum(len(s.insights) for s in session.steps)}"
        ]
        
        return ResearchStep(
            step_number=len(session.steps) + 1,
            step_type=ResearchStepType.SYNTHESIS,
            query="synthesis",
            results=[{"content": combined}],
            insights=synthesis_insights
        )
    
    def _calculate_metrics(self, session: ResearchSession) -> Dict:
        """Calculate research quality metrics."""
        total_time = time.time() - session.steps[0].timestamp if session.steps else 0
        
        return {
            "total_steps": len(session.steps),
            "total_insights": sum(len(s.insights) for s in session.steps),
            "total_time_seconds": total_time,
            "avg_time_per_step": total_time / len(session.steps) if session.steps else 0,
            "sources_per_step": sum(len(s.results) for s in session.steps) / len(session.steps) if session.steps else 0
        }


# CLI Interface
if __name__ == "__main__":
    import asyncio
    import sys
    
    async def main():
        if len(sys.argv) < 2:
            print("Usage: python -m scripts.deep_research <query>")
            sys.exit(1)
        
        query = ' '.join(sys.argv[1:])
        engine = DeepResearchEngine(max_steps=3)
        
        def progress(step, total, status):
            print(f"[{step}/{total}] {status}")
        
        print(f"Starting deep research: {query}")
        session = await engine.research(query, progress)
        
        print("\n" + "="*60)
        print(f"Research Complete: {session.session_id}")
        print("="*60)
        print(f"Steps executed: {len(session.steps)}")
        print(f"Total insights: {session.metrics['total_insights']}")
        print(f"Time: {session.metrics['total_time_seconds']:.1f}s")
        
        print("\nKey Insights:")
        for i, step in enumerate(session.steps, 1):
            print(f"\nStep {i} ({step.step_type.value}): {step.query}")
            for insight in step.insights[:5]:
                print(f"  - {insight[:100]}...")
    
    asyncio.run(main())
```

**New Files:**
- `scripts/deep_research.py` - Research engine (max 500 lines, split if needed)
- `tests/test_deep_research.py` - Research engine tests

**Acceptance Criteria:**
- Multi-step research executes 3-5 iterations
- Each step generates meaningful follow-up queries
- Final synthesis combines insights
- Progress callbacks provide visibility
- Metrics calculated for evaluation

---

### Task 1.2: Evaluation Framework

**Description:** Comprehensive evaluation system for measuring resolution quality.

**Implementation:**

```python
# scripts/evaluation.py
"""
Evaluation framework for measuring resolver quality and performance.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Callable
import json
import time
from enum import Enum

class EvaluationMetric(Enum):
    RELEVANCE = "relevance"
    COMPLETENESS = "completeness"
    ACCURACY = "accuracy"
    LATENCY = "latency"
    COVERAGE = "coverage"
    DIVERSITY = "diversity"

@dataclass
class EvaluationResult:
    metric: EvaluationMetric
    score: float  # 0.0 - 1.0
    details: Dict
    timestamp: float

@dataclass
class EvaluatedResolution:
    query: str
    result: Dict
    evaluations: List[EvaluationResult]
    overall_score: float
    duration_ms: int

class ResolutionEvaluator:
    """
    Evaluates resolution quality across multiple dimensions.
    """
    
    def __init__(self):
        self.metrics: Dict[EvaluationMetric, Callable] = {
            EvaluationMetric.RELEVANCE: self._evaluate_relevance,
            EvaluationMetric.COMPLETENESS: self._evaluate_completeness,
            EvaluationMetric.ACCURACY: self._evaluate_accuracy,
            EvaluationMetric.LATENCY: self._evaluate_latency,
            EvaluationMetric.COVERAGE: self._evaluate_coverage,
        }
    
    def evaluate(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str] = None
    ) -> EvaluatedResolution:
        """
        Evaluate a resolution result.
        
        Args:
            query: Original query
            result: Resolution result dict
            duration_ms: Resolution time
            reference: Optional reference content for comparison
            
        Returns:
            EvaluatedResolution with all metrics
        """
        evaluations = []
        
        for metric, evaluator in self.metrics.items():
            score, details = evaluator(query, result, duration_ms, reference)
            evaluations.append(EvaluationResult(
                metric=metric,
                score=score,
                details=details,
                timestamp=time.time()
            ))
        
        # Calculate overall score (weighted average)
        weights = {
            EvaluationMetric.RELEVANCE: 0.3,
            EvaluationMetric.COMPLETENESS: 0.25,
            EvaluationMetric.ACCURACY: 0.2,
            EvaluationMetric.LATENCY: 0.15,
            EvaluationMetric.COVERAGE: 0.1,
        }
        
        overall = sum(
            e.score * weights.get(e.metric, 0.1)
            for e in evaluations
        )
        
        return EvaluatedResolution(
            query=query,
            result=result,
            evaluations=evaluations,
            overall_score=overall,
            duration_ms=duration_ms
        )
    
    def _evaluate_relevance(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str]
    ) -> tuple[float, Dict]:
        """Evaluate relevance of content to query."""
        content = result.get("content", "").lower()
        query_words = set(query.lower().split())
        
        # Calculate word overlap
        content_words = set(content.split())
        overlap = query_words & content_words
        
        score = len(overlap) / len(query_words) if query_words else 0.0
        
        # Boost if key phrases present
        key_phrases = [query.lower()]
        for phrase in key_phrases:
            if phrase in content:
                score = min(1.0, score + 0.2)
        
        return min(1.0, score), {
            "query_words": len(query_words),
            "overlap": len(overlap),
            "coverage_ratio": score
        }
    
    def _evaluate_completeness(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str]
    ) -> tuple[float, Dict]:
        """Evaluate content completeness."""
        content = result.get("content", "")
        
        # Score based on length and structure
        char_count = len(content)
        word_count = len(content.split())
        
        # Ideal range: 500-3000 words
        if word_count < 100:
            score = 0.3
        elif word_count < 500:
            score = 0.6
        elif word_count < 1000:
            score = 0.8
        else:
            score = 1.0
        
        # Check for structure (headers, lists)
        has_headers = "#" in content
        has_lists = "- " in content or "* " in content
        
        if has_headers:
            score = min(1.0, score + 0.1)
        if has_lists:
            score = min(1.0, score + 0.1)
        
        return score, {
            "char_count": char_count,
            "word_count": word_count,
            "has_headers": has_headers,
            "has_lists": has_lists
        }
    
    def _evaluate_accuracy(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str]
    ) -> tuple[float, Dict]:
        """Evaluate factual accuracy (requires reference)."""
        if not reference:
            # Without reference, base on source reputation
            source = result.get("source", "unknown")
            trusted_sources = {"exa", "tavily", "serper", "firecrawl"}
            
            if source in trusted_sources:
                return 0.85, {"source": source, "trust_score": "high"}
            elif source in {"jina", "direct_fetch"}:
                return 0.75, {"source": source, "trust_score": "medium"}
            else:
                return 0.65, {"source": source, "trust_score": "low"}
        
        # With reference, compare content similarity
        content = result.get("content", "")
        # Simple word overlap comparison
        content_words = set(content.lower().split())
        ref_words = set(reference.lower().split())
        
        if not ref_words:
            return 0.5, {"method": "no_reference"}
        
        overlap = len(content_words & ref_words)
        score = overlap / len(ref_words)
        
        return min(1.0, score), {
            "method": "reference_comparison",
            "overlap_words": overlap
        }
    
    def _evaluate_latency(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str]
    ) -> tuple[float, Dict]:
        """Evaluate resolution latency."""
        # Score based on duration
        if duration_ms < 2000:
            score = 1.0
        elif duration_ms < 5000:
            score = 0.8
        elif duration_ms < 10000:
            score = 0.6
        elif duration_ms < 20000:
            score = 0.4
        else:
            score = 0.2
        
        return score, {
            "duration_ms": duration_ms,
            "threshold": "<2s=excellent, <5s=good, <10s=acceptable"
        }
    
    def _evaluate_coverage(
        self,
        query: str,
        result: Dict,
        duration_ms: int,
        reference: Optional[str]
    ) -> tuple[float, Dict]:
        """Evaluate how many aspects of query are covered."""
        content = result.get("content", "").lower()
        
        # Extract aspects from query (simplified)
        # For "Python tutorial for beginners"
        # aspects: ["python", "tutorial", "beginners"]
        aspects = [w for w in query.lower().split() if len(w) > 3]
        
        covered = sum(1 for aspect in aspects if aspect in content)
        score = covered / len(aspects) if aspects else 0.0
        
        return score, {
            "aspects": len(aspects),
            "covered": covered,
            "coverage_ratio": score
        }


class EvaluationBenchmark:
    """
    Benchmark suite for systematic evaluation.
    """
    
    def __init__(self):
        self.evaluator = ResolutionEvaluator()
        self.results: List[EvaluatedResolution] = []
    
    async def run_benchmark(
        self,
        test_queries: List[str],
        profile: str = "balanced"
    ) -> Dict:
        """
        Run benchmark on test queries.
        
        Args:
            test_queries: List of queries to test
            profile: Resolution profile to use
            
        Returns:
            Benchmark summary statistics
        """
        from scripts.resolve import resolve
        
        print(f"Running benchmark with {len(test_queries)} queries...")
        print(f"Profile: {profile}")
        print("-" * 60)
        
        for i, query in enumerate(test_queries, 1):
            print(f"[{i}/{len(test_queries)}] Testing: {query[:50]}...")
            
            start = time.time()
            result = resolve(query, profile=profile)
            duration_ms = int((time.time() - start) * 1000)
            
            evaluation = self.evaluator.evaluate(
                query=query,
                result=result,
                duration_ms=duration_ms
            )
            
            self.results.append(evaluation)
            
            print(f"  Source: {result.get('source', 'none')}")
            print(f"  Score: {evaluation.overall_score:.2f}")
            print(f"  Latency: {duration_ms}ms")
            print()
        
        return self._generate_summary()
    
    def _generate_summary(self) -> Dict:
        """Generate benchmark summary."""
        if not self.results:
            return {}
        
        scores = [r.overall_score for r in self.results]
        latencies = [r.duration_ms for r in self.results]
        
        # Calculate metric averages
        metric_scores: Dict[str, List[float]] = {}
        for result in self.results:
            for eval_result in result.evaluations:
                metric_name = eval_result.metric.value
                if metric_name not in metric_scores:
                    metric_scores[metric_name] = []
                metric_scores[metric_name].append(eval_result.score)
        
        summary = {
            "total_queries": len(self.results),
            "overall_score": {
                "mean": sum(scores) / len(scores),
                "median": sorted(scores)[len(scores) // 2],
                "min": min(scores),
                "max": max(scores),
            },
            "latency_ms": {
                "mean": sum(latencies) / len(latencies),
                "median": sorted(latencies)[len(latencies) // 2],
                "p95": sorted(latencies)[int(len(latencies) * 0.95)],
                "min": min(latencies),
                "max": max(latencies),
            },
            "by_metric": {
                metric: {
                    "mean": sum(scores) / len(scores),
                    "min": min(scores),
                    "max": max(scores),
                }
                for metric, scores in metric_scores.items()
            },
            "results": [
                {
                    "query": r.query[:50],
                    "score": r.overall_score,
                    "duration_ms": r.duration_ms,
                    "source": r.result.get("source", "none")
                }
                for r in self.results
            ]
        }
        
        return summary
    
    def export_report(self, filename: str = "evaluation_report.json"):
        """Export detailed report to file."""
        summary = self._generate_summary()
        
        with open(filename, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"Report exported to {filename}")


# Test queries for benchmarking
DEFAULT_BENCHMARK_QUERIES = [
    "Python programming tutorial",
    "What is machine learning",
    "Rust vs Go comparison",
    "Docker containerization guide",
    "API design best practices",
    "PostgreSQL vs MySQL",
    "React hooks tutorial",
    "Kubernetes basics",
    "CI/CD pipeline setup",
    "Microservices architecture",
]


if __name__ == "__main__":
    import asyncio
    
    async def run():
        benchmark = EvaluationBenchmark()
        summary = await benchmark.run_benchmark(
            test_queries=DEFAULT_BENCHMARK_QUERIES[:5],  # Use subset for testing
            profile="free"
        )
        
        print("\n" + "="*60)
        print("BENCHMARK SUMMARY")
        print("="*60)
        print(f"Overall Score: {summary['overall_score']['mean']:.2f}")
        print(f"Mean Latency: {summary['latency_ms']['mean']:.0f}ms")
        print(f"P95 Latency: {summary['latency_ms']['p95']:.0f}ms")
        
        print("\nBy Metric:")
        for metric, stats in summary['by_metric'].items():
            print(f"  {metric}: {stats['mean']:.2f}")
        
        benchmark.export_report()
    
    asyncio.run(run())
```

**New Files:**
- `scripts/evaluation.py` - Evaluation framework
- `tests/test_evaluation.py` - Evaluation tests
- `scripts/benchmark.py` - CLI benchmark runner

**Acceptance Criteria:**
- 6 evaluation metrics implemented
- Overall score calculated with weighted average
- Benchmark suite runs on test queries
- Report generation with JSON export
- Performance metrics tracked

---

## Phase 2: Performance Benchmarking (Week 2)

### Task 2.1: Comprehensive Performance Suite

**Description:** Systematic performance measurement and regression detection.

**Implementation:**

```python
# scripts/performance_suite.py
"""
Comprehensive performance benchmarking suite.
"""

import time
import statistics
import json
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
import psutil
import os

@dataclass
class PerformanceResult:
    test_name: str
    latency_ms: float
    memory_mb: float
    cpu_percent: float
    timestamp: str
    metadata: Dict

class PerformanceSuite:
    """
    Performance testing suite with resource monitoring.
    """
    
    def __init__(self):
        self.results: List[PerformanceResult] = []
        self.process = psutil.Process(os.getpid())
    
    def measure(
        self,
        test_name: str,
        func,
        iterations: int = 10,
        warmup: int = 2
    ) -> PerformanceResult:
        """
        Measure performance of a function.
        
        Args:
            test_name: Name of the test
            func: Function to measure
            iterations: Number of iterations
            warmup: Warmup iterations (not measured)
            
        Returns:
            PerformanceResult with metrics
        """
        # Warmup
        for _ in range(warmup):
            func()
        
        # Measure
        latencies = []
        memory_samples = []
        cpu_samples = []
        
        for _ in range(iterations):
            # Get baseline metrics
            mem_before = self.process.memory_info().rss / 1024 / 1024
            cpu_before = self.process.cpu_percent()
            
            start = time.perf_counter()
            result = func()
            elapsed_ms = (time.perf_counter() - start) * 1000
            
            # Get post metrics
            mem_after = self.process.memory_info().rss / 1024 / 1024
            cpu_after = self.process.cpu_percent()
            
            latencies.append(elapsed_ms)
            memory_samples.append(mem_after - mem_before)
            cpu_samples.append(cpu_after)
        
        # Calculate statistics
        result = PerformanceResult(
            test_name=test_name,
            latency_ms=statistics.median(latencies),
            memory_mb=statistics.mean(memory_samples),
            cpu_percent=statistics.mean(cpu_samples),
            timestamp=datetime.now().isoformat(),
            metadata={
                "iterations": iterations,
                "latency_p95": sorted(latencies)[int(len(latencies) * 0.95)],
                "latency_std": statistics.stdev(latencies) if len(latencies) > 1 else 0,
            }
        )
        
        self.results.append(result)
        return result
    
    def benchmark_resolution(self, urls: List[str], queries: List[str]):
        """Benchmark resolution performance."""
        from scripts.resolve import resolve_url, resolve_query
        
        print("Benchmarking URL resolution...")
        for url in urls:
            result = self.measure(
                f"url:{url}",
                lambda u=url: resolve_url(u, max_chars=1000)
            )
            print(f"  {url}: {result.latency_ms:.0f}ms")
        
        print("\nBenchmarking query resolution...")
        for query in queries:
            result = self.measure(
                f"query:{query[:30]}",
                lambda q=query: resolve_query(q, max_chars=1000, profile="free")
            )
            print(f"  {query[:40]}: {result.latency_ms:.0f}ms")
    
    def generate_report(self) -> Dict:
        """Generate performance report."""
        if not self.results:
            return {}
        
        url_results = [r for r in self.results if r.test_name.startswith("url:")]
        query_results = [r for r in self.results if r.test_name.startswith("query:")]
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": len(self.results),
                "mean_latency_ms": statistics.mean([r.latency_ms for r in self.results]),
                "mean_memory_mb": statistics.mean([r.memory_mb for r in self.results]),
            },
            "url_resolution": {
                "count": len(url_results),
                "mean_latency_ms": statistics.mean([r.latency_ms for r in url_results]) if url_results else 0,
                "p95_latency_ms": sorted([r.latency_ms for r in url_results])[int(len(url_results) * 0.95)] if url_results else 0,
            },
            "query_resolution": {
                "count": len(query_results),
                "mean_latency_ms": statistics.mean([r.latency_ms for r in query_results]) if query_results else 0,
                "p95_latency_ms": sorted([r.latency_ms for r in query_results])[int(len(query_results) * 0.95)] if query_results else 0,
            },
            "details": [
                {
                    "test": r.test_name,
                    "latency_ms": r.latency_ms,
                    "memory_mb": r.memory_mb,
                    "cpu_percent": r.cpu_percent,
                }
                for r in self.results
            ]
        }
        
        return report
    
    def save_report(self, filename: str = "performance_report.json"):
        """Save report to file."""
        report = self.generate_report()
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\nReport saved to {filename}")


if __name__ == "__main__":
    suite = PerformanceSuite()
    
    # Test URLs
    test_urls = [
        "https://example.com",
        "https://docs.python.org",
    ]
    
    # Test queries
    test_queries = [
        "Python tutorial",
        "API design",
    ]
    
    suite.benchmark_resolution(test_urls, test_queries)
    suite.save_report()
```

**Acceptance Criteria:**
- Latency, memory, CPU metrics tracked
- P95 and std deviation calculated
- Report generation with JSON export
- Regression detection support

---

## Summary

### New Files
- `scripts/deep_research.py` - Multi-step research engine
- `scripts/evaluation.py` - Evaluation framework
- `scripts/performance_suite.py` - Performance benchmarking
- `tests/test_deep_research.py` - Research tests
- `tests/test_evaluation.py` - Evaluation tests

### Dependencies
```
psutil>=5.9.0  # For resource monitoring
```

### Success Metrics
- [ ] Deep research executes 3-5 steps
- [ ] Evaluation accuracy >90%
- [ ] Performance benchmarks track all metrics
- [ ] No new providers required
- [ ] All tests pass