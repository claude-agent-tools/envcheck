'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse a .env file into an object
 * @param {string} content - File content
 * @returns {Object} Parsed variables
 */
function parseEnv(content) {
  const result = {
    variables: {},
    errors: [],
    warnings: [],
    lineInfo: {}
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check for valid format
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      result.errors.push({
        line: lineNum,
        message: `Invalid syntax: missing '=' sign`,
        content: line
      });
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1);

    // Validate key
    if (!key) {
      result.errors.push({
        line: lineNum,
        message: 'Empty variable name',
        content: line
      });
      continue;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      result.warnings.push({
        line: lineNum,
        message: `Variable name '${key}' contains unusual characters`,
        content: line
      });
    }

    // Check for duplicate
    if (key in result.variables) {
      result.warnings.push({
        line: lineNum,
        message: `Duplicate variable '${key}' (previous at line ${result.lineInfo[key]})`,
        content: line
      });
    }

    // Parse value (handle quotes)
    value = parseValue(value);

    result.variables[key] = value;
    result.lineInfo[key] = lineNum;
  }

  return result;
}

/**
 * Parse a value, handling quotes and escapes
 * @param {string} raw - Raw value string
 * @returns {string} Parsed value
 */
function parseValue(raw) {
  let value = raw;

  // Remove inline comments (but not if inside quotes)
  if (!value.startsWith('"') && !value.startsWith("'")) {
    const hashIndex = value.indexOf(' #');
    if (hashIndex !== -1) {
      value = value.slice(0, hashIndex);
    }
  }

  value = value.trim();

  // Handle quoted values
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
    // Handle escape sequences in double quotes
    if (raw.trim().startsWith('"')) {
      value = value.replace(/\\n/g, '\n')
                   .replace(/\\r/g, '\r')
                   .replace(/\\t/g, '\t')
                   .replace(/\\\\/g, '\\')
                   .replace(/\\"/g, '"');
    }
  }

  return value;
}

/**
 * Read and parse a .env file
 * @param {string} filePath - Path to file
 * @returns {Object} Parsed result
 */
function readEnvFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      exists: false,
      path: absolutePath,
      variables: {},
      errors: [{ message: `File not found: ${absolutePath}` }],
      warnings: [],
      lineInfo: {}
    };
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const result = parseEnv(content);
  result.exists = true;
  result.path = absolutePath;

  return result;
}

/**
 * Compare two env files
 * @param {string} envPath - Path to .env file
 * @param {string} examplePath - Path to .env.example file
 * @returns {Object} Comparison result
 */
function compare(envPath, examplePath) {
  const env = readEnvFile(envPath);
  const example = readEnvFile(examplePath);

  const result = {
    env,
    example,
    missing: [],      // In example but not in env
    extra: [],        // In env but not in example
    empty: [],        // In both but empty in env
    different: []     // Different values (if example has values)
  };

  if (!env.exists || !example.exists) {
    return result;
  }

  const envKeys = new Set(Object.keys(env.variables));
  const exampleKeys = new Set(Object.keys(example.variables));

  // Find missing (in example but not in env)
  for (const key of exampleKeys) {
    if (!envKeys.has(key)) {
      result.missing.push({
        key,
        exampleValue: example.variables[key],
        line: example.lineInfo[key]
      });
    }
  }

  // Find extra (in env but not in example)
  for (const key of envKeys) {
    if (!exampleKeys.has(key)) {
      result.extra.push({
        key,
        value: env.variables[key],
        line: env.lineInfo[key]
      });
    }
  }

  // Find empty values
  for (const key of envKeys) {
    if (exampleKeys.has(key) && env.variables[key] === '') {
      result.empty.push({
        key,
        line: env.lineInfo[key]
      });
    }
  }

  return result;
}

