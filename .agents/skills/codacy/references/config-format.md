# Codacy Configuration Format

Codacy is configured via a `.codacy.yml` or `.codacy.yaml` file in the repository root.

## Example .codacy.yml

```yaml
---
engines:
  duplication:
    exclude_paths:
      - "web/.next/**"
      - "cli/target/**"
  metric:
    exclude_paths:
      - "tests/**"
languages:
  python:
    enabled: true
  rust:
    enabled: true
exclude_paths:
  - "node_modules/**"
  - "assets/screenshots/**"
```

## Local Validation

You can validate the syntax using:
```bash
codacy-analysis-cli validate-configuration --directory `pwd`
```
