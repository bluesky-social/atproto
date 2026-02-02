/**
 * Set of JavaScript reserved keywords and future reserved words.
 *
 * These identifiers cannot be used as variable or type names in generated code.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar}
 */
const JS_KEYWORDS = new Set([
  'abstract',
  'arguments',
  'as',
  'async',
  'await',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'double',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'final',
  'finally',
  'float',
  'for',
  'from',
  'function',
  'get',
  'goto',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'int',
  'interface',
  'let',
  'long',
  'native',
  'new',
  'null',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'set',
  'short',
  'static',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'true',
  'try',
  'typeof',
  'undefined',
  'using',
  'var',
  'void',
  'volatile',
  'while',
  'with',
  'yield',
])

/**
 * Checks if a word is a JavaScript reserved keyword.
 *
 * @param word - The identifier to check
 * @returns `true` if the word is a reserved keyword
 */
export function isJsKeyword(word: string) {
  return JS_KEYWORDS.has(word)
}

// Only important to list var/type names that are likely to be used in the
// generated code files.
const GLOBAL_IDENTIFIERS = new Set([
  // import { l } from "@atproto/lex-schema"
  'l',
  // JS Globals
  'self',
  'globalThis',
  // ESM
  'import',
  // CommonJS
  '__dirname',
  '__filename',
  'require',
  'module',
  'exports',
  // TS Primitives
  'any',
  'bigint',
  'boolean',
  'declare',
  'never',
  'null',
  'number',
  'object',
  'string',
  'symbol',
  'undefined',
  'unknown',
  'void',
  // TS Utility types
  'Record',
  'Partial',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'InstanceType',
  'ReturnType',
  'Required',
  'ThisType',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
])

/**
 * Checks if a word is a global identifier that should be avoided.
 *
 * This includes JavaScript globals, TypeScript built-in types, and
 * identifiers commonly used in the generated code.
 *
 * @param word - The identifier to check
 * @returns `true` if the word is a global identifier
 */
export function isGlobalIdentifier(word: string) {
  return GLOBAL_IDENTIFIERS.has(word)
}

/**
 * Checks if a name is safe to use as a local identifier.
 *
 * A safe local identifier is a valid JavaScript identifier that does not
 * conflict with global identifiers.
 *
 * @param name - The identifier to check
 * @returns `true` if the name is safe to use locally
 */
export function isSafeLocalIdentifier(name: string) {
  return !isGlobalIdentifier(name) && isValidJsIdentifier(name)
}

/**
 * Checks if a name is a valid JavaScript identifier.
 *
 * Valid identifiers start with a letter, underscore, or dollar sign,
 * followed by any combination of letters, digits, underscores, or dollar
 * signs. Reserved keywords are not valid identifiers.
 *
 * @param name - The string to check
 * @returns `true` if the name is a valid identifier
 */
export function isValidJsIdentifier(name: string) {
  return (
    name.length > 0 &&
    !isJsKeyword(name) &&
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
  )
}

/**
 * Converts a name to a valid namespace export identifier.
 *
 * If the name is a valid JavaScript identifier, it is returned as-is.
 * Otherwise, it is returned as a quoted string for use in export statements
 * like `export { foo as "unsafe-name" }`.
 *
 * @param name - The export name
 * @returns The name as a valid export identifier
 */
export function asNamespaceExport(name: string) {
  return isValidJsIdentifier(name) ? name : JSON.stringify(name)
}
