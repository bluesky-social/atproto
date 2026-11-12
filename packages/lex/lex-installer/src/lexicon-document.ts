import {
  type LexiconDocument,
  type LexiconParameters,
  type LexiconPermission,
  type LexiconRef,
  type LexiconRefUnion,
  type LexiconUnknown,
  type MainLexiconDefinition,
  type NamedLexiconDefinition,
  lexiconDocumentSchema,
} from '@atproto/lex-document'
import { NSID } from '@atproto/syntax'
import { isEnoentError, readJsonFile } from './fs.js'

export async function readLexiconDocument(
  path: string,
): Promise<null | LexiconDocument> {
  try {
    const json = await readJsonFile(path)
    return lexiconDocumentSchema.parse(json)
  } catch (err) {
    if (isEnoentError(err)) return null
    throw err
  }
}

export function* listDocumentNsidRefs(
  doc: LexiconDocument,
  options?: DefRefsOptions,
): Iterable<NSID> {
  try {
    for (const def of Object.values(doc.defs)) {
      if (def) {
        for (const ref of defRefs(def, options)) {
          const [nsid] = ref.split('#', 1)
          if (nsid) yield NSID.from(nsid)
        }
      }
    }
  } catch (cause) {
    throw new Error(`Failed to extract refs from lexicon ${doc.id}`, { cause })
  }
}

type DefRefsOptions = {
  /**
   * Determines whether to include token references in string `knownValues` when
   * listing lexicon dependencies.
   */
  includeKnownValues?: boolean

  includePermissionRpc?: boolean
  includePermissionRepo?: boolean

  /**
   * Determines whether to include the space type and collections of `space`
   * permissions when listing lexicon dependencies.
   */
  includePermissionSpace?: boolean

  /**
   * Determines whether to include the collections declared by `space`
   * definitions when listing lexicon dependencies.
   */
  includeScopeCollections?: boolean
}

function* defRefs(
  def:
    | MainLexiconDefinition
    | NamedLexiconDefinition
    | LexiconPermission
    | LexiconUnknown
    | LexiconParameters
    | LexiconRef
    | LexiconRefUnion,
  options?: DefRefsOptions,
): Iterable<string> {
  switch (def.type) {
    case 'string':
      if (def.knownValues && options?.includeKnownValues) {
        for (const val of def.knownValues) {
          // Tokens ?
          const { length, 0: nsid, 1: hash } = val.split('#')
          if (length === 2 && hash) {
            try {
              NSID.from(nsid)
              yield val
            } catch {
              // ignore invalid nsid
            }
          }
        }
      }
      return
    case 'array':
      return yield* defRefs(def.items, options)
    case 'params':
    case 'object':
      for (const prop of Object.values(def.properties)) {
        yield* defRefs(prop, options)
      }
      return
    case 'union':
      yield* def.refs
      return
    case 'ref': {
      yield def.ref
      return
    }
    case 'record':
      yield* defRefs(def.record, options)
      return
    case 'procedure':
      if (def.input?.schema) {
        yield* defRefs(def.input.schema, options)
      }
    // fallthrough
    case 'query':
      if (def.output?.schema) {
        yield* defRefs(def.output.schema, options)
      }
    // fallthrough
    case 'subscription':
      if (def.parameters) {
        yield* defRefs(def.parameters, options)
      }
      if ('message' in def && def.message?.schema) {
        yield* defRefs(def.message.schema, options)
      }
      return
    case 'permission-set':
      for (const permission of def.permissions) {
        yield* defRefs(permission, options)
      }
      return
    case 'space':
      if (options?.includeScopeCollections) {
        yield* def.collections
      }
      return
    case 'permission':
      if (def.resource === 'rpc') {
        if (options?.includePermissionRpc && Array.isArray(def.lxm)) {
          for (const lxm of def.lxm) {
            if (typeof lxm === 'string') {
              yield lxm
            }
          }
        }
      } else if (def.resource === 'repo') {
        if (options?.includePermissionRepo && Array.isArray(def.collection)) {
          for (const lxm of def.collection) {
            if (typeof lxm === 'string') {
              yield lxm
            }
          }
        }
      } else if (def.resource === 'space') {
        if (options?.includePermissionSpace) {
          if (typeof def.spaceType === 'string') {
            yield def.spaceType
          }
          if (Array.isArray(def.collection)) {
            for (const collection of def.collection) {
              if (typeof collection === 'string') {
                yield collection
              }
            }
          }
        }
      }
      return
    case 'boolean':
    case 'cid-link':
    case 'token':
    case 'bytes':
    case 'blob':
    case 'integer':
    case 'unknown':
      // @NOTE We explicitly list all types here to ensure exhaustiveness
      // causing TS to error if a new type is added without updating this switch
      return
    default:
      // @ts-expect-error
      throw new Error(`Unknown lexicon def type: ${def.type}`)
  }
}
