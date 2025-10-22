import { l } from '../lex/index.js'
import {
  LexiconArray,
  LexiconBase,
  LexiconDocument,
  LexiconObject,
  LexiconParameters,
  LexiconPayload,
  LexiconRef,
  LexiconRefUnion,
} from './lexicon-document.js'
import { LexiconIndexer } from './lexicon-indexer.js'

/**
 * Builds a validator for a given lexicon "ref" from a lexicon indexer.
 *
 * @example
 *
 * ```ts
 * import { LexiconSchemaBuilder } from '@atproto/lex/doc'
 * import { LexiconStreamIndexer } from '@atproto/lex/doc'
 *
 * const indexer = new LexiconStreamIndexer(lexiconDocs)
 * const validator = await LexiconSchemaBuilder.build(indexer, 'com.example.foo#bar')
 * ```
 */
export class LexiconSchemaBuilder {
  static async build(
    indexer: LexiconIndexer,
    fullRef: string,
  ): Promise<l.Validator<unknown>> {
    const ctx = new LexiconSchemaBuilder(indexer)
    try {
      const result = await ctx.buildFullRef(fullRef)
      if (!(result instanceof l.Validator)) {
        throw new Error(`Ref ${fullRef} is not a validator schema type`)
      }
      return result
    } finally {
      await ctx.done()
    }
  }

  static async buildAll(indexer: LexiconIndexer) {
    const builder = new LexiconSchemaBuilder(indexer)
    const schemas = new Map<
      string,
      | l.Validator<unknown>
      | l.Query
      | l.Subscription
      | l.Procedure
      | l.PermissionSet
    >()
    if (!isAsyncIterableObject(indexer)) {
      throw new Error('An iterable indexer is required to build all schemas')
    }
    try {
      for await (const doc of indexer) {
        for (const hash of Object.keys(doc.defs)) {
          const fullRef = `${doc.id}#${hash}`
          const schema = await builder.buildFullRef(fullRef)
          schemas.set(fullRef, schema)
        }
      }
      return schemas
    } finally {
      await builder.done()
    }
  }

  #asyncTasks = new AsyncTasks()

  constructor(protected indexer: LexiconIndexer) {}

  async done(): Promise<void> {
    await this.#asyncTasks.done()
  }

  buildFullRef = memoize(async (fullRef: string) => {
    const { nsid, hash } = parseRef(fullRef)

    const doc = await this.indexer.get(nsid)
    if (!doc) throw new Error(`No lexicon found for NSID: ${nsid}`)

    return this.compileDef(doc, hash)
  })

  protected buildRefGetter(fullRef: string): () => l.Validator<unknown> {
    let validator: l.Validator<unknown>

    this.#asyncTasks.add(
      this.buildFullRef(fullRef).then((v) => {
        if (!(v instanceof l.Validator)) {
          throw new Error(`Only refs to validator schema types are allowed`)
        }
        validator = v
      }),
    )

