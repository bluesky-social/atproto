import {
  IndentationText,
  type MethodDeclarationStructure,
  type OptionalKind,
  type ParameterDeclarationStructure,
  Project,
  type PropertyDeclarationStructure,
  type PropertySignatureStructure,
  VariableDeclarationKind,
} from 'ts-morph'
import { type LexRecord, type LexiconDoc, Lexicons } from '@atproto/lexicon'
import { NSID } from '@atproto/syntax'
import type { GeneratedAPI } from '../types.js'
import { type GenFile, gen, lexiconsTs, utilTs } from './common.js'
import {
  genCommonImports,
  genImports,
  genRecord,
  genUserType,
  genXrpcInput,
  genXrpcOutput,
  genXrpcParams,
} from './lex-gen.js'
import {
  type DefTreeNode,
  lexiconsToDefTree,
  schemasToNsidTokens,
  toCamelCase,
  toScreamingSnakeCase,
  toTitleCase,
} from './util.js'

const ATP_METHODS = {
  list: 'com.atproto.repo.listRecords',
  get: 'com.atproto.repo.getRecord',
  create: 'com.atproto.repo.createRecord',
  put: 'com.atproto.repo.putRecord',
  delete: 'com.atproto.repo.deleteRecord',
}

export async function genClientApi(
  lexiconDocs: LexiconDoc[],
): Promise<GeneratedAPI> {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const api: GeneratedAPI = { files: [] }
  const lexicons = new Lexicons(lexiconDocs)
  const nsidTree = lexiconsToDefTree(lexiconDocs)
  const nsidTokens = schemasToNsidTokens(lexiconDocs)
  for (const lexiconDoc of lexiconDocs) {
    api.files.push(await lexiconTs(project, lexicons, lexiconDoc))
  }
  api.files.push(await utilTs())
  api.files.push(await lexiconsTs(project, lexiconDocs))
  api.files.push(await indexTs(project, lexiconDocs, nsidTree, nsidTokens))
  return api
}

const indexTs = (
  project: Project,
  lexiconDocs: LexiconDoc[],
  nsidTree: DefTreeNode[],
  nsidTokens: Record<string, string[]>,
) =>
  gen(project, '/index.ts', async (file) => {
    //= import { XrpcClient, type FetchHandler, type FetchHandlerOptions } from '@atproto/xrpc'
    file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc',
      namedImports: [
        { name: 'XrpcClient' },
        { name: 'FetchHandler', isTypeOnly: true },
        { name: 'FetchHandlerOptions', isTypeOnly: true },
      ],
    })
    //= import {schemas} from './lexicons.js'
    file.addImportDeclaration({
      moduleSpecifier: './lexicons.js',
      namedImports: [{ name: 'schemas' }],
    })
    //= import {CID} from 'multiformats/cid'
    file.addImportDeclaration({
      moduleSpecifier: 'multiformats/cid',
      namedImports: [{ name: 'CID' }],
    })

    //= import { type OmitKey, type Un$Typed } from './util.js'
    file.addImportDeclaration({
      moduleSpecifier: `./util.js`,
      namedImports: [
        { name: 'OmitKey', isTypeOnly: true },
        { name: 'Un$Typed', isTypeOnly: true },
      ],
    })

    // generate type imports and re-exports
    for (const lexicon of lexiconDocs) {
      const moduleSpecifier = `./types/${lexicon.id.split('.').join('/')}.js`
      file.addImportDeclaration({
        moduleSpecifier,
        namespaceImport: toTitleCase(lexicon.id),
      })
      file.addExportDeclaration({
        moduleSpecifier,
        namespaceExport: toTitleCase(lexicon.id),
      })
    }

    // generate token enums
    for (const nsidAuthority in nsidTokens) {
      // export const {THE_AUTHORITY} = {
      //  {Name}: "{authority.the.name}"
      // }
      file.addVariableStatement({
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: toScreamingSnakeCase(nsidAuthority),
            initializer: [
              '{',
              ...nsidTokens[nsidAuthority].map(
                (nsidName) =>
                  `${toTitleCase(nsidName)}: "${nsidAuthority}.${nsidName}",`,
              ),
              '}',
            ].join('\n'),
          },
        ],
      })
    }

    //= export class AtpBaseClient {...}
    file.addClass({
      name: 'AtpBaseClient',
      isExported: true,
      extends: 'XrpcClient',
      //= ns: NS
      properties: nsidTree.map((ns) => ({
        name: ns.propName,
        type: ns.className,
      })),
      //= constructor (options: FetchHandler | FetchHandlerOptions) {
      //=   super(options, schemas)
      //=   {namespace declarations}
      //= }
      ctors: [
        {
          parameters: [
            { name: 'options', type: 'FetchHandler | FetchHandlerOptions' },
          ],
          statements: [
            'super(options, schemas)',
            ...nsidTree.map(
              (ns) => `this.${ns.propName} = new ${ns.className}(this)`,
            ),
          ],
        },
      ],
      //= /** @deprecated use `this` instead */
      //= get xrpc(): XrpcClient {
      //=   return this
      //= }
      getAccessors: [
        {
          name: 'xrpc',
          returnType: 'XrpcClient',
          statements: ['return this'],
          docs: ['@deprecated use `this` instead'],
        },
      ],
    })

    // generate classes for the schemas
    for (const ns of nsidTree) {
      genNamespaceCls(file, ns)
    }
  })

