import { ZodError } from 'zod'
import {
  LexiconDoc,
  lexiconDoc,
  LexRecord,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexUserType,
  LexiconDocMalformedError,
  LexiconDefNotFoundError,
  InvalidLexiconError,
  ValidationError,
  isObj,
  hasProp,
} from './types'
import {
  assertValidRecord,
  assertValidXrpcParams,
  assertValidXrpcInput,
  assertValidXrpcOutput,
} from './validation'
import { toLexUri } from './util'

/**
 * A collection of compiled lexicons.
 */
export class Lexicons {
  docs: Map<string, LexiconDoc> = new Map()
  defs: Map<string, LexUserType> = new Map()

  constructor(docs?: unknown[]) {
    if (docs?.length) {
      for (const doc of docs) {
        this.add(doc)
      }
    }
  }

  /**
   * Add a lexicon doc.
   */
  add(doc: unknown): void {
    try {
      lexiconDoc.parse(doc)
    } catch (e) {
      if (e instanceof ZodError) {
        throw new LexiconDocMalformedError(
          `Failed to parse schema definition ${
            (doc as Record<string, string>).id
          }`,
          doc,
          e.issues,
        )
      } else {
        throw e
      }
    }
    const validatedDoc = doc as LexiconDoc
    const uri = toLexUri(validatedDoc.id)
    if (this.docs.has(uri)) {
      throw new Error(`${uri} has already been registered`)
    }

    // WARNING
    // mutates the object
    // -prf
    resolveDefUris(validatedDoc, uri)

    this.docs.set(uri, validatedDoc)
    for (const [defUri, def] of iterDefs(validatedDoc)) {
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
  getDefOrThrow(uri: string, types?: string[]): LexUserType {
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
    assertValidRecord(this, def as LexRecord, value)
  }

  /**
   * Validate xrpc query params and throw on any error.
   */
  assertValidXrpcParams(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['query', 'procedure'])
    assertValidXrpcParams(this, def as LexXrpcProcedure | LexXrpcQuery, value)
  }

  /**
   * Validate xrpc input body and throw on any error.
   */
  assertValidXrpcInput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['procedure'])
    assertValidXrpcInput(this, def as LexXrpcProcedure, value)
  }

  /**
   * Validate xrpc output body and throw on any error.
   */
  assertValidXrpcOutput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const def = this.getDefOrThrow(lexUri, ['query', 'procedure'])
    assertValidXrpcOutput(this, def as LexXrpcProcedure | LexXrpcQuery, value)
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
function resolveDefUris(obj: any, baseUri: string): any {
  for (const k in obj) {
    if (typeof obj[k] === 'string') {
      if (obj[k].startsWith('#')) {
        obj[k] = toLexUri(obj[k], baseUri)
      }
    } else if (Array.isArray(obj[k])) {
      obj[k] = obj[k].map((item: any) => {
        if (typeof item === 'string') {
          return item.startsWith('#') ? toLexUri(item, baseUri) : item
        } else if (item && typeof item === 'object') {
          return resolveDefUris(item, baseUri)
        }
        return item
      })
    } else if (obj[k] && typeof obj[k] === 'object') {
      obj[k] = resolveDefUris(obj[k], baseUri)
    }
  }
  return obj
}
