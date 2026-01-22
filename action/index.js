const core = require('@actions/core');
const path = require('path');
const fs = require('fs');

// Import envcheck from parent package
const envcheck = require('../src/index.js');

async function runMonorepo(workspacePath, options) {
  const monorepoPath = core.getInput('monorepo-path') || '.';
  const rootPath = path.resolve(workspacePath, monorepoPath);

  core.info(`Scanning monorepo at ${rootPath}`);

  const result = envcheck.scanMonorepo(rootPath, {
    noEmpty: options.strict,
    noExtra: options.noExtra,
    strict: options.strict,
    detectSecrets: options.detectSecrets,
    checkConsistency: true
  });

  // Set outputs
  core.setOutput('valid', result.valid ? 'true' : 'false');
  core.setOutput('errors', String(result.summary.errors));
  core.setOutput('warnings', String(result.summary.warnings));
  core.setOutput('missing', ''); // Not applicable in monorepo mode
  core.setOutput('apps-scanned', String(result.summary.total));
  core.setOutput('apps-passed', String(result.summary.passed));
  core.setOutput('apps-failed', String(result.summary.failed));

  // Log results per app
  core.info('');
  core.info('=== Monorepo Environment Check ===');

  for (const app of result.apps) {
    if (app.skipped) {
      core.info(`○ ${app.name}: skipped (${app.reason})`);
    } else if (app.valid) {
      core.info(`✓ ${app.name}: passed`);
    } else {
      core.error(`✗ ${app.name}: failed`);
      for (const issue of app.issues) {
        const message = issue.line
          ? `  Line ${issue.line}: ${issue.message}`
          : `  ${issue.message}`;
        if (issue.type === 'error') {
          core.error(message);
        } else {
          core.warning(message);
        }
      }
    }
  }

  // Consistency issues
  if (result.consistency.mismatches.length > 0) {
    core.info('');
    core.warning('Consistency issues found:');
    for (const mismatch of result.consistency.mismatches) {
      core.warning(`  ${mismatch.variable}: ${mismatch.issue}`);
    }
  }

  // Summary
  core.info('');
  core.info('=== Summary ===');
  core.info(`Apps scanned: ${result.summary.total}`);
  core.info(`Passed: ${result.summary.passed}`);
  core.info(`Failed: ${result.summary.failed}`);
  core.info(`Skipped: ${result.summary.skipped}`);
  core.info(`Total errors: ${result.summary.errors}`);
  core.info(`Total warnings: ${result.summary.warnings}`);

  return result;
}

async function runSingleFile(workspacePath, options) {
  const envFile = core.getInput('env-file') || '.env';
  const exampleFile = core.getInput('example-file') || '.env.example';

  const envPath = path.resolve(workspacePath, envFile);
  const examplePath = path.resolve(workspacePath, exampleFile);

  core.info(`Checking ${envFile} against ${exampleFile}`);

  // Check if env file exists
  if (!fs.existsSync(envPath)) {
    core.setFailed(`Environment file not found: ${envFile}`);
    core.setOutput('valid', 'false');
    core.setOutput('errors', '1');
    core.setOutput('warnings', '0');
    core.setOutput('missing', '');
    return { valid: false };
  }

  // Check options
  const checkOptions = {
    required: options.required,
    noEmpty: options.strict,
    noExtra: options.noExtra,
    strict: options.strict,
    detectSecrets: options.detectSecrets
  };

  // Add example file if it exists
  if (fs.existsSync(examplePath)) {
    checkOptions.examplePath = examplePath;
  } else {
    core.warning(`Example file not found: ${exampleFile}`);
  }

  // Run check
  const result = envcheck.check(envPath, checkOptions);

  // Collect missing variables
  const missing = result.comparison?.missing?.map(m => m.key) || [];

  // Set outputs
  core.setOutput('valid', result.valid ? 'true' : 'false');
  core.setOutput('errors', String(result.summary.errors));
  core.setOutput('warnings', String(result.summary.warnings));
  core.setOutput('missing', missing.join(','));

  // Log issues
  for (const issue of result.issues) {
    const message = issue.line
      ? `Line ${issue.line}: ${issue.message}`
      : issue.message;

    if (issue.type === 'error') {
      core.error(message);
    } else if (issue.type === 'warning') {
      if (options.failOnWarning) {
        core.error(message);
      } else {
        core.warning(message);
      }
    }
  }

  // Summary
  core.info('');
  core.info('=== Environment Check Summary ===');
  core.info(`File: ${envFile}`);
  core.info(`Errors: ${result.summary.errors}`);
  core.info(`Warnings: ${result.summary.warnings}`);

  if (missing.length > 0) {
    core.info(`Missing variables: ${missing.join(', ')}`);
  }

  return result;
}

async function run() {
  try {
    // Get inputs
    const requiredInput = core.getInput('required') || '';
    const strict = core.getInput('strict') === 'true';
    const noExtra = core.getInput('no-extra') === 'true';
    const failOnWarning = core.getInput('fail-on-warning') === 'true';
    const monorepo = core.getInput('monorepo') === 'true';
    const detectSecrets = core.getInput('detect-secrets') === 'true';

    // Parse required variables
    const required = requiredInput
      ? requiredInput.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // Resolve workspace path
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();

    const options = {
      required,
      strict,
      noExtra,
      failOnWarning,
      detectSecrets
    };

    let result;
    if (monorepo) {
      result = await runMonorepo(workspacePath, options);
    } else {
      result = await runSingleFile(workspacePath, options);
    }

    // Determine if we should fail
    const shouldFail = !result.valid || (failOnWarning && (result.summary?.warnings || 0) > 0);

    if (shouldFail) {
      const errors = result.summary?.errors || 1;
      core.setFailed(`Environment validation failed with ${errors} error(s)`);
    } else {
      core.info('');
      core.info('✓ Environment validation passed');
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
