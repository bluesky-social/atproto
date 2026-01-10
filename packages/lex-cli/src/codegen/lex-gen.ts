import { relative as getRelativePath } from 'node:path/posix'
import { JSDoc, SourceFile, VariableDeclarationKind } from 'ts-morph'
import {
  type LexArray,
  type LexBlob,
  type LexBytes,
  type LexCidLink,
  type LexIpldType,
  type LexObject,
  type LexPrimitive,
  type LexToken,
  Lexicons,
} from '@atproto/lexicon'
import { toCamelCase, toScreamingSnakeCase, toTitleCase } from './util'

interface Commentable {
  addJsDoc: ({ description }: { description: string }) => JSDoc
}
export function genComment<T extends Commentable>(
  commentable: T,
  def: { description?: string },
): T {
  if (def.description) {
    commentable.addJsDoc({ description: def.description })
  }
  return commentable
}

export function genCommonImports(file: SourceFile, baseNsid: string) {
  //= import {ValidationResult, BlobRef} from '@atproto/lexicon'
  file
    .addImportDeclaration({
      moduleSpecifier: '@atproto/lexicon',
    })
    .addNamedImports([
      { name: 'ValidationResult', isTypeOnly: true },
      { name: 'BlobRef' },
    ])

  //= import {CID} from 'multiformats/cid'
  file
    .addImportDeclaration({
      moduleSpecifier: 'multiformats/cid',
    })
    .addNamedImports([{ name: 'CID' }])

  //= import { validate as _validate } from '../../lexicons.ts'
  file
    .addImportDeclaration({
      moduleSpecifier: `${baseNsid
        .split('.')
        .map((_str) => '..')
        .join('/')}/lexicons`,
    })
    .addNamedImports([{ name: 'validate', alias: '_validate' }])

  //= import { type $Typed, is$typed as _is$typed, type OmitKey } from '../[...]/util.ts'
  file
    .addImportDeclaration({
      moduleSpecifier: `${baseNsid
        .split('.')
        .map((_str) => '..')
        .join('/')}/util`,
    })
    .addNamedImports([
      { name: '$Typed', isTypeOnly: true },
      { name: 'is$typed', alias: '_is$typed' },
      { name: 'OmitKey', isTypeOnly: true },
    ])

  // tsc adds protection against circular imports, which hurts bundle size.
  // Since we know that lexicon.ts and util.ts do not depend on the file being
  // generated, we can safely bypass this protection.
  // Note that we are not using `import * as util from '../../util'` because
  // typescript will emit is own helpers for the import, which we want to avoid.
  file.addVariableStatement({
    isExported: false,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      { name: 'is$typed', initializer: '_is$typed' },
      { name: 'validate', initializer: '_validate' },
    ],
  })

  //= const id = "{baseNsid}"
  file.addVariableStatement({
    isExported: false, // Do not export to allow tree-shaking
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: 'id', initializer: JSON.stringify(baseNsid) }],
  })
}

