import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import { MethodSchema } from '@adxp/xrpc'
import { AdxSchemaDefinition } from '@adxp/schemas'
import { NSID } from '@adxp/nsid'
import * as jsonSchemaToTs from 'json-schema-to-typescript'
import { gen, schemasTs } from './common'
import { GeneratedAPI, Schema } from '../types'
import { schemasToNsidTree, NsidNS, toCamelCase, toTitleCase } from './util'

const ADX_METHODS = {
  list: 'todo.adx.repoListRecords',
  get: 'todo.adx.repoGetRecord',
  create: 'todo.adx.repoCreateRecord',
  put: 'todo.adx.repoPutRecord',
  delete: 'todo.adx.repoDeleteRecord',
}

export async function genClientApi(schemas: Schema[]): Promise<GeneratedAPI> {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const api: GeneratedAPI = { files: [] }
  const nsidTree = schemasToNsidTree(schemas)
  for (const schema of schemas) {
    if ('xrpc' in schema) {
      api.files.push(await methodSchemaTs(project, schema))
    } else if ('adx' in schema) {
      api.files.push(await recordSchemaTs(project, schema))
    }
  }
  api.files.push(await schemasTs(project, schemas))
  api.files.push(await indexTs(project, schemas, nsidTree))
  return api
}

const indexTs = (project: Project, schemas: Schema[], nsidTree: NsidNS[]) =>
  gen(project, '/index.ts', async (file) => {
    //= import {Client as XrpcClient, ServiceClient as XrpcServiceClient} from '@adxp/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@adxp/xrpc',
    })
    xrpcImport.addNamedImports([
      { name: 'Client', alias: 'XrpcClient' },
      { name: 'ServiceClient', alias: 'XrpcServiceClient' },
    ])
    //= import {methodSchemas, recordSchemas} from './schemas'
    file
      .addImportDeclaration({ moduleSpecifier: './schemas' })
      .addNamedImports([{ name: 'methodSchemas' }, { name: 'recordSchemas' }])

    // generate type imports
    for (const schema of schemas) {
      file
        .addImportDeclaration({
          moduleSpecifier: `./types/${schema.id.split('.').join('/')}`,
        })
        .setNamespaceImport(toTitleCase(schema.id))
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
    if (!('adx' in schema)) {
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
        .filter((s) => 'adx' in s)
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
    if (!('xrpc' in schema)) {
      continue
    }
    const moduleName = toTitleCase(schema.id)
    const name = toCamelCase(NSID.parse(schema.id).name || '')
    const method = cls.addMethod({
      name,
      returnType: `Promise<${moduleName}.Response>`,
    })
    method.addParameter({
      name: 'params',
      type: `${moduleName}.QueryParams`,
    })
    method.addParameter({
      name: 'data?',
      type: `${moduleName}.InputSchema`,
    })
    method.addParameter({
      name: 'opts?',
      type: `${moduleName}.CallOptions`,
    })
    method.setBodyText(
      `return this._service.xrpc.call('${schema.id}', params, data, opts)`,
    )
  }

  // record api classes
  for (const schema of ns.schemas) {
    if (!('adx' in schema)) {
      continue
    }
    genRecordCls(file, schema)
  }
}

function genRecordCls(file: SourceFile, schema: AdxSchemaDefinition) {
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
      returnType: `Promise<{records: ({uri: string, value: ${typeModule}.Record})[]}>`,
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ADX_METHODS.list)}.QueryParams, "type">`,
    })
    method.setBodyText(
      [
        `const res = await this._service.xrpc.call('${ADX_METHODS.list}', { type: '${schema.id}', ...params })`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= get()
    const method = cls.addMethod({
      isAsync: true,
      name: 'get',
      returnType: `Promise<{uri: string, value: ${typeModule}.Record}>`,
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ADX_METHODS.get)}.QueryParams, "type">`,
    })
    method.setBodyText(
      [
        `const res = await this._service.xrpc.call('${ADX_METHODS.get}', { type: '${schema.id}', ...params })`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= create()
    const method = cls.addMethod({
      isAsync: true,
      name: 'create',
      returnType: 'Promise<{uri: string}>',
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ADX_METHODS.create)}.QueryParams, "type">`,
    })
    method.addParameter({
      name: 'record',
      type: `${typeModule}.Record`,
    })
    method.setBodyText(
      [
        `record.$type = '${schema.id}'`,
        `const res = await this._service.xrpc.call('${ADX_METHODS.create}', { type: '${schema.id}', ...params }, record, {encoding: 'application/json'})`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= put()
    const method = cls.addMethod({
      isAsync: true,
      name: 'put',
      returnType: 'Promise<{uri: string}>',
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ADX_METHODS.put)}.QueryParams, "type">`,
    })
    method.addParameter({
      name: 'record',
      type: `${typeModule}.Record`,
    })
    method.setBodyText(
      [
        `record.$type = '${schema.id}'`,
        `const res = await this._service.xrpc.call('${ADX_METHODS.put}', { type: '${schema.id}', ...params }, record, {encoding: 'application/json'})`,
        `return res.data`,
      ].join('\n'),
    )
  }
  {
    //= delete()
    const method = cls.addMethod({
      isAsync: true,
      name: 'delete',
      returnType: 'Promise<void>',
    })
    method.addParameter({
      name: 'params',
      type: `Omit<${toTitleCase(ADX_METHODS.delete)}.QueryParams, "type">`,
    })
    method.setBodyText(
      [
        `await this._service.xrpc.call('${ADX_METHODS.delete}', { type: '${schema.id}', ...params })`,
      ].join('\n'),
    )
  }
}

const methodSchemaTs = (project, schema: MethodSchema) =>
  gen(project, `/types/${schema.id.split('.').join('/')}.ts`, async (file) => {
    //= import {Headers} from '@adxp/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@adxp/xrpc',
    })
    xrpcImport.addNamedImport({
      name: 'Headers',
    })

    //= export interface QueryParams {...}
    const qp = file.addInterface({
      name: 'QueryParams',
      isExported: true,
    })
    if (schema.parameters && Object.keys(schema.parameters).length) {
      for (const [key, desc] of Object.entries(schema.parameters)) {
        qp.addProperty({
          name: desc.required ? key : `${key}?`,
          type: desc.type === 'integer' ? 'number' : desc.type,
        })
      }
    }

    //= export interface CallOptions {...}
    const opts = file.addInterface({
      name: 'CallOptions',
      isExported: true,
    })
    opts.addProperty({ name: 'headers?', type: 'Headers' })
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
    res.addProperty({ name: 'error', type: 'boolean' })
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
  })

const recordSchemaTs = (project, schema: AdxSchemaDefinition) =>
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
