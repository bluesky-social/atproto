import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import {
  Lexicons,
  LexiconDoc,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexRecord,
} from '@atproto/lexicon'
import { NSID } from '@atproto/nsid'
import { gen, utilTs, lexiconsTs } from './common'
import { GeneratedAPI } from '../types'
import {
  genImports,
  genUserType,
  genObject,
  genXrpcParams,
  genXrpcInput,
  genXrpcOutput,
  genObjHelpers,
} from './lex-gen'
import {
  lexiconsToDefTree,
  DefTreeNode,
  schemasToNsidTokens,
  toCamelCase,
  toTitleCase,
  toScreamingSnakeCase,
} from './util'

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
  api.files.push(await utilTs(project))
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
    //= import {Client as XrpcClient, AtpServiceClient as XrpcServiceClient} from '@atproto/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc',
    })
    xrpcImport.addNamedImports([
      { name: 'Client', alias: 'XrpcClient' },
      { name: 'ServiceClient', alias: 'XrpcServiceClient' },
    ])
    //= import {schemas} from './lexicons'
    file
      .addImportDeclaration({ moduleSpecifier: './lexicons' })
      .addNamedImports([{ name: 'schemas' }])
    //= import {CID} from 'multiformats/cid'
    file
      .addImportDeclaration({
        moduleSpecifier: 'multiformats/cid',
      })
      .addNamedImports([{ name: 'CID' }])

    // generate type imports and re-exports
    for (const lexicon of lexiconDocs) {
      const moduleSpecifier = `./types/${lexicon.id.split('.').join('/')}`
      file
        .addImportDeclaration({ moduleSpecifier })
        .setNamespaceImport(toTitleCase(lexicon.id))
      file
        .addExportDeclaration({ moduleSpecifier })
        .setNamespaceExport(toTitleCase(lexicon.id))
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
    const clientCls = file.addClass({
      name: 'AtpBaseClient',
      isExported: true,
    })
    //= xrpc: XrpcClient = new XrpcClient()
    clientCls.addProperty({
      name: 'xrpc',
      type: 'XrpcClient',
      initializer: 'new XrpcClient()',
    })
    //= constructor () {
    //=   this.xrpc.addLexicons(schemas)
    //= }
    clientCls.addConstructor().setBodyText(`this.xrpc.addLexicons(schemas)`)
    //= service(serviceUri: string | URL): AtpServiceClient {
    //=   return new AtpServiceClient(this, this.xrpc.service(serviceUri))
    //= }
    clientCls
      .addMethod({
        name: 'service',
        parameters: [{ name: 'serviceUri', type: 'string | URL' }],
        returnType: 'AtpServiceClient',
      })
      .setBodyText(
        `return new AtpServiceClient(this, this.xrpc.service(serviceUri))`,
      )

    //= export class AtpServiceClient {...}
    const serviceClientCls = file.addClass({
      name: 'AtpServiceClient',
      isExported: true,
    })
    //= _baseClient: AtpBaseClient
    serviceClientCls.addProperty({ name: '_baseClient', type: 'AtpBaseClient' })
    //= xrpc: XrpcServiceClient
    serviceClientCls.addProperty({
      name: 'xrpc',
      type: 'XrpcServiceClient',
    })
    for (const ns of nsidTree) {
      //= ns: NS
      serviceClientCls.addProperty({
        name: ns.propName,
        type: ns.className,
      })
    }
    //= constructor (baseClient: AtpBaseClient, xrpcService: XrpcServiceClient) {
    //=   this.baseClient = baseClient
    //=   this.xrpcService = xrpcService
    //=   {namespace declarations}
    //= }
    serviceClientCls
      .addConstructor({
        parameters: [
          { name: 'baseClient', type: 'AtpBaseClient' },
          { name: 'xrpcService', type: 'XrpcServiceClient' },
        ],
      })
      .setBodyText(
        [
          `this._baseClient = baseClient`,
          `this.xrpc = xrpcService`,
          ...nsidTree.map(
            (ns) => `this.${ns.propName} = new ${ns.className}(this)`,
          ),
        ].join('\n'),
      )

    //= setHeader(key: string, value: string): void {
    //=   this.xrpc.setHeader(key, value)
    //= }
    const setHeaderMethod = serviceClientCls.addMethod({
      name: 'setHeader',
      returnType: 'void',
    })
    setHeaderMethod.addParameter({
      name: 'key',
      type: 'string',
    })
    setHeaderMethod.addParameter({
      name: 'value',
      type: 'string',
    })
    setHeaderMethod.setBodyText('this.xrpc.setHeader(key, value)')

    // generate classes for the schemas
    for (const ns of nsidTree) {
      genNamespaceCls(file, ns)
    }
  })

