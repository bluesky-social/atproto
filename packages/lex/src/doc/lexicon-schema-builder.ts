import { l } from '../lex/index.js'
import {
  LexiconArray,
  LexiconBase,
  LexiconDoc,
  LexiconObject,
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
  ): Promise<l.LexValidator<unknown>> {
    const ctx = new LexiconSchemaBuilder(indexer)
    try {
      return await ctx.buildRef(fullRef)
    } finally {
      await ctx.done()
    }
  }

  static async buildAll(
    indexer: LexiconIndexer,
  ): Promise<Map<string, l.LexValidator<unknown>>> {
    const builder = new LexiconSchemaBuilder(indexer)
    const schemas = new Map<string, l.LexValidator<unknown>>()
    if (!l.isAsyncIterableObject(indexer)) {
      throw new Error('An iterable indexer is required to build all schemas')
    }
    try {
      for await (const doc of indexer) {
        for (const hash of Object.keys(doc.defs)) {
          const fullRef = `${doc.id}#${hash}`
          const schema = await builder.buildRef(fullRef)
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

  buildRef = memoize(
    async (fullRef: string): Promise<l.LexValidator<unknown>> => {
      const { nsid, hash } = parseRef(fullRef)

      const doc = await this.indexer.get(nsid)
      if (!doc) throw new Error(`No lexicon found for NSID: ${nsid}`)

      return this.buildDef(doc, hash)
    },
  )

  protected ref(fullRef: string): () => l.LexValidator<unknown> {
    let validator: l.LexValidator<unknown>

    this.#asyncTasks.add(
      this.buildRef(fullRef).then((v) => {
        validator = v
      }),
    )

    return () => validator
  }

  protected typedRef(fullRef: string): () => l.LexTypedObject | l.LexRecord {
    let validator: l.LexTypedObject | l.LexRecord

    this.#asyncTasks.add(
      this.buildRef(fullRef).then((v) => {
        if (v instanceof l.LexTypedObject || v instanceof l.LexRecord) {
          validator = v
        } else {
          throw new Error(
            'Only refs to records and object definitions are allowed',
          )
        }
      }),
    )

    return () => validator
  }

  protected buildDef(doc: LexiconDoc, hash: string): l.LexValidator<unknown> {
    const def = Object.hasOwn(doc.defs, hash) ? doc.defs[hash] : null
    if (!def) {
      throw new Error(`No definition found for hash: ${hash} in ${doc.id}`)
    }
    switch (def.type) {
      case 'query':
      case 'procedure':
      case 'subscription':
      case 'permission-set':
        throw new Error(`${def.type} definitions cannot be built into a schema`)
      case 'token':
        return l.token(doc.id, hash)
      case 'record':
        return l.record(
          l.asLexRecordKey(def.key),
          doc.id,
          this.buildObject(doc, def.record),
        )
      case 'object':
        return l.typedObject(doc.id, hash, this.buildObject(doc, def))
      default:
        return this.buildLeaf(doc, def)
    }
  }

  protected buildLeaf(
    doc: LexiconDoc,
    def: LexiconBase | LexiconArray,
  ): l.LexValidator<unknown> {
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
        return l.array(this.buildLeaf(doc, def.items), def)
      case 'ref':
        return l.ref(this.ref(buildFullRef(doc, def.ref)))
      case 'union':
        return l.typedUnion(
          def.refs.map((r) => l.typedRef(this.typedRef(buildFullRef(doc, r)))),
          def.closed ?? false,
        )
      default:
        // @ts-expect-error
        throw new Error(`Unknown lexicon type: ${def.type}`)
    }
  }

  protected buildObject(doc: LexiconDoc, def: LexiconObject): l.LexObject {
    const props: Record<string, l.LexValidator> = {}
    for (const [key, propDef] of Object.entries(def.properties ?? {})) {
      if (propDef === undefined) continue
      props[key] = this.buildLeaf(doc, propDef)
    }
    return l.object(props, def)
  }
}

class AsyncTasks {
  #promises = new Set<Promise<void>>()

  async done(): Promise<void> {
    await Promise.all(this.#promises)
  }

  add(p: Promise<void>) {
    const promise = Promise.resolve(p).then(
      () => {
        // No need to keep the promise any longer
        this.#promises.delete(promise)
      },
      () => {
        // ignore errors here, they should be caught though done()
      },
    )
    this.#promises.add(promise)
  }
}

function parseRef(fullRef: string) {
  const { 0: nsid, 1: hash } = fullRef.split('#')
  if (!nsid || !hash) throw new Error('Invalid ref, missing hash')
  return { nsid, hash }
}

function buildFullRef(from: LexiconDoc, ref: string) {
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