function genNamespaceCls(file: GenFile, ns: DefTreeNode) {
  //= _client: XrpcClient
  const properties: OptionalKind<PropertyDeclarationStructure>[] = [
    { name: '_client', type: 'XrpcClient' },
  ]

  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'record') {
      continue
    }
    //= type: TypeRecord
    const name = NSID.parse(userType.nsid).name || ''
    properties.push({
      name: toCamelCase(name),
      type: `${toTitleCase(userType.nsid)}Record`,
    })
  }

  for (const child of ns.children) {
    //= child: ChildNS
    properties.push({
      name: child.propName,
      type: child.className,
    })
  }

  // methods
  const methods: OptionalKind<MethodDeclarationStructure>[] = []
  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'query' && userType.def.type !== 'procedure') {
      continue
    }
    const isGetReq = userType.def.type === 'query'
    const moduleName = toTitleCase(userType.nsid)
    const name = toCamelCase(NSID.parse(userType.nsid).name || '')
    const parameters: OptionalKind<ParameterDeclarationStructure>[] = []
    if (isGetReq) {
      parameters.push({
        name: 'params?',
        type: `${moduleName}.QueryParams`,
      })
    } else if (userType.def.type === 'procedure') {
      parameters.push({
        name: 'data?',
        type: `${moduleName}.InputSchema`,
      })
    }
    parameters.push({
      name: 'opts?',
      type: `${moduleName}.CallOptions`,
    })
    methods.push({
      name,
      returnType: `Promise<${moduleName}.Response>`,
      parameters,
      statements: [
        [
          `return this._client`,
          isGetReq
            ? `.call('${userType.nsid}', params, undefined, opts)`
            : `.call('${userType.nsid}', opts?.qp, data, opts)`,
          userType.def.errors?.length
            ? // Only add a catch block if there are custom errors
              `  .catch((e) => { throw ${moduleName}.toKnownErr(e) })`
            : '',
        ].join('\n'),
      ],
    })
  }

  //= export class {ns}NS {...}
  file.addClass({
    name: ns.className,
    isExported: true,
    properties,
    //= constructor(public client: XrpcClient) {
    //=  this._client = client
    //=  {child namespace prop declarations}
    //=  {record prop declarations}
    //= }
    ctors: [
      {
        parameters: [
          {
            name: 'client',
            type: 'XrpcClient',
          },
        ],
        statements: [
          `this._client = client`,
          ...ns.children.map(
            (ns) => `this.${ns.propName} = new ${ns.className}(client)`,
          ),
          ...ns.userTypes
            .filter((ut) => ut.def.type === 'record')
            .map((ut) => {
              const name = NSID.parse(ut.nsid).name || ''
              return `this.${toCamelCase(name)} = new ${toTitleCase(
                ut.nsid,
              )}Record(client)`
            }),
        ],
      },
    ],
    methods,
  })

  // recurse
  for (const child of ns.children) {
    genNamespaceCls(file, child)
  }

  // record api classes
  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'record') {
      continue
    }
    genRecordCls(file, userType.nsid, userType.def)
  }
}

