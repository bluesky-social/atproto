import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import { MethodSchema, RecordSchema, Schema } from '@atproto/lexicon'
import { NSID } from '@atproto/nsid'
import * as jsonSchemaToTs from 'json-schema-to-typescript'
import { emptyObjectSchema, gen, schemasTs } from './common'
import { GeneratedAPI } from '../types'
import {
  schemasToNsidTree,
  NsidNS,
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

export async function genClientApi(schemas: Schema[]): Promise<GeneratedAPI> {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const api: GeneratedAPI = { files: [] }
  const nsidTree = schemasToNsidTree(schemas)
  const nsidTokens = schemasToNsidTokens(schemas)
  for (const schema of schemas) {
    if (schema.type === 'query' || schema.type === 'procedure') {
      api.files.push(await methodSchemaTs(project, schema))
    } else if (schema.type === 'record') {
      api.files.push(await recordSchemaTs(project, schema))
    }
  }
  api.files.push(await schemasTs(project, schemas))
  api.files.push(await indexTs(project, schemas, nsidTree, nsidTokens))
  return api
}

const indexTs = (
  project: Project,
  schemas: Schema[],
  nsidTree: NsidNS[],
  nsidTokens: Record<string, string[]>,
) =>
  gen(project, '/index.ts', async (file) => {
    //= import {Client as XrpcClient, ServiceClient as XrpcServiceClient} from '@atproto/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc',
    })
    xrpcImport.addNamedImports([
      { name: 'Client', alias: 'XrpcClient' },
      { name: 'ServiceClient', alias: 'XrpcServiceClient' },
    ])
    //= import {methodSchemas, recordSchemas} from './schemas'
    file
      .addImportDeclaration({ moduleSpecifier: './schemas' })
      .addNamedImports([{ name: 'methodSchemas' }, { name: 'recordSchemas' }])

    // generate type imports and re-exports
    for (const schema of schemas) {
      if (schema.type === 'token') continue
      const moduleSpecifier = `./types/${schema.id.split('.').join('/')}`
      file
        .addImportDeclaration({ moduleSpecifier })
        .setNamespaceImport(toTitleCase(schema.id))
      file
        .addExportDeclaration({ moduleSpecifier })
        .setNamespaceExport(toTitleCase(schema.id))
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

    //= export class Client {...}
    const clientCls = file.addClass({
      name: 'Client',
      isExported: true,
    })
    //= xrpc: XrpcClient = new XrpcClient()
    clientCls.addProperty({
      name: 'xrpc',
      type: 'XrpcClient',
      initializer: 'new XrpcClient()',
    })
    //= constructor () {
    //=   this.xrpc.addSchemas(methodSchemas)
    //= }
    clientCls
      .addConstructor()
      .setBodyText(`this.xrpc.addSchemas(methodSchemas)`)
    //= service(serviceUri: string | URL): ServiceClient {
    //=   return new ServiceClient(this, this.xrpc.service(serviceUri))
    //= }
    clientCls
      .addMethod({
        name: 'service',
        parameters: [{ name: 'serviceUri', type: 'string | URL' }],
        returnType: 'ServiceClient',
      })
      .setBodyText(
        `return new ServiceClient(this, this.xrpc.service(serviceUri))`,
      )

    //= const defaultInst = new Client()
    //= export default defaultInst
    file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'defaultInst',
          initializer: 'new Client()',
        },
      ],
    })
    file.insertText(file.getFullText().length, `export default defaultInst`)

    //= export class ServiceClient {...}
    const serviceClientCls = file.addClass({
      name: 'ServiceClient',
      isExported: true,
    })
    //= _baseClient: Client
    serviceClientCls.addProperty({ name: '_baseClient', type: 'Client' })
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
    //= constructor (baseClient: Client, xrpcService: XrpcServiceClient) {
    //=   this.baseClient = baseClient
    //=   this.xrpcService = xrpcService
    //=   {namespace declarations}
    //= }
    serviceClientCls
      .addConstructor({
        parameters: [
          { name: 'baseClient', type: 'Client' },
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

function genNamespaceCls(file: SourceFile, ns: NsidNS) {
  //= export class {ns}NS {...}
  const cls = file.addClass({
    name: ns.className,
    isExported: true,
  })
  //= _service: ServiceClient
  cls.addProperty({
    name: '_service',
    type: 'ServiceClient',
  })

  for (const schema of ns.schemas) {
    if (schema.type !== 'record') {
      continue
    }
    //= type: TypeRecord
    const name = NSID.parse(schema.id).name || ''
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

  //= constructor(service: ServiceClient) {
  //=  this._service = service
  //=  {child namespace prop declarations}
  //=  {record prop declarations}
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'service',
    type: 'ServiceClient',
  })
  cons.setBodyText(
    [
      `this._service = service`,
      ...ns.children.map(
        (ns) => `this.${ns.propName} = new ${ns.className}(service)`,
      ),
      ...ns.schemas
        .filter((s) => s.type === 'record')
        .map((schema) => {
          const name = NSID.parse(schema.id).name || ''
          return `this.${toCamelCase(name)} = new ${toTitleCase(
            name,
          )}Record(service)`
        }),
    ].join('\n'),
  )

  // methods
  for (const schema of ns.schemas) {
    if (schema.type !== 'query' && schema.type !== 'procedure') {
      continue
    }
    const moduleName = toTitleCase(schema.id)
    const name = toCamelCase(NSID.parse(schema.id).name || '')
    const method = cls.addMethod({
      name,
      returnType: `Promise<${moduleName}.Response>`,
    })
    if (schema.type === 'query') {
      method.addParameter({
        name: 'params?',
        type: `${moduleName}.QueryParams`,
      })
    } else if (schema.type === 'procedure') {
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
        schema.type === 'query'
          ? `.call('${schema.id}', params, undefined, opts)`
          : `.call('${schema.id}', opts?.qp, data, opts)`,
        `  .catch((e) => {`,
        `    throw ${moduleName}.toKnownErr(e)`,
        `  })`,
      ].join('\n'),
    )
  }

  // record api classes
  for (const schema of ns.schemas) {
    if (schema.type !== 'record') {
      continue
    }
    genRecordCls(file, schema)
  }
}

function genRecordCls(file: SourceFile, schema: RecordSchema) {
  //= export class {type}Record {...}
  const name = NSID.parse(schema.id).name || ''
  const cls = file.addClass({
    name: `${toTitleCase(name)}Record`,
    isExported: true,
  })
  //= _service: ServiceClient
  cls.addProperty({
    name: '_service',
    type: 'ServiceClient',
  })

  //= constructor(service: ServiceClient) {
  //=  this._service = service
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'service',
    type: 'ServiceClient',
  })
  cons.setBodyText(`this._service = service`)

  // methods
  const typeModule = toTitleCase(schema.id)
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
        `const res = await this._service.xrpc.call('${ATP_METHODS.list}', { collection: '${schema.id}', ...params })`,
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
        `const res = await this._service.xrpc.call('${ATP_METHODS.get}', { collection: '${schema.id}', ...params })`,
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
    method.setBodyText(
      [
        `record.$type = '${schema.id}'`,
        `const res = await this._service.xrpc.call('${ATP_METHODS.create}', undefined, { collection: '${schema.id}', ...params, record }, {encoding: 'application/json', headers })`,
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
  //       `record.$type = '${schema.id}'`,
  //       `const res = await this._service.xrpc.call('${ATP_METHODS.put}', undefined, { collection: '${schema.id}', record, ...params }, {encoding: 'application/json', headers})`,
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
        `await this._service.xrpc.call('${ATP_METHODS.delete}', undefined, { collection: '${schema.id}', ...params }, { headers })`,
      ].join('\n'),
    )
  }
}

