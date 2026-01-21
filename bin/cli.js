#!/usr/bin/env node
'use strict';

const { check, compare, validate, list, get, readEnvFile } = require('../src/index.js');
const path = require('path');
const fs = require('fs');

const VERSION = '1.0.0';

const HELP = `
envcheck - Validate .env files

USAGE
  envcheck [options] [file]
  envcheck compare <env> <example>

COMMANDS
  check (default)    Check .env file, optionally against .env.example
  compare            Compare two env files
  list               List variables in a file
  get <key>          Get a specific variable value

OPTIONS
  -e, --example <file>   Compare with example file (default: .env.example)
  -r, --required <vars>  Comma-separated required variables
  --no-empty             Warn on empty values
  --no-extra             Error on variables not in example
  --strict               Treat warnings as errors
  -q, --quiet            Only output errors
  -j, --json             Output as JSON
  -v, --version          Show version
  -h, --help             Show this help

EXAMPLES
  envcheck                          Check .env against .env.example
  envcheck .env.production          Check specific file
  envcheck -r "API_KEY,DB_URL"      Require specific variables
  envcheck compare .env .env.prod   Compare two files
  envcheck list .env                List all variables
  envcheck get .env API_KEY         Get specific value
`;

function parseArgs(args) {
  const result = {
    command: 'check',
    file: '.env',
    example: null,
    required: [],
    noEmpty: false,
    noExtra: false,
    strict: false,
    quiet: false,
    json: false,
    args: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      console.log(HELP);
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      console.log(VERSION);
      process.exit(0);
    }

    if (arg === '-e' || arg === '--example') {
      result.example = args[++i];
    } else if (arg === '-r' || arg === '--required') {
      result.required = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--no-empty') {
      result.noEmpty = true;
    } else if (arg === '--no-extra') {
      result.noExtra = true;
    } else if (arg === '--strict') {
      result.strict = true;
    } else if (arg === '-q' || arg === '--quiet') {
      result.quiet = true;
    } else if (arg === '-j' || arg === '--json') {
      result.json = true;
    } else if (arg === 'compare' || arg === 'list' || arg === 'get') {
      result.command = arg;
    } else if (!arg.startsWith('-')) {
      result.args.push(arg);
    }

    i++;
  }

  // Handle positional args based on command
  if (result.command === 'check' && result.args.length > 0) {
    result.file = result.args[0];
  }

  return result;
}

function formatIssue(issue) {
  const prefix = issue.type === 'error' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m!\x1b[0m';
  const line = issue.line ? `:${issue.line}` : '';
  return `${prefix} ${issue.message}${line ? ` (line ${issue.line})` : ''}`;
}

function runCheck(opts) {
  // Auto-detect example file
  let examplePath = opts.example;
  if (!examplePath) {
    const dir = path.dirname(path.resolve(opts.file));
    const candidates = ['.env.example', '.env.sample', '.env.template', 'env.example'];
    for (const candidate of candidates) {
      const p = path.join(dir, candidate);
      if (fs.existsSync(p)) {
        examplePath = p;
        break;
      }
    }
  }

  const result = check(opts.file, {
    examplePath,
    required: opts.required,
    noEmpty: opts.noEmpty,
    noExtra: opts.noExtra,
    strict: opts.strict
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }

  if (!opts.quiet) {
    const fileName = path.basename(opts.file);
    if (examplePath) {
      console.log(`Checking ${fileName} against ${path.basename(examplePath)}...\n`);
    } else {
      console.log(`Checking ${fileName}...\n`);
    }
  }

  if (result.issues.length === 0) {
    if (!opts.quiet) {
      console.log('\x1b[32m✓\x1b[0m All checks passed');
    }
    return 0;
  }

  // Group by type
  const errors = result.issues.filter(i => i.type === 'error');
  const warnings = result.issues.filter(i => i.type === 'warning');

  for (const issue of errors) {
    console.log(formatIssue(issue));
  }

  if (!opts.quiet) {
    for (const issue of warnings) {
      console.log(formatIssue(issue));
    }
  }

  console.log();
  if (errors.length > 0) {
    console.log(`\x1b[31m${errors.length} error(s)\x1b[0m${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}`);
  } else {
    console.log(`\x1b[33m${warnings.length} warning(s)\x1b[0m`);
  }

  return result.valid ? 0 : 1;
}

function runCompare(opts) {
  if (opts.args.length < 2) {
    console.error('Usage: envcheck compare <env> <example>');
    return 1;
  }

  const [envPath, examplePath] = opts.args;
  const result = compare(envPath, examplePath);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`Comparing ${path.basename(envPath)} with ${path.basename(examplePath)}...\n`);

  if (!result.env.exists) {
    console.log(`\x1b[31m✗\x1b[0m File not found: ${envPath}`);
    return 1;
  }

  if (!result.example.exists) {
    console.log(`\x1b[31m✗\x1b[0m File not found: ${examplePath}`);
    return 1;
  }

  const envCount = Object.keys(result.env.variables).length;
  const exampleCount = Object.keys(result.example.variables).length;

  console.log(`${path.basename(envPath)}: ${envCount} variables`);
  console.log(`${path.basename(examplePath)}: ${exampleCount} variables\n`);

  if (result.missing.length > 0) {
    console.log('\x1b[31mMissing (in example but not in env):\x1b[0m');
    for (const item of result.missing) {
      console.log(`  - ${item.key}`);
    }
    console.log();
  }

  if (result.extra.length > 0) {
    console.log('\x1b[33mExtra (in env but not in example):\x1b[0m');
    for (const item of result.extra) {
      console.log(`  - ${item.key}`);
    }
    console.log();
  }

  if (result.empty.length > 0) {
    console.log('\x1b[33mEmpty (defined but empty in env):\x1b[0m');
    for (const item of result.empty) {
      console.log(`  - ${item.key}`);
    }
    console.log();
  }

  if (result.missing.length === 0 && result.extra.length === 0 && result.empty.length === 0) {
    console.log('\x1b[32m✓\x1b[0m Files are in sync');
  }

  return result.missing.length > 0 ? 1 : 0;
}

function runList(opts) {
  const file = opts.args[0] || opts.file;
  const vars = list(file);

  if (opts.json) {
    console.log(JSON.stringify(vars, null, 2));
    return 0;
  }

  if (vars.length === 0) {
    console.log('No variables found');
    return 0;
  }

  for (const v of vars) {
    console.log(v);
  }

  return 0;
}

function runGet(opts) {
  if (opts.args.length < 2) {
    console.error('Usage: envcheck get <file> <key>');
    return 1;
  }

  const [file, key] = opts.args;
  const value = get(file, key);

  if (value === undefined) {
    if (!opts.quiet) {
      console.error(`Variable '${key}' not found`);
    }
    return 1;
  }

  console.log(value);
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  let exitCode = 0;

  switch (opts.command) {
    case 'check':
      exitCode = runCheck(opts);
      break;
    case 'compare':
      exitCode = runCompare(opts);
      break;
    case 'list':
      exitCode = runList(opts);
      break;
    case 'get':
      exitCode = runGet(opts);
      break;
    default:
      console.error(`Unknown command: ${opts.command}`);
      exitCode = 1;
  }

  process.exit(exitCode);
}

main();
