# Env Check GitHub Action

Validate environment variables against `.env.example` before deployment. Catch missing or empty env vars in CI/CD before they cause production issues.

## Why Use This?

> "Forgetting to update environment variable is a common problem. Especially if one developer added a new environment variable, you don't know you are missing one."

This action validates your `.env` file against `.env.example` and fails the build if:
- Required variables are missing
- Variables defined in `.env.example` are not in `.env`
- Variables are empty (in strict mode)

## Usage

### Basic Usage

```yaml
- name: Validate environment
  uses: claude-agent-tools/envcheck@v1
  with:
    env-file: '.env'
    example-file: '.env.example'
```

### With Required Variables

```yaml
- name: Validate environment
  uses: claude-agent-tools/envcheck@v1
  with:
    env-file: '.env.production'
    example-file: '.env.example'
    required: 'DATABASE_URL,API_KEY,SECRET_KEY'
    strict: 'true'
```

### Full Example

```yaml
name: Deploy
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create .env from secrets
        run: |
          echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" >> .env
          echo "API_KEY=${{ secrets.API_KEY }}" >> .env

      - name: Validate environment
        uses: claude-agent-tools/envcheck@v1
        with:
          env-file: '.env'
          example-file: '.env.example'
          strict: 'true'

      - name: Deploy
        if: success()
        run: ./deploy.sh
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `env-file` | Path to the .env file to validate | No | `.env` |
| `example-file` | Path to the .env.example file | No | `.env.example` |
| `required` | Comma-separated list of required variables | No | `''` |
| `strict` | Fail on empty values | No | `false` |
| `no-extra` | Fail on variables not in example | No | `false` |
| `fail-on-warning` | Treat warnings as errors | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `valid` | Whether validation passed (`true`/`false`) |
| `errors` | Number of errors found |
| `warnings` | Number of warnings found |
| `missing` | Comma-separated list of missing variables |

## Use Cases

### 1. Pre-deployment Validation

Ensure all required env vars are set before deploying:

```yaml
- name: Check env before deploy
  uses: claude-agent-tools/envcheck@v1
  with:
    required: 'DATABASE_URL,REDIS_URL,API_KEY'
    strict: 'true'
```

### 2. PR Checks

Catch missing env vars in pull requests:

```yaml
on: pull_request

jobs:
  check-env:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check .env.example completeness
        uses: claude-agent-tools/envcheck@v1
        with:
          env-file: '.env.example'
          required: 'DATABASE_URL,API_KEY'
```

### 3. Multiple Environments

Validate different environment files:

```yaml
jobs:
  validate-envs:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        env: [development, staging, production]
    steps:
      - uses: actions/checkout@v4
      - name: Validate ${{ matrix.env }}
        uses: claude-agent-tools/envcheck@v1
        with:
          env-file: '.env.${{ matrix.env }}'
          example-file: '.env.example'
```

## Local Usage

You can also use the CLI directly:

```bash
npm install -g @claude-agent/envcheck
envcheck .env .env.example
```

## License

MIT
