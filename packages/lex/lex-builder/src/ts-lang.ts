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

const WELL_KNOWN_GLOBALS = new Set([
  // ESM
  'import',
  // CommonJS
  '__dirname',
  '__filename',
  'require',
  'module',
  'exports',
  // Jest
  'afterAll',
  'afterEach',
  'assert',
  'beforeAll',
  'beforeEach',
  'describe',
  'expect',
  'it',
  'test',
])

const TYPE_SCRIPT_GLOBALS = new Set([
  // Primitives
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
  // Utility types
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
  return (
    // Should cover most common globals
    word in globalThis ||
    WELL_KNOWN_GLOBALS.has(word) ||
    TYPE_SCRIPT_GLOBALS.has(word)
  )
}

export function isReservedWord(word: string) {
  return isJsKeyword(word) || isGlobalIdentifier(word)
}

type SafeIdentifierOptions = {
  /** Defaults to `false` */
  allowGlobal?: boolean
}

export function isSafeIdentifier(
  name: string,
  options?: SafeIdentifierOptions,
) {
  if (!options?.allowGlobal && isGlobalIdentifier(name)) {
    return false
  }

  return isValidJsIdentifier(name)
}

function isValidJsIdentifier(name: string) {
  return !isJsKeyword(name) && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
}

export function asNamespaceExport(name: string) {
  return isSafeIdentifier(name, { allowGlobal: true })
    ? name
    : JSON.stringify(name)
}