function genNamespaceCls(file: SourceFile, ns: DefTreeNode) {
  //= export class {ns}NS {...}
  const cls = file.addClass({
    name: ns.className,
    isExported: true,
  })
  //= _service: AtpServiceClient
  cls.addProperty({
    name: '_service',
    type: 'AtpServiceClient',
  })

  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'record') {
      continue
    }
    //= type: TypeRecord
    const name = NSID.parse(userType.nsid).name || ''
    cls.addProperty({
      name: toCamelCase(name),
      type: `${toTitleCase(name)}Record`,
    })
  }

  for (const child of ns.children) {
    //= child: ChildNS
    cls.addProperty({
      name: child.propName,
      type: child.className,
    })

    // recurse
    genNamespaceCls(file, child)
  }

  //= constructor(service: AtpServiceClient) {
  //=  this._service = service
  //=  {child namespace prop declarations}
  //=  {record prop declarations}
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'service',
    type: 'AtpServiceClient',
  })
  cons.setBodyText(
    [
      `this._service = service`,
      ...ns.children.map(
        (ns) => `this.${ns.propName} = new ${ns.className}(service)`,
      ),
      ...ns.userTypes
        .filter((ut) => ut.def.type === 'record')
        .map((ut) => {
          const name = NSID.parse(ut.nsid).name || ''
          return `this.${toCamelCase(name)} = new ${toTitleCase(
            name,
          )}Record(service)`
        }),
    ].join('\n'),
  )

  // methods
  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'query' && userType.def.type !== 'procedure') {
      continue
    }
    const isGetReq = userType.def.type === 'query'
    const moduleName = toTitleCase(userType.nsid)
    const name = toCamelCase(NSID.parse(userType.nsid).name || '')
    const method = cls.addMethod({
      name,
      returnType: `Promise<${moduleName}.Response>`,
    })
    if (isGetReq) {
      method.addParameter({
        name: 'params?',
        type: `${moduleName}.QueryParams`,
      })
    } else if (userType.def.type === 'procedure') {
      method.addParameter({
        name: 'data?',
        type: `${moduleName}.InputSchema`,
      })
    }
    method.addParameter({
      name: 'opts?',
      type: `${moduleName}.CallOptions`,
    })
    method.setBodyText(
      [
        `return this._service.xrpc`,
        isGetReq
          ? `.call('${userType.nsid}', params, undefined, opts)`
          : `.call('${userType.nsid}', opts?.qp, data, opts)`,
        `  .catch((e) => {`,
        `    throw ${moduleName}.toKnownErr(e)`,
        `  })`,
      ].join('\n'),
    )
  }

  // record api classes
  for (const userType of ns.userTypes) {
    if (userType.def.type !== 'record') {
      continue
    }
    genRecordCls(file, userType.nsid, userType.def)
  }
}

