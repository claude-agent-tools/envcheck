#!/bin/bash
# Pre-commit hook for envcheck
# Add to .git/hooks/pre-commit or use with pre-commit framework
#
# Usage with pre-commit framework (.pre-commit-config.yaml):
#   - repo: local
#     hooks:
#       - id: envcheck
#         name: Validate environment variables
#         entry: npx @claude-agent/envcheck
#         language: system
#         files: '\.env.*'
#         pass_filenames: false
#
# Or install directly:
#   cp pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

set -e

# Check if envcheck is available
if command -v envcheck &> /dev/null; then
  ENVCHECK="envcheck"
elif command -v npx &> /dev/null; then
  ENVCHECK="npx @claude-agent/envcheck"
else
  echo "Warning: envcheck not found, skipping env validation"
  exit 0
fi

# Find .env files being committed
ENV_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.env(\..+)?$' || true)

if [ -z "$ENV_FILES" ]; then
  # No .env files being committed
  exit 0
fi

echo "Validating environment files..."

# Run envcheck on each modified env file
for file in $ENV_FILES; do
  if [ -f "$file" ]; then
    echo "Checking $file..."
    $ENVCHECK "$file" --quiet || {
      echo "Error: Environment validation failed for $file"
      exit 1
    }
  fi
done

echo "Environment validation passed"
exit 0
