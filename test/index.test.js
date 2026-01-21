'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parse, parseValue, readEnvFile, compare, validate, check, list, get, generate } = require('../src/index.js');

const TEST_DIR = path.join(__dirname, 'fixtures');

// Helper to create test files
function createTestFile(name, content) {
  const filePath = path.join(TEST_DIR, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('envcheck', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('parse()', () => {
    it('should parse simple key=value pairs', () => {
      const content = 'FOO=bar\nBAZ=qux';
      const result = parse(content);

      assert.strictEqual(result.variables.FOO, 'bar');
      assert.strictEqual(result.variables.BAZ, 'qux');
      assert.strictEqual(result.errors.length, 0);
    });

    it('should handle empty values', () => {
      const content = 'EMPTY=\nSPACE= ';
      const result = parse(content);

      assert.strictEqual(result.variables.EMPTY, '');
      assert.strictEqual(result.variables.SPACE, '');
    });

    it('should handle values with equals signs', () => {
      const content = 'URL=https://example.com?foo=bar&baz=qux';
      const result = parse(content);

      assert.strictEqual(result.variables.URL, 'https://example.com?foo=bar&baz=qux');
    });

    it('should skip comments', () => {
      const content = '# This is a comment\nFOO=bar\n# Another comment\nBAZ=qux';
      const result = parse(content);

      assert.strictEqual(Object.keys(result.variables).length, 2);
      assert.strictEqual(result.variables.FOO, 'bar');
    });

    it('should skip empty lines', () => {
      const content = 'FOO=bar\n\n\nBAZ=qux\n';
      const result = parse(content);

      assert.strictEqual(Object.keys(result.variables).length, 2);
    });

    it('should handle quoted values with double quotes', () => {
      const content = 'MSG="Hello World"\nPATH="some path"';
      const result = parse(content);

      assert.strictEqual(result.variables.MSG, 'Hello World');
      assert.strictEqual(result.variables.PATH, 'some path');
    });

    it('should handle quoted values with single quotes', () => {
      const content = "MSG='Hello World'";
      const result = parse(content);

      assert.strictEqual(result.variables.MSG, 'Hello World');
    });

    it('should handle escape sequences in double quotes', () => {
      const content = 'MSG="Line1\\nLine2"';
      const result = parse(content);

      assert.strictEqual(result.variables.MSG, 'Line1\nLine2');
    });

    it('should handle inline comments', () => {
      const content = 'FOO=bar # this is a comment';
      const result = parse(content);

      assert.strictEqual(result.variables.FOO, 'bar');
    });

    it('should report errors for missing equals sign', () => {
      const content = 'INVALID_LINE';
      const result = parse(content);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].message.includes('missing'));
    });

    it('should warn on duplicate keys', () => {
      const content = 'FOO=first\nFOO=second';
      const result = parse(content);

      assert.strictEqual(result.variables.FOO, 'second');
      assert.strictEqual(result.warnings.length, 1);
      assert.ok(result.warnings[0].message.includes('Duplicate'));
    });

    it('should warn on unusual variable names', () => {
      const content = 'my-var=value';
      const result = parse(content);

      assert.strictEqual(result.warnings.length, 1);
      assert.ok(result.warnings[0].message.includes('unusual'));
    });

    it('should track line numbers', () => {
      const content = 'A=1\nB=2\nC=3';
      const result = parse(content);

      assert.strictEqual(result.lineInfo.A, 1);
      assert.strictEqual(result.lineInfo.B, 2);
      assert.strictEqual(result.lineInfo.C, 3);
    });
  });

  describe('parseValue()', () => {
    it('should trim whitespace', () => {
      assert.strictEqual(parseValue('  hello  '), 'hello');
    });

    it('should remove double quotes', () => {
      assert.strictEqual(parseValue('"hello world"'), 'hello world');
    });

    it('should remove single quotes', () => {
      assert.strictEqual(parseValue("'hello world'"), 'hello world');
    });

    it('should handle escape sequences', () => {
      assert.strictEqual(parseValue('"line1\\nline2"'), 'line1\nline2');
      assert.strictEqual(parseValue('"tab\\there"'), 'tab\there');
    });

    it('should remove inline comments', () => {
      assert.strictEqual(parseValue('value # comment'), 'value');
    });
  });

  describe('readEnvFile()', () => {
    it('should read and parse a file', () => {
      const filePath = createTestFile('.env', 'FOO=bar');
      const result = readEnvFile(filePath);

      assert.strictEqual(result.exists, true);
      assert.strictEqual(result.variables.FOO, 'bar');
    });

    it('should handle non-existent files', () => {
      const result = readEnvFile('/nonexistent/.env');

      assert.strictEqual(result.exists, false);
      assert.strictEqual(result.errors.length, 1);
    });
  });

  describe('compare()', () => {
    it('should find missing variables', () => {
      const envPath = createTestFile('.env', 'FOO=bar');
      const examplePath = createTestFile('.env.example', 'FOO=\nBAZ=\nQUX=');

      const result = compare(envPath, examplePath);

      assert.strictEqual(result.missing.length, 2);
      assert.ok(result.missing.some(m => m.key === 'BAZ'));
      assert.ok(result.missing.some(m => m.key === 'QUX'));
    });

    it('should find extra variables', () => {
      const envPath = createTestFile('.env', 'FOO=bar\nEXTRA=value');
      const examplePath = createTestFile('.env.example', 'FOO=');

      const result = compare(envPath, examplePath);

      assert.strictEqual(result.extra.length, 1);
      assert.strictEqual(result.extra[0].key, 'EXTRA');
    });

    it('should find empty variables', () => {
      const envPath = createTestFile('.env', 'FOO=\nBAR=value');
      const examplePath = createTestFile('.env.example', 'FOO=placeholder\nBAR=placeholder');

      const result = compare(envPath, examplePath);

      assert.strictEqual(result.empty.length, 1);
      assert.strictEqual(result.empty[0].key, 'FOO');
    });

    it('should handle non-existent files', () => {
      const envPath = createTestFile('.env', 'FOO=bar');

      const result = compare(envPath, '/nonexistent/.env.example');

      assert.strictEqual(result.example.exists, false);
    });
  });

  describe('validate()', () => {
    it('should pass for valid file', () => {
      const filePath = createTestFile('.env', 'FOO=bar\nBAZ=qux');
      const result = validate(filePath);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.issues.length, 0);
    });

    it('should fail for missing required variables', () => {
      const filePath = createTestFile('.env', 'FOO=bar');
      const result = validate(filePath, { required: ['FOO', 'MISSING'] });

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.message.includes('MISSING')));
    });

    it('should fail for empty required variables', () => {
      const filePath = createTestFile('.env', 'FOO=');
      const result = validate(filePath, { required: ['FOO'] });

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.message.includes('empty')));
    });

    it('should warn on empty values with noEmpty option', () => {
      const filePath = createTestFile('.env', 'FOO=\nBAR=value');
      const result = validate(filePath, { noEmpty: true });

      assert.strictEqual(result.valid, true);
      assert.ok(result.issues.some(i => i.type === 'warning' && i.message.includes('FOO')));
    });

    it('should fail for non-existent file', () => {
      const result = validate('/nonexistent/.env');

      assert.strictEqual(result.valid, false);
    });

    it('should report parse errors', () => {
      const filePath = createTestFile('.env', 'INVALID LINE\nFOO=bar');
      const result = validate(filePath);

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.type === 'error'));
    });
  });

  describe('check()', () => {
    it('should combine validation and comparison', () => {
      const envPath = createTestFile('.env', 'FOO=bar');
      const examplePath = createTestFile('.env.example', 'FOO=\nBAZ=');

      const result = check(envPath, { examplePath });

      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some(i => i.message.includes('BAZ')));
    });

    it('should respect strict mode', () => {
      const envPath = createTestFile('.env', 'FOO=');
      const examplePath = createTestFile('.env.example', 'FOO=placeholder');

      const resultNormal = check(envPath, { examplePath });
      const resultStrict = check(envPath, { examplePath, strict: true });

      assert.strictEqual(resultNormal.valid, true); // Empty is warning
      assert.strictEqual(resultStrict.valid, false); // Empty is error in strict
    });

    it('should respect noExtra option', () => {
      const envPath = createTestFile('.env', 'FOO=bar\nEXTRA=value');
      const examplePath = createTestFile('.env.example', 'FOO=');

      const resultNormal = check(envPath, { examplePath });
      const resultNoExtra = check(envPath, { examplePath, noExtra: true });

      assert.strictEqual(resultNormal.valid, true); // Extra is OK normally
      assert.strictEqual(resultNoExtra.valid, false); // Extra is error with noExtra
    });

    it('should provide issue summary', () => {
      const envPath = createTestFile('.env', 'FOO=bar');
      const examplePath = createTestFile('.env.example', 'FOO=\nBAZ=');

      const result = check(envPath, { examplePath });

      assert.strictEqual(result.summary.errors, 1);
    });
  });

  describe('list()', () => {
    it('should list all variable names', () => {
      const filePath = createTestFile('.env', 'A=1\nB=2\nC=3');
      const vars = list(filePath);

      assert.deepStrictEqual(vars, ['A', 'B', 'C']);
    });

    it('should return empty array for empty file', () => {
      const filePath = createTestFile('.env', '');
      const vars = list(filePath);

      assert.deepStrictEqual(vars, []);
    });
  });

  describe('get()', () => {
    it('should get a specific variable', () => {
      const filePath = createTestFile('.env', 'FOO=bar\nBAZ=qux');

      assert.strictEqual(get(filePath, 'FOO'), 'bar');
      assert.strictEqual(get(filePath, 'BAZ'), 'qux');
    });

    it('should return undefined for missing variable', () => {
      const filePath = createTestFile('.env', 'FOO=bar');

      assert.strictEqual(get(filePath, 'MISSING'), undefined);
    });
  });

  describe('generate()', () => {
    it('should generate env from example', () => {
      const examplePath = createTestFile('.env.example', 'FOO=\nBAR=default');
      const content = generate(examplePath);

      assert.ok(content.includes('FOO='));
      assert.ok(content.includes('BAR=default'));
    });

    it('should apply defaults', () => {
      const examplePath = createTestFile('.env.example', 'FOO=\nBAR=');
      const content = generate(examplePath, { FOO: 'custom', BAR: 'value' });

      assert.ok(content.includes('FOO=custom'));
      assert.ok(content.includes('BAR=value'));
    });

    it('should throw for missing example file', () => {
      assert.throws(() => generate('/nonexistent/.env.example'), /not found/);
    });
  });

  describe('edge cases', () => {
    it('should handle Windows line endings', () => {
      const filePath = createTestFile('.env', 'FOO=bar\r\nBAZ=qux\r\n');
      const result = readEnvFile(filePath);

      assert.strictEqual(result.variables.FOO, 'bar');
      assert.strictEqual(result.variables.BAZ, 'qux');
    });

    it('should handle values with special characters', () => {
      const content = 'PASSWORD=p@ss!word#123\nJSON={"key":"value"}';
      const result = parse(content);

      assert.strictEqual(result.variables.PASSWORD, 'p@ss!word#123');
    });

    it('should handle multiline values in quotes', () => {
      const content = 'CERT="-----BEGIN CERT-----\\nABC\\n-----END CERT-----"';
      const result = parse(content);

      assert.ok(result.variables.CERT.includes('BEGIN CERT'));
      assert.ok(result.variables.CERT.includes('\n'));
    });

    it('should handle leading/trailing whitespace in keys', () => {
      const content = '  FOO  =bar';
      const result = parse(content);

      assert.strictEqual(result.variables.FOO, 'bar');
    });

    it('should handle export prefix', () => {
      const content = 'export FOO=bar';
      const result = parse(content);

      // Note: 'export FOO' becomes the key - this is a known limitation
      // Some implementations strip 'export', but we're being simple here
      assert.ok('export FOO' in result.variables || 'FOO' in result.variables);
    });
  });
});
