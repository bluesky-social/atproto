import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import { MethodSchema } from '@adxp/xrpc'
import * as nsidLib from '@adxp/nsid'
import * as jsonSchemaToTs from 'json-schema-to-typescript'
import { GeneratedAPI, GeneratedFile } from '../types'
import { schemasToNsidTree, NsidNS, toCamelCase, toTitleCase } from './util'

export async function genApi(schemas: MethodSchema[]): Promise<GeneratedAPI> {
  const project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })
  const api: GeneratedAPI = { files: [] }
  const nsidTree = schemasToNsidTree(schemas)
  for (const schema of schemas) {
    api.files.push(await schemaTs(project, schema))
  }
  api.files.push(await schemasTs(project, schemas))
  api.files.push(await indexTs(project, schemas, nsidTree))
  return api
}

const schemaTs = (project, schema: MethodSchema) =>
  gen(project, `/types/${schema.id}.ts`, async (file) => {
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
      if (schema.input.schema) {
        if (Array.isArray(schema.input.encoding)) {
          opts.addProperty({ name: 'data', type: 'InputSchema | Uint8Array' })
        } else {
          opts.addProperty({ name: 'data', type: 'InputSchema' })
        }
      } else if (schema.input.encoding) {
        opts.addProperty({ name: 'data', type: 'Uint8Array' })
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

const schemasTs = (project, schemas: MethodSchema[]) =>
  gen(project, '/schemas.ts', async (file) => {
    //= import {MethodSchema} from '@adxp/xrpc'
    file
      .addImportDeclaration({
        moduleSpecifier: '@adxp/xrpc',
      })
      .addNamedImport({
        name: 'MethodSchema',
      })
    //= export const schemas: MethodSchema[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemas',
          type: 'MethodSchema[]',
          initializer: JSON.stringify(schemas, null, 2),
        },
      ],
    })
  })

const indexTs = (
  project: Project,
  schemas: MethodSchema[],
  nsidTree: NsidNS[],
) =>
  gen(project, '/index.ts', async (file) => {
    //= import {Client as XrpcClients} from '@adxp/xrpc'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@adxp/xrpc',
    })
    xrpcImport.addNamedImport({
      name: 'Client',
      alias: 'XrpcClient',
    })
    //= import {schemas} from './schemas'
    file
      .addImportDeclaration({
        moduleSpecifier: './schemas',
      })
      .addNamedImport({
        name: 'schemas',
      })

    // generate type imports
    for (const schema of schemas) {
      file
        .addImportDeclaration({ moduleSpecifier: `./types/${schema.id}` })
        .setNamespaceImport(toTitleCase(schema.id))
    }

    //= export class API {...}
    const apiCls = file.addClass({
      name: 'API',
      isExported: true,
    })
    //= xrpc: XrpcClient = new XrpcClient()
    apiCls.addProperty({
      name: 'xrpc',
      type: 'XrpcClient',
      initializer: 'new XrpcClient()',
    })

    // generate classes for the schemas
    for (const ns of nsidTree) {
      //= ns: NS
      apiCls.addProperty({
        name: ns.propName,
        type: ns.className,
      })

      // class...
      genNamespaceCls(file, ns)
    }

    //= constructor () {
    //=  this.xrpc.addSchemas(schemas)
    //=  {namespace declarations}
    //= }
    apiCls
      .addConstructor()
      .setBodyText(
        [
          `this.xrpc.addSchemas(schemas)`,
          ...nsidTree.map(
            (ns) => `this.${ns.propName} = new ${ns.className}(this)`,
          ),
        ].join('\n'),
      )
  })

function genNamespaceCls(file: SourceFile, ns: NsidNS) {
  //= export class {ns}NS {...}
  const cls = file.addClass({
    name: ns.className,
    isExported: true,
  })
  //= api: API
  cls.addProperty({
    name: 'api',
    type: 'API',
  })

  for (const child of ns.children) {
    //= child: ChildNS
    cls.addProperty({
      name: child.propName,
      type: child.className,
    })

    // recurse
    genNamespaceCls(file, child)
  }

  //= constructor(api: API) {
  //=  this.api = api
  //=  {child namespace declarations}
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'api',
    type: 'API',
  })
  cons.setBodyText(
    [
      `this.api = api`,
      ...ns.children.map(
        (ns) => `this.${ns.propName} = new ${ns.className}(api)`,
      ),
    ].join('\n'),
  )

  // methods
  for (const schema of ns.schemas) {
    const moduleName = toTitleCase(schema.id)
    const name = toCamelCase(nsidLib.parse(schema.id).name || '')
    const method = cls.addMethod({
      name,
      returnType: `Promise<${moduleName}.Response>`,
    })
    method.addParameter({
      name: 'serviceUri',
      type: 'string',
    })
    method.addParameter({
      name: 'params?',
      type: `${moduleName}.QueryParams`,
    })
    method.addParameter({
      name: 'opts?',
      type: `${moduleName}.CallOptions`,
    })
    method.setBodyText(
      `return this.api.xrpc.call(serviceUri, '${schema.id}', params, opts)`,
    )
  }
}

async function gen(
  project: Project,
  path: string,
  gen: (file: SourceFile) => Promise<void>,
): Promise<GeneratedFile> {
  const file = project.createSourceFile(path)
  await gen(file)
  file.saveSync()
  // TODO run prettier on the output
  return {
    path: path,
    content: project.getFileSystem().readFileSync(path),
  }
}
