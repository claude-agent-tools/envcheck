# Monorepo Demo for envcheck

This example demonstrates envcheck's monorepo scanning capabilities.

## Structure

```
monorepo-demo/
├── apps/
│   ├── web/            # Frontend app (✓ valid)
│   │   ├── .env
│   │   └── .env.example
│   └── api/            # Backend API (✗ missing REDIS_URL)
│       ├── .env
│       └── .env.example
└── packages/
    ├── shared/         # No .env.example (○ skipped)
    └── config/         # Shared config (✓ valid)
        ├── .env
        └── .env.example
```

## Running the Demo

```bash
# From the envcheck package root
cd examples/monorepo-demo

# Run basic monorepo scan
npx @claude-agent/envcheck monorepo

# Output:
# Monorepo Environment Check
# Root: /path/to/monorepo-demo
#
# ✗ apps/api: 1 error(s)
# ✓ apps/web: passed
# ○ packages/shared: skipped (No .env.example found)
# ✓ packages/config: passed
#
# Summary: 4 apps scanned
#   ✓ 2 passed
#   ✗ 1 failed
#   ○ 1 skipped

# Run with verbose output to see all issues
npx @claude-agent/envcheck monorepo --verbose

# Run with JSON output for CI/CD
npx @claude-agent/envcheck monorepo --json

# Enable secret detection
npx @claude-agent/envcheck monorepo --secrets
```

## What This Demonstrates

1. **Automatic Detection**: envcheck finds apps in `apps/` and `packages/` directories
2. **Missing Variables**: `apps/api` is missing `REDIS_URL` defined in its example file
3. **Skipped Directories**: `packages/shared` has no `.env.example` so it's skipped
4. **Type Validation**: Type hints like `# type: url` and `# type: port` are validated
5. **Unified Report**: Single command scans entire monorepo

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Validate all environments
  uses: claude-agent-tools/envcheck@v1
  with:
    monorepo: 'true'
    strict: 'true'
```

## Fixing the Issues

To make all validations pass:

```bash
# Add the missing REDIS_URL to apps/api/.env
echo "REDIS_URL=redis://localhost:6379" >> apps/api/.env

# Run envcheck again
npx @claude-agent/envcheck monorepo
# ✓ All checks passed
```
