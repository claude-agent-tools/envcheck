const core = require('@actions/core');
const path = require('path');
const fs = require('fs');

// Import envcheck from parent package
const envcheck = require('../src/index.js');

async function run() {
  try {
    // Get inputs
    const envFile = core.getInput('env-file') || '.env';
    const exampleFile = core.getInput('example-file') || '.env.example';
    const requiredInput = core.getInput('required') || '';
    const strict = core.getInput('strict') === 'true';
    const noExtra = core.getInput('no-extra') === 'true';
    const failOnWarning = core.getInput('fail-on-warning') === 'true';

    // Parse required variables
    const required = requiredInput
      ? requiredInput.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // Resolve paths
    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
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
      return;
    }

    // Check options
    const options = {
      required,
      noEmpty: strict,
      noExtra,
      strict
    };

    // Add example file if it exists
    if (fs.existsSync(examplePath)) {
      options.examplePath = examplePath;
    } else {
      core.warning(`Example file not found: ${exampleFile}`);
    }

    // Run check
    const result = envcheck.check(envPath, options);

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
        if (failOnWarning) {
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

    // Determine if we should fail
    const shouldFail = !result.valid || (failOnWarning && result.summary.warnings > 0);

    if (shouldFail) {
      core.setFailed(`Environment validation failed with ${result.summary.errors} error(s)`);
    } else {
      core.info('');
      core.info('✓ Environment validation passed');
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