function genRecordCls(file: GenFile, nsid: string, lexRecord: LexRecord) {
  const typeModule = toTitleCase(nsid)
  const maybeRkeyPart = lexRecord.key?.startsWith('literal:')
    ? `rkey: '${lexRecord.key.replace('literal:', '')}', `
    : ''

  //= export class {type}Record {...}
  file.addClass({
    name: `${toTitleCase(nsid)}Record`,
    isExported: true,
    //= _client: XrpcClient
    properties: [
      {
        name: '_client',
        type: 'XrpcClient',
      },
    ],
    //= constructor(client: XrpcClient) {
    //=  this._client = client
    //= }
    ctors: [
      {
        parameters: [
          {
            name: 'client',
            type: 'XrpcClient',
          },
        ],
        statements: [`this._client = client`],
      },
    ],
    // methods
    methods: [
      {
        //= list()
        isAsync: true,
        name: 'list',
        returnType: `Promise<{cursor?: string, records: ({uri: string, value: ${typeModule}.Record})[]}>`,
        parameters: [
          {
            name: 'params',
            type: `OmitKey<${toTitleCase(ATP_METHODS.list)}.QueryParams, "collection">`,
          },
        ],
        statements: [
          [
            `const res = await this._client.call('${ATP_METHODS.list}', { collection: '${nsid}', ...params })`,
            `return res.data`,
          ].join('\n'),
        ],
      },
      {
        //= get()
        isAsync: true,
        name: 'get',
        returnType: `Promise<{uri: string, cid: string, value: ${typeModule}.Record}>`,
        parameters: [
          {
            name: 'params',
            type: `OmitKey<${toTitleCase(ATP_METHODS.get)}.QueryParams, "collection">`,
          },
        ],
        statements: [
          [
            `const res = await this._client.call('${ATP_METHODS.get}', { collection: '${nsid}', ...params })`,
            `return res.data`,
          ].join('\n'),
        ],
      },
      {
        //= create()
        isAsync: true,
        name: 'create',
        returnType: 'Promise<{uri: string, cid: string}>',
        parameters: [
          {
            name: 'params',
            type: `OmitKey<${toTitleCase(
              ATP_METHODS.create,
            )}.InputSchema, "collection" | "record">`,
          },
          {
            name: 'record',
            type: `Un$Typed<${typeModule}.Record>`,
          },
          {
            name: 'headers?',
            type: `Record<string, string>`,
          },
        ],
        statements: [
          [
            `const collection = '${nsid}'`,
            `const res = await this._client.call('${ATP_METHODS.create}', undefined, { collection, ${maybeRkeyPart}...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers })`,
            `return res.data`,
          ].join('\n'),
        ],
      },
      {
        //= put()
        isAsync: true,
        name: 'put',
        returnType: 'Promise<{uri: string, cid: string}>',
        parameters: [
          {
            name: 'params',
            type: `OmitKey<${toTitleCase(ATP_METHODS.put)}.InputSchema, "collection" | "record">`,
          },
          {
            name: 'record',
            type: `Un$Typed<${typeModule}.Record>`,
          },
          {
            name: 'headers?',
            type: `Record<string, string>`,
          },
        ],
        statements: [
          [
            `const collection = '${nsid}'`,
            `const res = await this._client.call('${ATP_METHODS.put}', undefined, { collection, ...params, record: { ...record, $type: collection } }, { encoding: 'application/json', headers })`,
            `return res.data`,
          ].join('\n'),
        ],
      },
      {
        //= delete()
        isAsync: true,
        name: 'delete',
        returnType: 'Promise<void>',
        parameters: [
          {
            name: 'params',
            type: `OmitKey<${toTitleCase(
              ATP_METHODS.delete,
            )}.InputSchema, "collection">`,
          },
          {
            name: 'headers?',
            type: `Record<string, string>`,
          },
        ],
        statements: [
          [
            `await this._client.call('${ATP_METHODS.delete}', undefined, { collection: '${nsid}', ...params }, { headers })`,
          ].join('\n'),
        ],
      },
    ],
  })
}