function genRecordCls(file: SourceFile, nsid: string, lexRecord: LexRecord) {
  //= export class {type}Record {...}
  const name = NSID.parse(nsid).name || ''
  const cls = file.addClass({
    name: `${toTitleCase(name)}Record`,
    isExported: true,
  })
  //= _service: AtpServiceClient
  cls.addProperty({
    name: '_service',
    type: 'AtpServiceClient',
  })

  //= constructor(service: AtpServiceClient) {
  //=  this._service = service
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'service',
    type: 'AtpServiceClient',
  })
  cons.setBodyText(`this._service = service`)

  // methods
  const typeModule = toTitleCase(nsid)
  {
    //= list()
    const method = cls.addMethod({
      isAsync: true,
      name: 'list',
      returnType: `Promise<{cursor?: string, records: ({uri: string, value: ${typeModule}.Record})[]}>`,
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ATP_METHODS.list)}.QueryParams, "collection">`,
    })
    method.setBodyText(
      [
        `const res = await this._service.xrpc.call('${ATP_METHODS.list}', { collection: '${nsid}', ...params })`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= get()
    const method = cls.addMethod({
      isAsync: true,
      name: 'get',
      returnType: `Promise<{uri: string, cid: string, value: ${typeModule}.Record}>`,
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ATP_METHODS.get)}.QueryParams, "collection">`,
    })
    method.setBodyText(
      [
        `const res = await this._service.xrpc.call('${ATP_METHODS.get}', { collection: '${nsid}', ...params })`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= create()
    const method = cls.addMethod({
      isAsync: true,
      name: 'create',
      returnType: 'Promise<{uri: string, cid: string}>',
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(
        ATP_METHODS.create,
      )}.InputSchema, "collection" | "record">`,
    })
    method.addParameter({
      name: 'record',
      type: `${typeModule}.Record`,
    })
    method.addParameter({
      name: 'headers?',
      type: `Record<string, string>`,
    })
    const maybeRkeyPart = lexRecord.key?.startsWith('literal:')
      ? `rkey: '${lexRecord.key.replace('literal:', '')}', `
      : ''
    method.setBodyText(
      [
        `record.$type = '${nsid}'`,
        `const res = await this._service.xrpc.call('${ATP_METHODS.create}', undefined, { collection: '${nsid}', ${maybeRkeyPart}...params, record }, {encoding: 'application/json', headers })`,
        `return res.data`,
      ].join('\n'),
    )
  }
  // {
  //   //= put()
  //   const method = cls.addMethod({
  //     isAsync: true,
  //     name: 'put',
  //     returnType: 'Promise<{uri: string, cid: string}>',
  //   })
  //   method.addParameter({
  //     name: 'params',
  //     type: `Omit<${toTitleCase(ATP_METHODS.put)}.InputSchema, "collection" | "record">`,
  //   })
  //   method.addParameter({
  //     name: 'record',
  //     type: `${typeModule}.Record`,
  //   })
  //   method.addParameter({
  //     name: 'headers?',
  //     type: `Record<string, string>`,
  //   })
  //   method.setBodyText(
  //     [
  //       `record.$type = '${userType.nsid}'`,
  //       `const res = await this._service.xrpc.call('${ATP_METHODS.put}', undefined, { collection: '${userType.nsid}', record, ...params }, {encoding: 'application/json', headers})`,
  //       `return res.data`,
  //     ].join('\n'),
  //   )
  // }
  {
    //= delete()
    const method = cls.addMethod({
      isAsync: true,
      name: 'delete',
      returnType: 'Promise<void>',
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(
        ATP_METHODS.delete,
      )}.InputSchema, "collection">`,
    })
    method.addParameter({
      name: 'headers?',
      type: `Record<string, string>`,
    })

    method.setBodyText(
      [
        `await this._service.xrpc.call('${ATP_METHODS.delete}', undefined, { collection: '${nsid}', ...params }, { headers })`,
      ].join('\n'),
    )
  }
}

