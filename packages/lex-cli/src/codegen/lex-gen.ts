import { SourceFile, VariableDeclarationKind } from 'ts-morph'
import { relative as getRelativePath } from 'path'
import {
  Lexicons,
  LexUserType,
  LexObject,
  LexArray,
  LexPrimitive,
  LexBlob,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexToken,
  LexXrpcSubscription,
  LexCidLink,
  LexBytes,
  LexIpldType,
} from '@atproto/lexicon'
import { toCamelCase, toTitleCase, toScreamingSnakeCase } from './util'

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
      genObjHelpers(file, lexUri)
      break

    case 'blob':
    case 'bytes':
    case 'cid-link':
    case 'boolean':
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
  defaultsArePresent = true,
) {
  const iface = file.addInterface({
    name: ifaceName || toTitleCase(getHash(lexUri)),
    isExported: true,
  })
  genComment(iface, def)
  const nullableProps = new Set(def.nullable)
  if (def.properties) {
    for (const propKey in def.properties) {
      const propDef = def.properties[propKey]
      const propNullable = nullableProps.has(propKey)
      const req =
        def.required?.includes(propKey) ||
        (defaultsArePresent &&
          'default' in propDef &&
          propDef.default !== undefined)
      if (propDef.type === 'ref' || propDef.type === 'union') {
        //= propName: External|External
        const refs = propDef.type === 'union' ? propDef.refs : [propDef.ref]
        const types = refs.map((ref) =>
          refToType(ref, stripScheme(stripHash(lexUri)), imports),
        )
        if (propDef.type === 'union' && !propDef.closed) {
          types.push('{$type: string; [k: string]: unknown}')
        }
        iface.addProperty({
          name: `${propKey}${req ? '' : '?'}`,
          type: makeType(types, { nullable: propNullable }),
        })
        continue
      } else {
        if (propDef.type === 'array') {
          //= propName: type[]
          let propAst
          if (propDef.items.type === 'ref') {
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: makeType(
                refToType(
                  propDef.items.ref,
                  stripScheme(stripHash(lexUri)),
                  imports,
                ),
                {
                  nullable: propNullable,
                  array: true,
                },
              ),
            })
          } else if (propDef.items.type === 'union') {
            const types = propDef.items.refs.map((ref) =>
              refToType(ref, stripScheme(stripHash(lexUri)), imports),
            )
            if (!propDef.items.closed) {
              types.push('{$type: string; [k: string]: unknown}')
            }
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: makeType(types, {
                nullable: propNullable,
                array: true,
              }),
            })
          } else {
            propAst = iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: makeType(primitiveOrBlobToType(propDef.items), {
                nullable: propNullable,
                array: true,
              }),
            })
          }
          genComment(propAst, propDef)
        } else {
          //= propName: type
          genComment(
            iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: makeType(primitiveOrBlobToType(propDef), {
                nullable: propNullable,
              }),
            }),
            propDef,
          )
        }
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
  if (def.items.type === 'ref') {
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `${refToType(
        def.items.ref,
        stripScheme(stripHash(lexUri)),
        imports,
      )}[]`,
      isExported: true,
    })
  } else if (def.items.type === 'union') {
    const types = def.items.refs.map((ref) =>
      refToType(ref, stripScheme(stripHash(lexUri)), imports),
    )
    if (!def.items.closed) {
      types.push('{$type: string; [k: string]: unknown}')
    }
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `(${types.join('|')})[]`,
      isExported: true,
    })
  } else {
    genComment(
      file.addTypeAlias({
        name: toTitleCase(getHash(lexUri)),
        type: `${primitiveOrBlobToType(def.items)}[]`,
        isExported: true,
      }),
      def,
    )
  }
}