const lexiconTs = (
  project: Project,
  lexicons: Lexicons,
  lexiconDoc: LexiconDoc,
) =>
  gen(
    project,
    `/types/${lexiconDoc.id.split('.').join('/')}.ts`,
    async (file) => {
      const main = lexiconDoc.defs.main
      if (
        main?.type === 'query' ||
        main?.type === 'subscription' ||
        main?.type === 'procedure'
      ) {
        //= import {HeadersMap, XRPCError} from '@atproto/xrpc'
        file.addImportDeclaration({
          moduleSpecifier: '@atproto/xrpc',
          namedImports: [
            { name: 'HeadersMap', isTypeOnly: true },
            { name: 'XRPCError' },
          ],
        })
      }

      genCommonImports(file, lexiconDoc.id)

      const imports: Set<string> = new Set()
      for (const defId in lexiconDoc.defs) {
        const def = lexiconDoc.defs[defId]
        const lexUri = `${lexiconDoc.id}#${defId}`
        if (defId === 'main') {
          if (def.type === 'query' || def.type === 'procedure') {
            genXrpcParams(file, lexicons, lexUri, false)
            genXrpcInput(file, imports, lexicons, lexUri, false)
            genXrpcOutput(file, imports, lexicons, lexUri)
            genClientXrpcCommon(file, lexicons, lexUri)
          } else if (def.type === 'subscription') {
            continue
          } else if (def.type === 'record') {
            genRecord(file, imports, lexicons, lexUri)
          } else if (def.type === 'permission-set') {
            continue
          } else {
            genUserType(file, imports, lexicons, lexUri)
          }
        } else {
          genUserType(file, imports, lexicons, lexUri)
        }
      }
      genImports(file, imports, lexiconDoc.id)
    },
  )

function genClientXrpcCommon(
  file: GenFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['query', 'procedure'])

  //= export interface CallOptions {...}
  const opts: OptionalKind<PropertySignatureStructure>[] = []
  opts.push({ name: 'signal?', type: 'AbortSignal' })
  opts.push({ name: 'headers?', type: 'HeadersMap' })
  if (def.type === 'procedure') {
    opts.push({ name: 'qp?', type: 'QueryParams' })
  }
  if (def.type === 'procedure' && def.input) {
    let encodingType = 'string'
    if (def.input.encoding !== '*/*') {
      encodingType = def.input.encoding
        .split(',')
        .map((v) => `'${v.trim()}'`)
        .join(' | ')
    }
    opts.push({
      name: 'encoding?',
      type: encodingType,
    })
  }
  file.addInterface({
    name: 'CallOptions',
    isExported: true,
    properties: opts,
  })

  // export interface Response {...}
  const res: OptionalKind<PropertySignatureStructure>[] = []
  res.push({ name: 'success', type: 'boolean' })
  res.push({ name: 'headers', type: 'HeadersMap' })
  if (def.output?.schema) {
    if (def.output.encoding?.includes(',')) {
      res.push({ name: 'data', type: 'OutputSchema | Uint8Array' })
    } else {
      res.push({ name: 'data', type: 'OutputSchema' })
    }
  } else if (def.output?.encoding) {
    res.push({ name: 'data', type: 'Uint8Array' })
  }
  file.addInterface({
    name: 'Response',
    isExported: true,
    properties: res,
  })

  // export class {errcode}Error {...}
  const customErrors: { name: string; cls: string }[] = []
  for (const error of def.errors || []) {
    let name = toTitleCase(error.name)
    if (!name.endsWith('Error')) name += 'Error'
    file.addClass({
      name,
      extends: 'XRPCError',
      isExported: true,
      ctors: [
        {
          parameters: [{ name: 'src', type: 'XRPCError' }],
          statements: [
            'super(src.status, src.error, src.message, src.headers, { cause: src })',
          ],
        },
      ],
    })

    customErrors.push({ name: error.name, cls: name })
  }

  // export function toKnownErr(err: any) {...}
  file.addFunction({
    name: 'toKnownErr',
    isExported: true,
    parameters: [{ name: 'e', type: 'any' }],
    statements: customErrors.length
      ? [
          'if (e instanceof XRPCError) {',
          ...customErrors.map(
            (err) => `if (e.error === '${err.name}') return new ${err.cls}(e)`,
          ),
          '}',
          'return e',
        ]
      : ['return e'],
  })
}
