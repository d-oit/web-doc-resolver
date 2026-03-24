---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
license: MIT
---

# Skill Creator

Create and improve skills. A skill extends capabilities with specialized knowledge, workflows, and tools.

## Core Loop

1. **Capture intent** - What should the skill do? When should it trigger?
2. **Write draft** - Create SKILL.md with frontmatter and instructions
3. **Create test cases** - 2-3 realistic prompts users would actually say
4. **Run evals** - Test with-skill vs baseline (or old version)
5. **Review results** - Use eval-viewer for human review + benchmarks
6. **Iterate** - Improve based on feedback until satisfied
7. **Optimize description** - Fine-tune frontmatter for better triggering

## Skill Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions (<250 lines)
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons)
```

### Frontmatter

```yaml
---
name: my-skill
description: Clear description of what the skill does AND when to use it.
---
```

Make descriptions "pushy" to avoid undertriggering. Include specific triggers.

### Progressive Disclosure

1. **Metadata** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<500 lines)
3. **Bundled resources** - As needed (scripts can execute without loading)

Keep SKILL.md under 500 lines. Use references/ for additional detail.

## Creating Test Cases

After writing the draft, create 2-3 realistic test prompts. Save to `evals/evals.json`:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": [],
      "expectations": ["The output includes X"]
    }
  ]
}
```

## Running Evals

### Step 1: Spawn all runs in parallel

For each test case, spawn two subagents - one with skill, one without (baseline).

**Workspace structure:**
```
<skill-name>-workspace/
└── iteration-1/
    ├── eval-0/
    │   ├── with_skill/outputs/
    │   ├── without_skill/outputs/
    │   └── eval_metadata.json
    └── timing.json
```

### Step 2: Capture timing data

When subagent tasks complete, save timing.json immediately:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

### Step 3: Grade and aggregate

1. Grade each run with grader subagent (read `agents/grader.md`)
2. Run `python -m scripts.aggregate_benchmark <workspace>/iteration-N`
3. Launch viewer: `python eval-viewer/generate_review.py <workspace>`

### Step 4: Review with user

The viewer shows qualitative outputs and quantitative benchmarks. User provides feedback via text boxes. Read feedback from `feedback.json` when complete.

## Improving Skills

Based on feedback:
1. **Generalize** - Don't overfit to specific examples
2. **Remove bloat** - Keep the prompt lean
3. **Explain why** - LLMs understand reasoning, not just rules
4. **Bundle repeated work** - If all test cases write similar scripts, add them to scripts/

Then iterate: rerun evals, review, improve again.

## Description Optimization

After the skill is working well, optimize the frontmatter description for better triggering:

1. **Generate eval queries** - 20 queries (8-10 should-trigger, 8-10 should-not-trigger). Realistic, specific, with file paths, context. Include near-misses that share keywords but need something different.

2. **Run optimization loop**:
```bash
python -m scripts.run_loop \
  --eval-set <path/to/queries.json> \
  --skill-path <path/to/skill> \
  --model <current-model> \
  --max-iterations 5 \
  --verbose
```

3. **Apply best description** - Update SKILL.md frontmatter

## Reference Files

- `agents/grader.md` - How to evaluate assertions against outputs
- `agents/comparator.md` - Blind A/B comparison between outputs
- `agents/analyzer.md` - Post-hoc analysis and benchmark analysis
- `references/schemas.md` - JSON structures for evals.json, grading.json, etc.

## Packaging

```bash
python -m scripts.package_skill <path/to/skill-folder>
```

Creates a .skill file for distribution.