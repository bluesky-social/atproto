import {
  LexiconDoc,
  lexiconDoc,
  LexRecord,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexUserType,
  LexUserTypeConcrete,
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

  /**
   * Add a lexicon doc.
   */
  add(doc: unknown): void {
    try {
      lexiconDoc.parse(doc)
    } catch (e: any) {
      throw new LexiconDocMalformedError(
        `Failed to parse schema definition`,
        doc,
        e.issues,
      )
    }
    const validatedDoc = doc as LexiconDoc
    const uri = toLexUri(validatedDoc.id)
    if (this.docs.has(uri)) {
      throw new Error(`${uri} has already been registered`)
    }
    this.docs.set(uri, validatedDoc)
    for (const [defUri, def] of iterDefs(validatedDoc)) {
      this.defs.set(defUri, resolveDefUris(def, uri))
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
   * Resolve a def URI to a set of concrete types.
   */
  resolveDef(uri: string): LexUserTypeConcrete[] {
    const def = this.getDef(uri)
    if (!def) {
      throw new LexiconDefNotFoundError(`Lexicon not found: ${uri}`)
    }
    if (Array.isArray(def)) {
      let defs: LexUserTypeConcrete[] = []
      for (const itemUri of def) {
        defs = defs.concat(this.resolveDef(itemUri))
      }
      return defs
    }
    return [def]
  }

  /**
   * Validate a record and throw on any error.
   */
  assertValidRecord(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const defs = this.resolveDef(lexUri)
    if (!defs.every((def) => def.type === 'record')) {
      throw new InvalidLexiconError(`Not a record lexicon: ${lexUri}`)
    }
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
    assertValidRecord(this, defs as LexRecord[], value)
  }

  /**
   * Validate xrpc query params and throw on any error.
   */
  assertValidXrpcParams(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const defs = this.resolveDef(lexUri)
    if (
      !defs.every((def) => def.type === 'query' || def.type === 'procedure')
    ) {
      throw new InvalidLexiconError(
        `Not a query or procedure lexicon: ${lexUri}`,
      )
    }
    assertValidXrpcParams(
      this,
      defs as (LexXrpcProcedure | LexXrpcQuery)[],
      value,
    )
  }

  /**
   * Validate xrpc input body and throw on any error.
   */
  assertValidXrpcInput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const defs = this.resolveDef(lexUri)
    if (!defs.every((def) => def.type === 'procedure')) {
      throw new InvalidLexiconError(`Not a procedure lexicon: ${lexUri}`)
    }
    assertValidXrpcInput(this, defs as LexXrpcProcedure[], value)
  }

  /**
   * Validate xrpc output body and throw on any error.
   */
  assertValidXrpcOutput(lexUri: string, value: unknown) {
    lexUri = toLexUri(lexUri)
    const defs = this.resolveDef(lexUri)
    if (
      !defs.every((def) => def.type === 'query' || def.type === 'procedure')
    ) {
      throw new InvalidLexiconError(
        `Not a query or procedure lexicon: ${lexUri}`,
      )
    }
    assertValidXrpcOutput(
      this,
      defs as (LexXrpcProcedure | LexXrpcQuery)[],
      value,
    )
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
function resolveDefUris(def: LexUserType, baseUri: string): LexUserType {
  if (Array.isArray(def)) {
    return def.map((str) => toLexUri(str, baseUri))
  }
  if (def.type === 'object') {
    if (def.properties) {
      for (const k in def.properties) {
        if (typeof def.properties[k] === 'string') {
          def.properties[k] = toLexUri(def.properties[k] as string, baseUri)
        }
      }
    }
  } else if (def.type === 'array') {
    if (typeof def.items === 'string') {
      def.items = toLexUri(def.items, baseUri)
    } else if (Array.isArray(def.items)) {
      def.items = def.items.map((item) => toLexUri(item, baseUri))
    }
  } else if (def.type === 'record') {
    resolveDefUris(def.record, baseUri)
  } else if (def.type === 'query' || def.type === 'procedure') {
    if (def.output?.schema) {
      if (typeof def.output.schema === 'string') {
        def.output.schema = toLexUri(def.output.schema, baseUri)
      } else if (Array.isArray(def.output.schema)) {
        def.output.schema = def.output.schema.map((item) =>
          toLexUri(item, baseUri),
        )
      } else {
        resolveDefUris(def.output.schema, baseUri)
      }
    }
    if (def.type === 'procedure') {
      if (def.input?.schema) {
        if (typeof def.input.schema === 'string') {
          def.input.schema = toLexUri(def.input.schema, baseUri)
        } else if (Array.isArray(def.input.schema)) {
          def.input.schema = def.input.schema.map((item) =>
            toLexUri(item, baseUri),
          )
        } else {
          resolveDefUris(def.input.schema, baseUri)
        }
      }
    }
  }
  return def
}