export function genPrimitiveOrBlob(
  file: SourceFile,
  lexUri: string,
  def: LexPrimitive | LexBlob | LexIpldType,
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
  defaultsArePresent = true,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'subscription',
    'procedure',
  ]) as LexXrpcQuery

  //= export interface QueryParams {...}
  const iface = file.addInterface({
    name: 'QueryParams',
    isExported: true,
  })
  if (def.parameters) {
    for (const paramKey in def.parameters.properties) {
      const paramDef = def.parameters.properties[paramKey]
      const req =
        def.parameters.required?.includes(paramKey) ||
        (defaultsArePresent &&
          'default' in paramDef &&
          paramDef.default !== undefined)
      genComment(
        iface.addProperty({
          name: `${paramKey}${req ? '' : '?'}`,
          type:
            paramDef.type === 'array'
              ? primitiveToType(paramDef.items) + '[]'
              : primitiveToType(paramDef),
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
  defaultsArePresent = true,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'procedure',
  ]) as LexXrpcProcedure

  if (def.input?.schema) {
    if (def.input.schema.type === 'ref' || def.input.schema.type === 'union') {
      //= export type InputSchema = ...
      const refs =
        def.input.schema.type === 'union'
          ? def.input.schema.refs
          : [def.input.schema.ref]
      const types = refs.map((ref) =>
        refToType(ref, stripScheme(stripHash(lexUri)), imports),
      )
      if (def.input.schema.type === 'union' && !def.input.schema.closed) {
        types.push('{$type: string; [k: string]: unknown}')
      }
      file.addTypeAlias({
        name: 'InputSchema',
        type: types.join('|'),
        isExported: true,
      })
    } else {
      //= export interface InputSchema {...}
      genObject(
        file,
        imports,
        lexUri,
        def.input.schema,
        `InputSchema`,
        defaultsArePresent,
      )
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
  defaultsArePresent = true,
) {
  const def = lexicons.getDefOrThrow(lexUri, [
    'query',
    'subscription',
    'procedure',
  ]) as LexXrpcQuery | LexXrpcSubscription | LexXrpcProcedure

  const schema =
    def.type === 'subscription' ? def.message?.schema : def.output?.schema
  if (schema) {
    if (schema.type === 'ref' || schema.type === 'union') {
      //= export type OutputSchema = ...
      const refs = schema.type === 'union' ? schema.refs : [schema.ref]
      const types = refs.map((ref) =>
        refToType(ref, stripScheme(stripHash(lexUri)), imports),
      )
      if (schema.type === 'union' && !schema.closed) {
        types.push('{$type: string; [k: string]: unknown}')
      }
      file.addTypeAlias({
        name: 'OutputSchema',
        type: types.join('|'),
        isExported: true,
      })
    } else {
      //= export interface OutputSchema {...}
      genObject(
        file,
        imports,
        lexUri,
        schema,
        `OutputSchema`,
        defaultsArePresent,
      )
    }
  }
}

export function genObjHelpers(
  file: SourceFile,
  lexUri: string,
  ifaceName?: string,
) {
  const hash = getHash(lexUri)

  //= export function is{X}(v: unknown): v is X {...}
  file
    .addFunction({
      name: toCamelCase(`is-${ifaceName || hash}`),
      parameters: [{ name: `v`, type: `unknown` }],
      returnType: `v is ${ifaceName || toTitleCase(hash)}`,
      isExported: true,
    })
    .setBodyText(
      hash === 'main'
        ? `return isObj(v) && hasProp(v, '$type') && (v.$type === "${lexUri}" || v.$type === "${stripHash(
            lexUri,
          )}")`
        : `return isObj(v) && hasProp(v, '$type') && v.$type === "${lexUri}"`,
    )

  //= export function validate{X}(v: unknown): ValidationResult {...}
  file
    .addFunction({
      name: toCamelCase(`validate-${ifaceName || hash}`),
      parameters: [{ name: `v`, type: `unknown` }],
      returnType: `ValidationResult`,
      isExported: true,
    })
    .setBodyText(`return lexicons.validate("${lexUri}", v)`)
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

export function ipldToType(def: LexCidLink | LexBytes) {
  if (def.type === 'bytes') {
    return 'Uint8Array'
  }
  return 'CID'
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
  def: LexBlob | LexPrimitive | LexIpldType,
): string {
  switch (def.type) {
    case 'blob':
      return 'BlobRef'
    case 'bytes':
      return 'Uint8Array'
    case 'cid-link':
      return 'CID'
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
    case 'unknown':
      return '{}'
    default:
      throw new Error(`Unexpected primitive type: ${JSON.stringify(def)}`)
  }
}

function makeType(
  _types: string | string[],
  opts?: { array?: boolean; nullable?: boolean },
) {
  const types = ([] as string[]).concat(_types)
  if (opts?.nullable) types.push('null')
  const arr = opts?.array ? '[]' : ''
  if (types.length === 1) return `${types[0]}${arr}`
  if (arr) return `(${types.join(' | ')})${arr}`
  return types.join(' | ')
}
