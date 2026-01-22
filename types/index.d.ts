/**
 * Type definitions for @claude-agent/envcheck
 * Static environment variable validation for Node.js
 */

// ============================================================================
// Basic Types
// ============================================================================

/**
 * Validation type names supported by envcheck
 */
export type ValidationType =
  | 'url'
  | 'port'
  | 'boolean'
  | 'bool'
  | 'email'
  | 'number'
  | 'integer'
  | 'int'
  | 'string'
  | 'str'
  | 'json'
  | 'uuid';

/**
 * Issue severity level
 */
export type IssueType = 'error' | 'warning';

/**
 * Issue found during validation
 */
export interface Issue {
  type: IssueType;
  message: string;
  line?: number;
}

/**
 * Result of type validation
 */
export interface TypeValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Type validator function
 */
export type TypeValidator = (value: string) => TypeValidationResult;

// ============================================================================
// Parse Types
// ============================================================================

/**
 * Result of parsing a .env file
 */
export interface ParseResult {
  variables: Record<string, string>;
  errors: Array<{
    line: number;
    message: string;
    content: string;
  }>;
  warnings: Array<{
    line: number;
    message: string;
    content: string;
  }>;
  lineInfo: Record<string, number>;
  typeHints: Record<string, string>;
}

/**
 * Result of reading an env file
 */
export interface EnvFileResult extends ParseResult {
  exists: boolean;
  path: string;
}

// ============================================================================
// Compare Types
// ============================================================================

/**
 * Item missing from env file
 */
export interface MissingItem {
  key: string;
  exampleValue: string;
  line: number;
}

/**
 * Extra item in env file
 */
export interface ExtraItem {
  key: string;
  value: string;
  line: number;
}

/**
 * Empty item in env file
 */
export interface EmptyItem {
  key: string;
  line: number;
}

/**
 * Result of comparing two env files
 */
export interface CompareResult {
  env: EnvFileResult;
  example: EnvFileResult;
  missing: MissingItem[];
  extra: ExtraItem[];
  empty: EmptyItem[];
  different: Array<{
    key: string;
    envValue: string;
    exampleValue: string;
  }>;
}

// ============================================================================
// Validate Types
// ============================================================================

/**
 * Options for validate function
 */
export interface ValidateOptions {
  /** List of required variable names */
  required?: string[];
  /** Warn on empty values */
  noEmpty?: boolean;
  /** Type specifications for variables */
  types?: Record<string, ValidationType>;
  /** Enable type validation from hints */
  validateTypes?: boolean;
  /** Enable secret detection */
  detectSecrets?: boolean;
}

/**
 * Result of validation
 */
export interface ValidateResult {
  valid: boolean;
  env: EnvFileResult;
  issues: Issue[];
}

// ============================================================================
// Check Types
// ============================================================================

/**
 * Options for check function
 */
export interface CheckOptions {
  /** Path to example file */
  examplePath?: string;
  /** List of required variable names */
  required?: string[];
  /** Warn on empty values */
  noEmpty?: boolean;
  /** Error on extra variables */
  noExtra?: boolean;
  /** Treat warnings as errors */
  strict?: boolean;
  /** Type specifications for variables */
  types?: Record<string, ValidationType>;
  /** Enable type validation */
  validateTypes?: boolean;
  /** Enable secret detection */
  detectSecrets?: boolean;
}

/**
 * Result of check function
 */
export interface CheckResult {
  valid: boolean;
  issues: Issue[];
  summary: {
    errors: number;
    warnings: number;
  };
  env?: EnvFileResult;
  comparison?: CompareResult;
}

// ============================================================================
// Secret Detection Types
// ============================================================================

/**
 * Secret pattern definition
 */
export interface SecretPattern {
  regex: RegExp;
  description: string;
  keyPattern?: RegExp;
}

/**
 * Result of secret detection
 */
export interface SecretDetectionResult {
  detected: boolean;
  description: string;
  message: string;
}

// ============================================================================
// Monorepo Types
// ============================================================================

/**
 * Options for monorepo scanning
 */
export interface ScanMonorepoOptions {
  /** Warn on empty values */
  noEmpty?: boolean;
  /** Error on extra variables */
  noExtra?: boolean;
  /** Treat warnings as errors */
  strict?: boolean;
  /** Check consistency across apps */
  checkConsistency?: boolean;
  /** Enable secret detection */
  detectSecrets?: boolean;
}

