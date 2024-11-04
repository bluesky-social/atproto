import {
  LexiconDoc,
  LexRecord,
  LexUserType,
  LexiconDefNotFoundError,
  InvalidLexiconError,
  ValidationResult,
  ValidationError,
  isObj,
  hasProp,
} from './types'
import {
  assertValidRecord,
  assertValidXrpcParams,
  assertValidXrpcInput,
  assertValidXrpcOutput,
  assertValidXrpcMessage,
} from './validation'
import { toLexUri } from './util'
import * as ComplexValidators from './validators/complex'

/**
 * A collection of compiled lexicons.
 */
export class Lexicons implements Iterable<LexiconDoc> {
  docs: Map<string, LexiconDoc> = new Map()
  defs: Map<string, LexUserType> = new Map()

  constructor(docs?: Iterable<LexiconDoc>) {
    if (docs) {
      for (const doc of docs) {
        this.add(doc)
      }
    }
  }

  /**
   * @example clone a lexicon:
   * ```ts
   * const clone = new Lexicons(originalLexicon)
   * ```
   *
   * @example get docs array:
   * ```ts
   * const docs = Array.from(lexicons)
   * ```
   */
  [Symbol.iterator](): Iterator<LexiconDoc> {
    return this.docs.values()
  }

  /**
   * Add a lexicon doc.
   */
  add(doc: LexiconDoc): void {
    const uri = toLexUri(doc.id)
    if (this.docs.has(uri)) {
      throw new Error(`${uri} has already been registered`)
    }

    // WARNING
    // mutates the object
    // -prf
    resolveRefUris(doc, uri)

    this.docs.set(uri, doc)
    for (const [defUri, def] of iterDefs(doc)) {
      this.defs.set(defUri, def)
    }
  }

  /**
   * Remove a lexicon doc.
   */
  remove(uri: string) {
    uri = toLexUri(uri)
    const doc = this.docs.get(uri)
    if (!doc) {
      throw new Error(`Unable to remove "${uri}": does not exist`)
    }
    for (const [defUri, _def] of iterDefs(doc)) {
      this.defs.delete(defUri)
    }
    this.docs.delete(uri)
  }

  /**
   * Get a lexicon doc.
   */
  get(uri: string): LexiconDoc | undefined {
    uri = toLexUri(uri)
    return this.docs.get(uri)
  }

  /**
   * Get a definition.
   */
  getDef(uri: string): LexUserType | undefined {
    uri = toLexUri(uri)
    return this.defs.get(uri)
  }

  /**
   * Get a def, throw if not found. Throws on not found.
   */
  getDefOrThrow<T extends LexUserType['type'] = LexUserType['type']>(
    uri: string,
    types?: readonly T[],
  ): Extract<LexUserType, { type: T }>
  getDefOrThrow(
    uri: string,
    types?: readonly LexUserType['type'][],
  ): LexUserType {
    const def = this.getDef(uri)
    if (!def) {
      throw new LexiconDefNotFoundError(`Lexicon not found: ${uri}`)
    }
    if (types && !types.includes(def.type)) {
      throw new InvalidLexiconError(
        `Not a ${types.join(' or ')} lexicon: ${uri}`,
      )
    }
    return def
  }

  /**
   * Validate a record or object.
   */
  validate(lexUri: string, value: unknown): ValidationResult {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['record', 'object'])
    if (!isObj(value)) {
      throw new ValidationError(`Value must be an object`)
    }
    if (def.type === 'record') {
      return ComplexValidators.object(this, 'Record', def.record, value)
    } else if (def.type === 'object') {
      return ComplexValidators.object(this, 'Object', def, value)
    } else {
      // shouldn't happen
      throw new InvalidLexiconError('Definition must be a record or object')
    }
  }

  /**
   * Validate a record and throw on any error.
   */
  assertValidRecord(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['record'])
    if (!isObj(value)) {
      throw new ValidationError(`Record must be an object`)
    }
    if (!hasProp(value, '$type') || typeof value.$type !== 'string') {
      throw new ValidationError(`Record/$type must be a string`)
    }
    const $type = (value as Record<string, string>).$type || ''
    if (toLexUri($type) !== lexUri) {
      throw new ValidationError(
        `Invalid $type: must be ${lexUri}, got ${$type}`,
      )
    }
    return assertValidRecord(this, def as LexRecord, value)
  }

  /**
   * Validate xrpc query params and throw on any error.
   */
  assertValidXrpcParams(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, [
      'query',
      'procedure',
      'subscription',
    ])
    return assertValidXrpcParams(this, def, value)
  }

  /**
   * Validate xrpc input body and throw on any error.
   */
  assertValidXrpcInput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['procedure'])
    return assertValidXrpcInput(this, def, value)
  }

  /**
   * Validate xrpc output body and throw on any error.
   */
  assertValidXrpcOutput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['query', 'procedure'])
    return assertValidXrpcOutput(this, def, value)
  }

  /**
   * Validate xrpc subscription message and throw on any error.
   */
  assertValidXrpcMessage<T = unknown>(lexUri: string, value: unknown): T {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['subscription'])
    return assertValidXrpcMessage(this, def, value) as T
  }

  /**
   * Resolve a lex uri given a ref
   */
  resolveLexUri(lexUri: string, ref: string) {
    lexUri = toLexUri(lexUri)
    return toLexUri(ref, lexUri)
  }
}

function* iterDefs(doc: LexiconDoc): Generator<[string, LexUserType]> {
  for (const defId in doc.defs) {
    yield [`lex:${doc.id}#${defId}`, doc.defs[defId]]
    if (defId === 'main') {
      yield [`lex:${doc.id}`, doc.defs[defId]]
    }
  }
}

// WARNING
// this method mutates objects
// -prf
function resolveRefUris(obj: any, baseUri: string): any {
  for (const k in obj) {
    if (obj.type === 'ref') {
      obj.ref = toLexUri(obj.ref, baseUri)
    } else if (obj.type === 'union') {
      obj.refs = obj.refs.map((ref) => toLexUri(ref, baseUri))
    } else if (Array.isArray(obj[k])) {
      obj[k] = obj[k].map((item: any) => {
        if (typeof item === 'string') {
          return item.startsWith('#') ? toLexUri(item, baseUri) : item
        } else if (item && typeof item === 'object') {
          return resolveRefUris(item, baseUri)
        }
        return item
      })
    } else if (obj[k] && typeof obj[k] === 'object') {
      obj[k] = resolveRefUris(obj[k], baseUri)
    }
  }
  return obj
}