const lexiconTs = (project, lexicons: Lexicons, lexiconDoc: LexiconDoc) =>
  gen(
    project,
    `/types/${lexiconDoc.id.split('.').join('/')}.ts`,
    async (file) => {
      const imports: Set<string> = new Set()

      const main = lexiconDoc.defs.main
      if (
        main?.type === 'query' ||
        main?.type === 'subscription' ||
        main?.type === 'procedure'
      ) {
        //= import {Headers, XRPCError} from '@atproto/xrpc'
        const xrpcImport = file.addImportDeclaration({
          moduleSpecifier: '@atproto/xrpc',
        })
        xrpcImport.addNamedImports([{ name: 'Headers' }, { name: 'XRPCError' }])
      }
      //= import {ValidationResult, BlobRef} from '@atproto/lexicon'
      file
        .addImportDeclaration({
          moduleSpecifier: '@atproto/lexicon',
        })
        .addNamedImports([{ name: 'ValidationResult' }, { name: 'BlobRef' }])
      //= import {isObj, hasProp} from '../../util.ts'
      file
        .addImportDeclaration({
          moduleSpecifier: `${lexiconDoc.id
            .split('.')
            .map((_str) => '..')
            .join('/')}/util`,
        })
        .addNamedImports([{ name: 'isObj' }, { name: 'hasProp' }])
      //= import {lexicons} from '../../lexicons.ts'
      file
        .addImportDeclaration({
          moduleSpecifier: `${lexiconDoc.id
            .split('.')
            .map((_str) => '..')
            .join('/')}/lexicons`,
        })
        .addNamedImports([{ name: 'lexicons' }])
      //= import {CID} from 'multiformats/cid'
      file
        .addImportDeclaration({
          moduleSpecifier: 'multiformats/cid',
        })
        .addNamedImports([{ name: 'CID' }])

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
            genClientRecord(file, imports, lexicons, lexUri)
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
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['query', 'procedure']) as
    | LexXrpcQuery
    | LexXrpcProcedure

  //= export interface CallOptions {...}
  const opts = file.addInterface({
    name: 'CallOptions',
    isExported: true,
  })
  opts.addProperty({ name: 'headers?', type: 'Headers' })
  if (def.type === 'procedure') {
    opts.addProperty({ name: 'qp?', type: 'QueryParams' })
  }
  if (def.type === 'procedure' && def.input) {
    let encodingType = 'string'
    if (def.input.encoding !== '*/*') {
      encodingType = def.input.encoding
        .split(',')
        .map((v) => `'${v.trim()}'`)
        .join(' | ')
    }
    opts.addProperty({
      name: 'encoding',
      type: encodingType,
    })
  }

  // export interface Response {...}
  const res = file.addInterface({
    name: 'Response',
    isExported: true,
  })
  res.addProperty({ name: 'success', type: 'boolean' })
  res.addProperty({ name: 'headers', type: 'Headers' })
  if (def.output?.schema) {
    if (def.output.encoding?.includes(',')) {
      res.addProperty({ name: 'data', type: 'OutputSchema | Uint8Array' })
    } else {
      res.addProperty({ name: 'data', type: 'OutputSchema' })
    }
  } else if (def.output?.encoding) {
    res.addProperty({ name: 'data', type: 'Uint8Array' })
  }

  // export class {errcode}Error {...}
  const customErrors: { name: string; cls: string }[] = []
  for (const error of def.errors || []) {
    let name = toTitleCase(error.name)
    if (!name.endsWith('Error')) name += 'Error'
    const errCls = file.addClass({
      name,
      extends: 'XRPCError',
      isExported: true,
    })
    errCls
      .addConstructor({
        parameters: [{ name: 'src', type: 'XRPCError' }],
      })
      .setBodyText(`super(src.status, src.error, src.message)`)
    customErrors.push({ name: error.name, cls: name })
  }

  // export function toKnownErr(err: any) {...}
  const toKnownErrFn = file.addFunction({
    name: 'toKnownErr',
    isExported: true,
  })
  toKnownErrFn.addParameter({ name: 'e', type: 'any' })
  toKnownErrFn.setBodyText(
    [
      `if (e instanceof XRPCError) {`,
      ...customErrors.map(
        (err) => `if (e.error === '${err.name}') return new ${err.cls}(e)`,
      ),
      `}`,
      `return e`,
    ].join('\n'),
  )
}

function genClientRecord(
  file: SourceFile,
  imports: Set<string>,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['record']) as LexRecord

  //= export interface Record {...}
  genObject(file, imports, lexUri, def.record, 'Record')
  //= export function isRecord(v: unknown): v is Record {...}
  genObjHelpers(file, lexUri, 'Record')
}