export function genImports(
  file: SourceFile,
  imports: Set<string>,
  baseNsid: string,
) {
  const startPath = '/' + baseNsid.split('.').slice(0, -1).join('/')

  for (const nsid of imports) {
    const targetPath = '/' + nsid.split('.').join('/') + '.js'
    let resolvedPath = getRelativePath(startPath, targetPath)
    if (!resolvedPath.startsWith('.')) {
      resolvedPath = `./${resolvedPath}`
    }
    file.addImportDeclaration({
      isTypeOnly: true,
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
    case 'object': {
      const ifaceName: string = toTitleCase(getHash(lexUri))
      genObject(file, imports, lexUri, def, ifaceName, {
        typeProperty: true,
      })
      genObjHelpers(file, lexUri, ifaceName, {
        requireTypeProperty: false,
      })
      break
    }

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

function genObject(
  file: SourceFile,
  imports: Set<string>,
  lexUri: string,
  def: LexObject,
  ifaceName: string,
  {
    defaultsArePresent = true,
    allowUnknownProperties = false,
    typeProperty = false,
  }: {
    defaultsArePresent?: boolean
    allowUnknownProperties?: boolean
    typeProperty?: boolean | 'required'
  } = {},
) {
  const iface = file.addInterface({
    name: ifaceName,
    isExported: true,
  })
  genComment(iface, def)

  if (typeProperty) {
    const hash = getHash(lexUri)
    const baseNsid = stripScheme(stripHash(lexUri))

    //= $type?: <uri>
    iface.addProperty({
      name: typeProperty === 'required' ? `$type` : `$type?`,
      type:
        // Not using $Type here because it is less readable than a plain string
        // `$Type<${JSON.stringify(baseNsid)}, ${JSON.stringify(hash)}>`
        hash === 'main'
          ? JSON.stringify(`${baseNsid}`)
          : JSON.stringify(`${baseNsid}#${hash}`),
    })
  }

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
        const types =
          propDef.type === 'union'
            ? propDef.refs.map((ref) => refToUnionType(ref, lexUri, imports))
            : [refToType(propDef.ref, stripScheme(stripHash(lexUri)), imports)]
        if (propDef.type === 'union' && !propDef.closed) {
          types.push('{ $type: string }')
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
              refToUnionType(ref, lexUri, imports),
            )
            if (!propDef.items.closed) {
              types.push('{ $type: string }')
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

    if (allowUnknownProperties) {
      //= [k: string]: unknown
      iface.addIndexSignature({
        keyName: 'k',
        keyType: 'string',
        returnType: 'unknown',
      })
    }
  }
}

export function genToken(file: SourceFile, lexUri: string, def: LexToken) {
  //= /** <comment> */
  //= export const <TOKEN> = `${id}#<token>`
  genComment(
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: toScreamingSnakeCase(getHash(lexUri)),
          initializer: `\`\${id}#${getHash(lexUri)}\``,
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
      refToUnionType(ref, lexUri, imports),
    )
    if (!def.items.closed) {
      types.push('{ $type: string }')
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
  ])

  // @NOTE We need to use a `type` here instead of  an `interface` because we
  // need the generated type to be used as generic type parameter like this:
  //
  // type QueryParams = {} // Generated by this function
  //
  // type MyUtil<P extends xrpcServer.QueryParam> = (...)
  // type NsType = MyUtil<NS.QueryParams> // ERROR if `NS.QueryParams` is an `interface`
  //
  // Second line will fail if `NS.QueryParams` is an `interface` that does
  // not explicitly extend `xrpcServer.QueryParam`, or have a string index
  // signature that encompasses `xrpcServer.QueryParam`.

  //= export type QueryParams = {...}
  if (def.parameters) {
    genComment(
      file.addTypeAlias({
        name: 'QueryParams',
        isExported: true,
        type: `{
          ${Object.entries(def.parameters.properties)
            .map(([paramKey, paramDef]) => {
              const req =
                def.parameters!.required?.includes(paramKey) ||
                (defaultsArePresent &&
                  'default' in paramDef &&
                  paramDef.default !== undefined)
              const jsDoc = paramDef.description
                ? `/** ${paramDef.description} */\n`
                : ''
              return `${jsDoc}${paramKey}${req ? '' : '?'}: ${
                paramDef.type === 'array'
                  ? primitiveToType(paramDef.items) + '[]'
                  : primitiveToType(paramDef)
              }`
            })
            .join('\n')}
        }`,
      }),
      def.parameters,
    )
  } else {
    file.addTypeAlias({
      name: 'QueryParams',
      isExported: true,
      type: '{}',
    })
  }
}

export function genXrpcInput(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
  defaultsArePresent = true,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['query', 'procedure'])

  if (def.type === 'procedure' && def.input?.schema) {
    if (def.input.schema.type === 'ref' || def.input.schema.type === 'union') {
      //= export type InputSchema = ...

      const types =
        def.input.schema.type === 'union'
          ? def.input.schema.refs.map((ref) =>
              refToUnionType(ref, lexUri, imports),
            )
          : [
              refToType(
                def.input.schema.ref,
                stripScheme(stripHash(lexUri)),
                imports,
              ),
            ]

      if (def.input.schema.type === 'union' && !def.input.schema.closed) {
        types.push('{ $type: string }')
      }
      file.addTypeAlias({
        name: 'InputSchema',
        type: types.join('|'),
        isExported: true,
      })
    } else {
      //= export interface InputSchema {...}
      genObject(file, imports, lexUri, def.input.schema, `InputSchema`, {
        defaultsArePresent,
      })
    }
  } else if (def.type === 'procedure' && def.input?.encoding) {
    //= export type InputSchema = string | Uint8Array | Blob
    file.addTypeAlias({
      isExported: true,
      name: 'InputSchema',
      type: 'string | Uint8Array | Blob',
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
  ])

  const schema =
    def.type === 'subscription' ? def.message?.schema : def.output?.schema
  if (schema) {
    if (schema.type === 'ref' || schema.type === 'union') {
      //= export type OutputSchema = ...
      const types =
        schema.type === 'union'
          ? schema.refs.map((ref) => refToUnionType(ref, lexUri, imports))
          : [refToType(schema.ref, stripScheme(stripHash(lexUri)), imports)]
      if (schema.type === 'union' && !schema.closed) {
        types.push('{ $type: string }')
      }
      file.addTypeAlias({
        name: 'OutputSchema',
        type: types.join('|'),
        isExported: true,
      })
    } else {
      //= export interface OutputSchema {...}
      genObject(file, imports, lexUri, schema, `OutputSchema`, {
        defaultsArePresent,
      })
    }
  }
}

export function genRecord(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const hash = getHash(lexUri)
  const ifaceName: string = toTitleCase(hash)
  const def = lexicons.getDefOrThrow(lexUri, ['record'])

  //= export interface {X} {...}
  genObject(file, imports, lexUri, def.record, ifaceName, {
    defaultsArePresent: true,
    allowUnknownProperties: true,
    typeProperty: 'required',
  })

  //= export function is{X}(v: unknown): v is {X} {...}
  genObjHelpers(file, lexUri, ifaceName, {
    requireTypeProperty: true,
  })

  // For convenience, we re-export the type and the type guard under the generic
  // names "Record", "isRecord" and "validateRecord".
  // @NOTE This does not account for potential name clashes with a potential
  // "#record" def.

  //= export { {X} as Record, is{X} as isRecord }
  file.addExportDeclaration({
    namedExports: [
      {
        isTypeOnly: true,
        name: ifaceName,
        alias: 'Record',
      },
      {
        name: `is${ifaceName}`,
        alias: 'isRecord',
      },
      {
        name: `validate${ifaceName}`,
        alias: 'validateRecord',
      },
    ],
  })
}

function genObjHelpers(
  file: SourceFile,
  lexUri: string,
  ifaceName: string,
  {
    requireTypeProperty,
  }: {
    requireTypeProperty: boolean
  },
) {
  const hash = getHash(lexUri)

  const hashVar = `hash${ifaceName}`

  file.addVariableStatement({
    isExported: false,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: hashVar, initializer: JSON.stringify(hash) }],
  })

  const isX = toCamelCase(`is-${ifaceName}`)

  //= export function is{X}<V>(v: V) {...}
  file
    .addFunction({
      name: isX,
      typeParameters: [{ name: `V` }],
      parameters: [{ name: `v`, type: `V` }],
      isExported: true,
    })
    .setBodyText(`return is$typed(v, id, ${hashVar})`)

  const validateX = toCamelCase(`validate-${ifaceName}`)

  //= export function validate{X}(v: unknown) {...}
  file
    .addFunction({
      name: validateX,
      typeParameters: [{ name: `V` }],
      parameters: [{ name: `v`, type: `V` }],
      isExported: true,
    })
    .setBodyText(
      `return validate<${ifaceName} & V>(v, id, ${hashVar}${requireTypeProperty ? ', true' : ''})`,
    )
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

function refToUnionType(
  ref: string,
  lexUri: string,
  imports: Set<string>,
): string {
  const baseNsid = stripScheme(stripHash(lexUri))
  return `$Typed<${refToType(ref, baseNsid, imports)}>`
}

function refToType(
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
      // @TODO Should we use "object" here ?
      // the "Record" identifier from typescript get overwritten by the Record
      // interface created by lex-cli.
      return '{ [_ in string]: unknown }' // Record<string, unknown>
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
  if (types.length === 1) return `(${types[0]})${arr}`
  if (arr) return `(${types.join(' | ')})${arr}`
  return types.join(' | ')
}
