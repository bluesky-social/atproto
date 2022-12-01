import { SourceFile, VariableDeclarationKind } from 'ts-morph'
import { relative as getRelativePath } from 'path'
import {
  Lexicons,
  LexUserType,
  LexObject,
  LexArray,
  LexPrimitive,
  LexBlobVariant,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexToken,
} from '@atproto/lexicon'
import { toTitleCase, toScreamingSnakeCase } from './util'

interface Commentable<T> {
  addJsDoc: ({ description }: { description: string }) => T
}
export function genComment<T>(
  commentable: Commentable<T>,
  def: LexUserType,
): T {
  if (def.description) {
    commentable.addJsDoc({ description: def.description })
  }
  return commentable as T
}

export function genImports(
  file: SourceFile,
  imports: Set<string>,
  baseNsid: string,
) {
  const startPath = '/' + baseNsid.split('.').slice(0, -1).join('/')

  for (const nsid of imports) {
    const targetPath = '/' + nsid.split('.').join('/')
    let resolvedPath = getRelativePath(startPath, targetPath)
    if (!resolvedPath.startsWith('.')) {
      resolvedPath = `./${resolvedPath}`
    }
    file.addImportDeclaration({
      moduleSpecifier: resolvedPath,
      namespaceImport: toTitleCase(nsid),
    })
  }
}

export function genUserType(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri)
  switch (def.type) {
    case 'array':
      genArray(file, imports, lexUri, def)
      break
    case 'token':
      genToken(file, lexUri, def)
      break
    case 'object':
      genObject(file, imports, lexUri, def)
      break

    case 'blob':
    case 'image':
    case 'video':
    case 'audio':
    case 'boolean':
    case 'number':
    case 'integer':
    case 'string':
    case 'unknown':
      genPrimitiveOrBlob(file, lexUri, def)
      break

    default:
      throw new Error(
        `genLexUserType() called with wrong definition type (${def.type}) in ${lexUri}`,
      )
  }
}

export function genObject(
  file: SourceFile,
  imports: Set<string>,
  lexUri: string,
  def: LexObject,
  ifaceName?: string,
) {
  const iface = file.addInterface({
    name: ifaceName || toTitleCase(getHash(lexUri)),
    isExported: true,
  })
  genComment(iface, def)
  if (def.properties) {
    for (const propKey in def.properties) {
      const req = def.required?.includes(propKey)
      const propDef = def.properties[propKey]
      if (typeof propDef === 'string' || Array.isArray(propDef)) {
        //= propName: External|External
        const refs = Array.isArray(propDef) ? propDef : [propDef]
        iface.addProperty({
          name: `${propKey}${req ? '' : '?'}`,
          type: refs
            .map((ref) =>
              refToType(ref, stripScheme(stripHash(lexUri)), imports),
            )
            .join('|'),
        })
        continue
      } else if (propDef && typeof propDef === 'object') {
        if (propDef.type === 'array') {
          //= propName: type[]
          let propAst
          if (typeof propDef.items === 'string') {
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `${refToType(
                propDef.items,
                stripScheme(stripHash(lexUri)),
                imports,
              )}[]`,
            })
          } else if (Array.isArray(propDef.items)) {
            const types = propDef.items.map((item) =>
              refToType(item, stripScheme(stripHash(lexUri)), imports),
            )
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `(${types.join('|')})[]`,
            })
          } else if (typeof propDef.items === 'object') {
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `${primitiveOrBlobToType(propDef.items)}[]`,
            })
          } else {
            throw new Error(
              `Unexpected items definition in ${lexUri}: ${typeof propDef.items}`,
            )
          }
          genComment(propAst, propDef)
        } else {
          //= propName: type
          genComment(
            iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: primitiveOrBlobToType(propDef),
            }),
            propDef,
          )
        }
      } else {
        throw new Error(
          `Unexpected property definition in ${lexUri}: ${typeof propDef}`,
        )
      }
    }
    //= [k: string]: unknown
    iface.addIndexSignature({
      keyName: 'k',
      keyType: 'string',
      returnType: 'unknown',
    })
  }
}

export function genToken(file: SourceFile, lexUri: string, def: LexToken) {
  genComment(
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: toScreamingSnakeCase(getHash(lexUri)),
          initializer: `"${stripScheme(lexUri)}"`,
        },
      ],
    }),
    def,
  )
}

export function genArray(
  file: SourceFile,
  imports: Set<string>,
  lexUri: string,
  def: LexArray,
) {
  if (typeof def.items === 'string') {
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `${refToType(
        def.items,
        stripScheme(stripHash(lexUri)),
        imports,
      )}[]`,
      isExported: true,
    })
  } else if (Array.isArray(def.items)) {
    const types = def.items.map((item) =>
      refToType(item, stripScheme(stripHash(lexUri)), imports),
    )
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `(${types.join('|')})[]`,
      isExported: true,
    })
  } else if (typeof def.items === 'object') {
    genComment(
      file.addTypeAlias({
        name: toTitleCase(getHash(lexUri)),
        type: `${primitiveOrBlobToType(def.items)}[]`,
        isExported: true,
      }),
      def,
    )
  } else {
    throw new Error(
      `Unexpected items definition in ${lexUri}: ${typeof def.items}`,
    )
  }
}