/**
 * Result for a single app in monorepo scan
 */
export interface MonorepoAppResult {
  name: string;
  path: string;
  hasEnv: boolean;
  hasExample: boolean;
  valid: boolean;
  issues: Issue[];
  variables: string[];
  skipped?: boolean;
  reason?: string;
}

/**
 * Consistency mismatch in monorepo
 */
export interface ConsistencyMismatch {
  variable: string;
  issue: string;
  details: Array<{
    app: string;
    type: string | null;
    value?: string;
  }>;
}

/**
 * Result of scanning a monorepo
 */
export interface MonorepoScanResult {
  root: string;
  valid: boolean;
  apps: MonorepoAppResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    warnings: number;
  };
  consistency: {
    sharedVars: Record<string, string[]>;
    mismatches: ConsistencyMismatch[];
  };
}

/**
 * Options for formatting monorepo result
 */
export interface FormatMonorepoOptions {
  /** Enable ANSI colors */
  colors?: boolean;
  /** Show detailed issues */
  verbose?: boolean;
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Parse .env file content into an object
 * @param content - Raw .env file content
 * @returns Parsed result with variables and metadata
 */
export function parse(content: string): ParseResult;

/**
 * Parse a single value, handling quotes and escapes
 * @param raw - Raw value string
 * @returns Parsed value
 */
export function parseValue(raw: string): string;

/**
 * Read and parse a .env file
 * @param filePath - Path to .env file
 * @returns Parsed file result
 */
export function readEnvFile(filePath: string): EnvFileResult;

/**
 * Compare two env files
 * @param envPath - Path to .env file
 * @param examplePath - Path to .env.example file
 * @returns Comparison result
 */
export function compare(envPath: string, examplePath: string): CompareResult;

/**
 * Validate an env file
 * @param filePath - Path to .env file
 * @param options - Validation options
 * @returns Validation result
 */
export function validate(filePath: string, options?: ValidateOptions): ValidateResult;

/**
 * Validate a value against a type
 * @param value - Value to validate
 * @param type - Type name
 * @returns Validation result
 */
export function validateType(value: string, type: ValidationType): TypeValidationResult;

/**
 * Check an env file against example and validate
 * @param envPath - Path to .env file
 * @param options - Check options
 * @returns Check result
 */
export function check(envPath: string, options?: CheckOptions): CheckResult;

/**
 * Generate a .env file from .env.example
 * @param examplePath - Path to .env.example
 * @param defaults - Default values to fill in
 * @returns Generated .env content
 */
export function generate(examplePath: string, defaults?: Record<string, string>): string;

/**
 * Get list of variable names from file
 * @param filePath - Path to env file
 * @returns Array of variable names
 */
export function list(filePath: string): string[];

/**
 * Get a specific variable value
 * @param filePath - Path to env file
 * @param key - Variable name
 * @returns Value or undefined
 */
export function get(filePath: string, key: string): string | undefined;

/**
 * Detect potential secrets in environment variables
 * @param key - Variable name
 * @param value - Variable value
 * @returns Detection result or null if no secret detected
 */
export function detectSecret(key: string, value: string): SecretDetectionResult | null;

/**
 * Check if a value looks like a placeholder
 * @param value - Value to check
 * @returns True if it looks like a placeholder
 */
export function isPlaceholder(value: string): boolean;

/**
 * Find directories that might contain apps/packages in a monorepo
 * @param rootDir - Root directory to scan
 * @returns Array of directory paths
 */
export function findMonorepoApps(rootDir: string): string[];

/**
 * Scan a monorepo for env file issues
 * @param rootDir - Root directory of monorepo
 * @param options - Scan options
 * @returns Monorepo scan result
 */
export function scanMonorepo(rootDir: string, options?: ScanMonorepoOptions): MonorepoScanResult;

/**
 * Format monorepo result for CLI output
 * @param result - Monorepo scan result
 * @param options - Format options
 * @returns Formatted string
 */
export function formatMonorepoResult(result: MonorepoScanResult, options?: FormatMonorepoOptions): string;

// ============================================================================
// Exported Constants
// ============================================================================

/**
 * Map of type names to validator functions
 */
export const typeValidators: Record<ValidationType, TypeValidator>;

/**
 * Array of secret detection patterns
 */
export const secretPatterns: SecretPattern[];
