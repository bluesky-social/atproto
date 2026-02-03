/**
 * JavaScript keywords
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

export function isGlobalIdentifier(word: string) {
  return GLOBAL_IDENTIFIERS.has(word)
}

export function isSafeLocalIdentifier(name: string) {
  return !isGlobalIdentifier(name) && isValidJsIdentifier(name)
}

export function isValidJsIdentifier(name: string) {
  return (
    name.length > 0 &&
    !isJsKeyword(name) &&
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
  )
}

export function asNamespaceExport(name: string) {
  return isValidJsIdentifier(name) ? name : JSON.stringify(name)
}