export function genPrimitiveOrBlob(
  file: SourceFile,
  lexUri: string,
  def: LexPrimitive | LexBlobVariant,
) {
  genComment(
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: primitiveOrBlobToType(def),
      isExported: true,
    }),
    def,
  )
}

export function genXrpcParams(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'procedure',
  ]) as LexXrpcQuery

  //= export interface QueryParams {...}
  const iface = file.addInterface({
    name: 'QueryParams',
    isExported: true,
  })
  if (def.parameters) {
    for (const paramKey in def.parameters.properties) {
      const req = def.parameters.required?.includes(paramKey)
      const paramDef = def.parameters.properties[paramKey]
      genComment(
        iface.addProperty({
          name: `${paramKey}${req ? '' : '?'}`,
          type: primitiveToType(paramDef),
        }),
        paramDef,
      )
    }
  }
}

export function genXrpcInput(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'procedure',
  ]) as LexXrpcProcedure

  if (def.input?.schema) {
    if (
      typeof def.input.schema === 'string' ||
      Array.isArray(def.input.schema)
    ) {
      //= export type InputSchema = ...
      const refs = Array.isArray(def.input.schema)
        ? def.input.schema
        : [def.input.schema]
      file.addTypeAlias({
        name: 'InputSchema',
        type: refs
          .map((ref) => refToType(ref, stripScheme(stripHash(lexUri)), imports))
          .join('|'),
        isExported: true,
      })
    } else if (typeof def.input.schema === 'object') {
      //= export interface InputSchema {...}
      genObject(file, imports, lexUri, def.input.schema, `InputSchema`)
    }
  } else if (def.input?.encoding) {
    //= export type InputSchema = string | Uint8Array
    file.addTypeAlias({
      isExported: true,
      name: 'InputSchema',
      type: 'string | Uint8Array',
    })
  } else {
    //= export type InputSchema = undefined
    file.addTypeAlias({
      isExported: true,
      name: 'InputSchema',
      type: 'undefined',
    })
  }
}

export function genXrpcOutput(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'procedure',
  ]) as LexXrpcQuery

  if (def.output?.schema) {
    if (
      typeof def.output.schema === 'string' ||
      Array.isArray(def.output.schema)
    ) {
      //= export type OutputSchema = ...
      const refs = Array.isArray(def.output.schema)
        ? def.output.schema
        : [def.output.schema]
      file.addTypeAlias({
        name: 'OutputSchema',
        type: refs
          .map((ref) => refToType(ref, stripScheme(stripHash(lexUri)), imports))
          .join('|'),
        isExported: true,
      })
    } else if (typeof def.output.schema === 'object') {
      //= export interface OutputSchema {...}
      genObject(file, imports, lexUri, def.output.schema, `OutputSchema`)
    }
  }
}

export function stripScheme(uri: string): string {
  if (uri.startsWith('lex:')) return uri.slice(4)
  return uri
}

export function stripHash(uri: string): string {
  return uri.split('#')[0] || ''
}

export function getHash(uri: string): string {
  return uri.split('#').pop() || ''
}

export function refToType(
  ref: string,
  baseNsid: string,
  imports: Set<string>,
): string {
  // TODO: import external types!
  let [refBase, refHash] = ref.split('#')
  refBase = stripScheme(refBase)
  if (!refHash) refHash = 'main'

  // internal
  if (!refBase || baseNsid === refBase) {
    return toTitleCase(refHash)
  }

  // external
  imports.add(refBase)
  return `${toTitleCase(refBase)}.${toTitleCase(refHash)}`
}

export function primitiveOrBlobToType(
  def: LexBlobVariant | LexPrimitive,
): string {
  switch (def.type) {
    case 'blob':
    case 'image':
    case 'video':
    case 'audio':
      return `{cid: string; mimeType: string; [k: string]: unknown}`
    default:
      return primitiveToType(def)
  }
}

export function primitiveToType(def: LexPrimitive): string {
  switch (def.type) {
    case 'string':
      if (def.knownValues?.length) {
        return `${def.knownValues
          .map((v) => JSON.stringify(v))
          .join(' | ')} | (string & {})`
      } else if (def.enum) {
        return def.enum.map((v) => JSON.stringify(v)).join(' | ')
      } else if (def.const) {
        return JSON.stringify(def.const)
      }
      return 'string'
    case 'number':
    case 'integer':
      if (def.enum) {
        return def.enum.map((v) => JSON.stringify(v)).join(' | ')
      } else if (def.const) {
        return JSON.stringify(def.const)
      }
      return 'number'
    case 'boolean':
      if (def.const) {
        return JSON.stringify(def.const)
      }
      return 'boolean'
    case 'datetime':
      return 'string'
    case 'unknown':
      return '{}'
    default:
      throw new Error(`Unexpected primitive type: ${JSON.stringify(def)}`)
  }
}