/**
 * Validate an env file
 * @param {string} filePath - Path to .env file
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validate(filePath, options = {}) {
  const { required = [], noEmpty = false } = options;

  const env = readEnvFile(filePath);

  const result = {
    valid: true,
    env,
    issues: []
  };

  if (!env.exists) {
    result.valid = false;
    result.issues.push({
      type: 'error',
      message: `File not found: ${filePath}`
    });
    return result;
  }

  // Check for parse errors
  if (env.errors.length > 0) {
    result.valid = false;
    for (const error of env.errors) {
      result.issues.push({
        type: 'error',
        line: error.line,
        message: error.message
      });
    }
  }

  // Check required variables
  for (const key of required) {
    if (!(key in env.variables)) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        message: `Missing required variable: ${key}`
      });
    } else if (env.variables[key] === '') {
      result.valid = false;
      result.issues.push({
        type: 'error',
        line: env.lineInfo[key],
        message: `Required variable '${key}' is empty`
      });
    }
  }

  // Check for empty values
  if (noEmpty) {
    for (const [key, value] of Object.entries(env.variables)) {
      if (value === '' && !required.includes(key)) {
        result.issues.push({
          type: 'warning',
          line: env.lineInfo[key],
          message: `Variable '${key}' is empty`
        });
      }
    }
  }

  // Add warnings
  for (const warning of env.warnings) {
    result.issues.push({
      type: 'warning',
      line: warning.line,
      message: warning.message
    });
  }

  return result;
}

/**
 * Check an env file against example and validate
 * @param {string} envPath - Path to .env
 * @param {Object} options - Check options
 * @returns {Object} Check result
 */
function check(envPath, options = {}) {
  const {
    examplePath = null,
    required = [],
    noEmpty = false,
    noExtra = false,
    strict = false
  } = options;

  const result = {
    valid: true,
    issues: [],
    summary: {
      errors: 0,
      warnings: 0
    }
  };

  // First validate the env file
  const validation = validate(envPath, { required, noEmpty });

  if (!validation.valid) {
    result.valid = false;
  }

  result.issues.push(...validation.issues);
  result.env = validation.env;

  // Then compare with example if provided
  if (examplePath) {
    const comparison = compare(envPath, examplePath);
    result.comparison = comparison;

    // Missing variables are errors
    for (const item of comparison.missing) {
      result.valid = false;
      result.issues.push({
        type: 'error',
        message: `Missing variable '${item.key}' (defined in example at line ${item.line})`
      });
    }

    // Empty variables are warnings (or errors in strict mode)
    for (const item of comparison.empty) {
      const type = strict ? 'error' : 'warning';
      if (strict) result.valid = false;
      result.issues.push({
        type,
        line: item.line,
        message: `Variable '${item.key}' is empty`
      });
    }

    // Extra variables are warnings (or errors if noExtra)
    if (noExtra) {
      for (const item of comparison.extra) {
        result.valid = false;
        result.issues.push({
          type: 'error',
          line: item.line,
          message: `Extra variable '${item.key}' not in example`
        });
      }
    }
  }

  // Count issues
  for (const issue of result.issues) {
    if (issue.type === 'error') {
      result.summary.errors++;
    } else {
      result.summary.warnings++;
    }
  }

  return result;
}

/**
 * Generate a template .env from .env.example
 * @param {string} examplePath - Path to example file
 * @param {Object} defaults - Default values to fill in
 * @returns {string} Generated .env content
 */
function generate(examplePath, defaults = {}) {
  const example = readEnvFile(examplePath);

  if (!example.exists) {
    throw new Error(`Example file not found: ${examplePath}`);
  }

  const lines = [];

  for (const [key, value] of Object.entries(example.variables)) {
    const newValue = key in defaults ? defaults[key] : value;
    lines.push(`${key}=${newValue}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Get list of variables from file
 * @param {string} filePath - Path to env file
 * @returns {string[]} Variable names
 */
function list(filePath) {
  const env = readEnvFile(filePath);
  return Object.keys(env.variables);
}

/**
 * Get a specific variable value
 * @param {string} filePath - Path to env file
 * @param {string} key - Variable name
 * @returns {string|undefined} Value or undefined
 */
function get(filePath, key) {
  const env = readEnvFile(filePath);
  return env.variables[key];
}

module.exports = {
  parse: parseEnv,
  parseValue,
  readEnvFile,
  compare,
  validate,
  check,
  generate,
  list,
  get
};