const methodSchemaTs = (project, schema: MethodSchema) =>
  gen(project, `/types/${schema.id.split('.').join('/')}.ts`, async (file) => {
    //= import {Headers, XRPCError} from '@atproto/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc',
    })
    xrpcImport.addNamedImports([{ name: 'Headers' }, { name: 'XRPCError' }])

    //= export interface QueryParams {...}
    file.insertText(
      file.getFullText().length,
      '\n' +
        (await jsonSchemaToTs.compile(
          schema.parameters ?? emptyObjectSchema,
          'QueryParams',
          {
            bannerComment: '',
            additionalProperties: false,
          },
        )),
    )

    //= export interface CallOptions {...}
    const opts = file.addInterface({
      name: 'CallOptions',
      isExported: true,
    })
    opts.addProperty({ name: 'headers?', type: 'Headers' })
    if (schema.type === 'procedure') {
      opts.addProperty({ name: 'qp?', type: 'QueryParams' })
    }
    if (schema.input) {
      if (Array.isArray(schema.input.encoding)) {
        opts.addProperty({
          name: 'encoding',
          type: schema.input.encoding.map((v) => `'${v}'`).join(' | '),
        })
      } else if (typeof schema.input.encoding === 'string') {
        opts.addProperty({
          name: 'encoding',
          type: `'${schema.input.encoding}'`,
        })
      }
    }

    //= export interface InputSchema {...}
    if (schema.input?.schema) {
      file.insertText(
        file.getFullText().length,
        '\n' +
          (await jsonSchemaToTs.compile(schema.input?.schema, 'InputSchema', {
            bannerComment: '',
            additionalProperties: false,
          })),
      )
    } else if (schema.input?.encoding) {
      file.addTypeAlias({
        isExported: true,
        name: 'InputSchema',
        type: 'string | Uint8Array',
      })
    } else {
      file.addTypeAlias({
        isExported: true,
        name: 'InputSchema',
        type: 'undefined',
      })
    }

    //= export interface OutputSchema {...}
    if (schema.output?.schema) {
      file.insertText(
        file.getFullText().length,
        '\n' +
          (await jsonSchemaToTs.compile(schema.output?.schema, 'OutputSchema', {
            bannerComment: '',
            additionalProperties: false,
          })),
      )
    }

    // export interface Response {...}
    const res = file.addInterface({
      name: 'Response',
      isExported: true,
    })
    res.addProperty({ name: 'success', type: 'boolean' })
    res.addProperty({ name: 'headers', type: 'Headers' })
    if (schema.output?.schema) {
      if (Array.isArray(schema.output.encoding)) {
        res.addProperty({ name: 'data', type: 'OutputSchema | Uint8Array' })
      } else {
        res.addProperty({ name: 'data', type: 'OutputSchema' })
      }
    } else if (schema.output?.encoding) {
      res.addProperty({ name: 'data', type: 'Uint8Array' })
    }

    // export class {errcode}Error {...}
    const customErrors: { name: string; cls: string }[] = []
    for (const error of schema.errors || []) {
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
  })

const recordSchemaTs = (project, schema: RecordSchema) =>
  gen(project, `/types/${schema.id.split('.').join('/')}.ts`, async (file) => {
    //= export interface Record {...}
    file.insertText(
      file.getFullText().length,
      '\n' +
        (await jsonSchemaToTs.compile(schema.record || {}, 'Record', {
          bannerComment: '',
          additionalProperties: true,
        })),
    )
  })
