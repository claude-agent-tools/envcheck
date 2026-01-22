# envcheck

[![npm version](https://img.shields.io/npm/v/@claude-agent/envcheck.svg)](https://www.npmjs.com/package/@claude-agent/envcheck)
[![npm downloads](https://img.shields.io/npm/dm/@claude-agent/envcheck.svg)](https://www.npmjs.com/package/@claude-agent/envcheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Validate .env files, compare with .env.example, find missing or empty variables.

Never deploy with missing environment variables again.

**Built autonomously by [Claude](https://claude.ai)** - an AI assistant by Anthropic.

## Installation

```bash
npm install -g @claude-agent/envcheck
```

Or use directly with npx:

```bash
npx @claude-agent/envcheck
```

## Quick Start

```bash
# Check .env against .env.example (auto-detected)
envcheck

# Check specific file
envcheck .env.production

# Require specific variables
envcheck -r "DATABASE_URL,API_KEY"

# Compare two files
envcheck compare .env .env.staging

# List variables
envcheck list .env

# Get specific value
envcheck get .env API_KEY
```

## CLI Usage

### Check Command (Default)

```bash
# Auto-detect .env.example in same directory
envcheck

# Specify example file
envcheck -e .env.example.prod .env.production

# Require specific variables
envcheck -r "DB_HOST,DB_USER,DB_PASS"

# Warn on empty values
envcheck --no-empty

# Error on extra variables not in example
envcheck --no-extra

# Treat warnings as errors
envcheck --strict

# JSON output
envcheck -j

# Quiet mode (only errors)
envcheck -q
```

### Compare Command

```bash
# Compare two env files
envcheck compare .env .env.example

# JSON output
envcheck compare .env .env.prod -j
```

### List Command

```bash
# List all variable names
envcheck list .env

# JSON output
envcheck list .env -j
```

### Get Command

```bash
# Get a specific variable value
envcheck get .env DATABASE_URL
```

## API Usage

```javascript
const { check, compare, validate, parse, list, get, generate } = require('@claude-agent/envcheck');

// Full check against example
const result = check('.env', {
  examplePath: '.env.example',
  required: ['DATABASE_URL'],
  noEmpty: true,
  strict: false
});

console.log(result.valid);      // true/false
console.log(result.issues);     // Array of issues
console.log(result.summary);    // { errors: 0, warnings: 0 }

// Compare two files
const diff = compare('.env', '.env.example');
console.log(diff.missing);      // Variables in example but not in env
console.log(diff.extra);        // Variables in env but not in example
console.log(diff.empty);        // Variables that are empty in env

// Validate a single file
const validation = validate('.env', {
  required: ['API_KEY', 'SECRET'],
  noEmpty: true
});

// Parse env content directly
const parsed = parse('FOO=bar\nBAZ=qux');
console.log(parsed.variables);  // { FOO: 'bar', BAZ: 'qux' }

// List variables
const vars = list('.env');      // ['FOO', 'BAZ', ...]

// Get specific variable
const value = get('.env', 'API_KEY');

// Generate .env from example with defaults
const content = generate('.env.example', {
  DATABASE_URL: 'postgres://localhost/mydb',
  API_KEY: 'dev-key'
});
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Errors found (missing vars, invalid syntax, etc.) |

## Example Output

```
$ envcheck
Checking .env against .env.example...

✗ Missing variable 'DATABASE_URL' (defined in example at line 3)
✗ Missing variable 'REDIS_URL' (defined in example at line 5)
! Variable 'API_KEY' is empty (line 7)

2 error(s), 1 warning(s)
```

```
$ envcheck compare .env .env.prod
Comparing .env with .env.prod...

.env: 12 variables
.env.prod: 15 variables

Missing (in example but not in env):
  - NEW_RELIC_KEY
  - SENTRY_DSN
  - CDN_URL

Extra (in env but not in example):
  - DEBUG
```

## Use Cases

- **CI/CD Pipelines**: Validate env before deployment
- **Onboarding**: Check if developer has all required env vars
- **Documentation**: List required variables from example file
- **Debugging**: Compare env files across environments

## CI/CD Integration

### GitHub Action

Use envcheck in your GitHub Actions workflow:

```yaml
- name: Validate environment
  uses: claude-agent-tools/envcheck@v1
  with:
    env-file: '.env'
    example-file: '.env.example'
    required: 'DATABASE_URL,API_KEY'
    strict: 'true'
```

See [action/README.md](./action/README.md) for full documentation.

### Pre-commit Hook

Use with the [pre-commit](https://pre-commit.com/) framework:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: envcheck
        name: Validate environment variables
        entry: npx @claude-agent/envcheck
        language: system
        files: '\.env.*'
        pass_filenames: false
```

Or install the hook directly:

```bash
# Copy hook to git hooks directory
curl -o .git/hooks/pre-commit https://raw.githubusercontent.com/claude-agent-tools/envcheck/master/pre-commit-hook.sh
chmod +x .git/hooks/pre-commit
```

## Type Validation

envcheck supports **static type validation** - validate variable formats without running your app.

### Using Type Hints in .env.example

Add type hints as comments above variables:

```bash
# type: url
DATABASE_URL=postgres://localhost/mydb

# @type port
PORT=3000

# type: boolean
DEBUG=false

# type: email
ADMIN_EMAIL=admin@example.com
```

### Supported Types

| Type | Description | Examples |
|------|-------------|----------|
| `url` | Valid URL | `https://example.com`, `postgres://host/db` |
| `port` | Port number (1-65535) | `3000`, `8080` |
| `boolean`/`bool` | Boolean values | `true`, `false`, `1`, `0`, `yes`, `no` |
| `email` | Email address | `user@example.com` |
| `number` | Any number | `42`, `3.14`, `-10` |
| `integer`/`int` | Whole numbers | `42`, `-10` |
| `json` | Valid JSON | `{"key":"value"}`, `[1,2,3]` |
| `uuid` | UUID format | `550e8400-e29b-41d4-a716-446655440000` |
| `string`/`str` | Any string (no validation) | anything |

### API Usage with Types

```javascript
const { check, validate } = require('@claude-agent/envcheck');

// Explicit type validation
const result = validate('.env', {
  types: {
    DATABASE_URL: 'url',
    PORT: 'port',
    DEBUG: 'boolean'
  }
});

// Types from example file are used automatically
const result2 = check('.env', {
  examplePath: '.env.example'  // Type hints in example are used
});
```

## .env File Format

Supports standard .env syntax:

```bash
# Comments
KEY=value
QUOTED="value with spaces"
MULTILINE="line1\nline2"
EMPTY=
WITH_EQUALS=postgres://user:pass@host/db?opt=val
```

## Why This Tool?

- **Zero dependencies** - Fast install, no bloat
- **Auto-detection** - Finds .env.example automatically
- **CI-friendly** - Exit codes and JSON output
- **Comprehensive** - Parse, validate, compare, generate
- **Well-tested** - 46 tests covering edge cases

## vs. dotenv-safe / envalid

| Feature | envcheck | dotenv-safe | envalid |
|---------|----------|-------------|---------|
| Validates presence | ✅ | ✅ | ✅ |
| Based on .env.example | ✅ | ✅ | ❌ (schema) |
| **Static validation** | ✅ | ❌ | ❌ |
| **CI/CD integration** | ✅ GitHub Action | ❌ | ❌ |
| **Pre-commit hook** | ✅ | ❌ | ❌ |
| Type validation | ✅ (static) | ❌ | ✅ (runtime) |
| Zero dependencies | ✅ | ❌ | ❌ |

**Key difference:** envcheck validates *before* deployment (shift-left), while dotenv-safe and envalid validate at runtime when your app starts. Catch missing env vars and type errors in CI, not in production.

## License

MIT

---

*Part of the [claude-agent-tools](https://github.com/claude-agent-tools) collection.*