    return () => {
      if (validator) return validator
      throw new Error('Validator not yet built. Did you await done()?')
    }
  }

  protected buildTypedRefGetter(
    fullRef: string,
  ): () => l.TypedObjectSchema | l.RecordSchema {
    let validator: l.TypedObjectSchema | l.RecordSchema

    this.#asyncTasks.add(
      this.buildFullRef(fullRef).then((v) => {
        if (v instanceof l.TypedObjectSchema || v instanceof l.RecordSchema) {
          validator = v
        } else {
          throw new Error(
            'Only refs to records and object definitions are allowed',
          )
        }
      }),
    )

    return () => {
      if (validator) return validator
      throw new Error('Validator not yet built. Did you await done()?')
    }
  }

  protected compileDef(doc: LexiconDocument, hash: string) {
    const def = Object.hasOwn(doc.defs, hash) ? doc.defs[hash] : null
    if (!def) {
      throw new Error(
        `No definition found for hash "${JSON.stringify(hash)}" in ${doc.id}`,
      )
    }
    switch (def.type) {
      case 'permission-set':
        return l.permissionSet(
          doc.id,
          def.permissions.map(({ resource, type, ...p }) =>
            l.permission(resource, p),
          ),
          def,
        )
      case 'procedure':
        return l.procedure(
          doc.id,
          this.compileParams(doc, def.parameters),
          this.compilePayload(doc, def.input),
          this.compilePayload(doc, def.output),
        )
      case 'query':
        return l.query(
          doc.id,
          this.compileParams(doc, def.parameters),
          this.compilePayload(doc, def.output),
        )
      case 'subscription':
        return l.subscription(
          doc.id,
          this.compileParams(doc, def.parameters),
          this.compilePayloadSchema(doc, def.message?.schema),
        )
      case 'token':
        return l.token(doc.id, hash)
      case 'record':
        return l.record(
          def.key ? l.asRecordKey(def.key) : 'any',
          doc.id,
          this.compileObject(doc, def.record),
        )
      case 'object':
        return l.typedObject(doc.id, hash, this.compileObject(doc, def))
      default:
        return this.compileLeaf(doc, def)
    }
  }

  protected compileLeaf(
    doc: LexiconDocument,
    def: LexiconBase | LexiconArray,
  ): l.Validator<unknown> {
    switch (def.type) {
      case 'string':
        return l.string(def)
      case 'integer':
        return l.integer(def)
      case 'boolean':
        return l.boolean(def)
      case 'blob':
        return l.blob(def)
      case 'cid-link':
        return l.cidLink()
      case 'bytes':
        return l.bytes(def)
      case 'unknown':
        return l.unknown()
      case 'array':
        return l.array(this.compileLeaf(doc, def.items), def)
      default:
        return this.compileRef(doc, def)
    }
  }

  protected compileRef(
    doc: LexiconDocument,
    def: LexiconRef | LexiconRefUnion,
  ) {
    switch (def.type) {
      case 'ref':
        return l.ref(this.buildRefGetter(buildFullRef(doc, def.ref)))
      case 'union':
        return l.typedUnion(
          def.refs.map((r) =>
            l.typedRef(this.buildTypedRefGetter(buildFullRef(doc, r))),
          ),
          def.closed ?? false,
        )
      default:
        // @ts-expect-error
        throw new Error(`Unknown lexicon type: ${def.type}`)
    }
  }

  protected compileObject(
    doc: LexiconDocument,
    def: LexiconObject,
  ): l.ObjectSchema {
    const props: Record<string, l.Validator> = {}
    for (const [key, propDef] of Object.entries(def.properties)) {
      if (propDef === undefined) continue
      props[key] = this.compileLeaf(doc, propDef)
    }
    return l.object(props, def)
  }

  protected compilePayload(
    doc: LexiconDocument,
    def: LexiconPayload | undefined,
  ): l.PayloadSchema {
    return l.payload(
      def?.encoding,
      def?.schema ? this.compilePayloadSchema(doc, def.schema) : undefined,
    )
  }

  protected compilePayloadSchema(
    doc: LexiconDocument,
    def?: LexiconObject | LexiconRef | LexiconRefUnion,
  ) {
    if (!def) return undefined
    switch (def.type) {
      case 'object':
        return this.compileObject(doc, def)
      default:
        return this.compileRef(doc, def)
    }
  }

  protected compileParams(doc: LexiconDocument, def?: LexiconParameters) {
    if (!def) return l.params()

    const props: Record<string, l.Validator> = {}
    for (const [key, propDef] of Object.entries(def.properties)) {
      if (propDef === undefined) continue
      props[key] = this.compileLeaf(doc, propDef)
    }
    return l.params(props, def)
  }
}

class AsyncTasks {
  #promises = new Set<Promise<void>>()

  async done(): Promise<void> {
    const awaited = new Set<Promise<void>>()
    for (const p of this.#promises) {
      awaited.add(p)
      await p
    }

    // If new promises were added while awaiting, wait for those too
    for (const p of this.#promises) {
      if (!awaited.has(p)) return this.done()
    }
  }

  add(p: Promise<void>) {
    const promise = Promise.resolve(p).then(() => {
      // No need to keep the promise any longer
      this.#promises.delete(promise)
    })

    void promise.catch((_err) => {
      // ignore errors here, they should be caught though done()
    })

    this.#promises.add(promise)
  }
}

function parseRef(fullRef: string) {
  const { length, 0: nsid, 1: hash } = fullRef.split('#')
  if (length !== 2) throw new Error('Uri can only have one hash segment')
  if (!nsid || !hash) throw new Error('Invalid ref, missing hash')
  return { nsid, hash }
}

function buildFullRef(from: LexiconDocument, ref: string) {
  if (ref.startsWith('#')) return `${from.id}${ref}`
  return ref
}

export function memoize<Fn extends (arg: string) => unknown>(fn: Fn): Fn {
  const cache = new Map<string, ReturnType<Fn>>()
  return ((arg: string) => {
    if (cache.has(arg)) return cache.get(arg)!
    const result = fn(arg) as ReturnType<Fn>
    cache.set(arg, result)
    return result
  }) as Fn
}

function isAsyncIterableObject<T>(
  obj: T,
): obj is T & object & AsyncIterable<unknown> {
  return (
    obj != null &&
    typeof obj === 'object' &&
    Symbol.asyncIterator in obj &&
    typeof obj[Symbol.asyncIterator] === 'function'
  )
}
