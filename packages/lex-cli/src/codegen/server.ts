import {
  IndentationText,
  Project,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import { Schema, MethodSchema, RecordSchema } from '@atproto/lexicon'
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

export async function genServerApi(schemas: Schema[]): Promise<GeneratedAPI> {
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
    //= import {createServer as createXrpcServer, Server as XrpcServer} from '@atproto/xrpc-server'
    const xrpcImport = file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc-server',
    })
    xrpcImport.addNamedImport({
      name: 'createServer',
      alias: 'createXrpcServer',
    })
    xrpcImport.addNamedImport({
      name: 'Server',
      alias: 'XrpcServer',
    })
    //= import {methodSchemas} from './schemas'
    file
      .addImportDeclaration({
        moduleSpecifier: './schemas',
      })
      .addNamedImport({
        name: 'methodSchemas',
      })

    // generate type imports
    for (const schema of schemas) {
      if (schema.type !== 'query' && schema.type !== 'procedure') {
        continue
      }
      file
        .addImportDeclaration({
          moduleSpecifier: `./types/${schema.id.split('.').join('/')}`,
        })
        .setNamespaceImport(toTitleCase(schema.id))
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

    //= export function createServer() { ... }
    const createServerFn = file.addFunction({
      name: 'createServer',
      returnType: 'Server',
      isExported: true,
    })
    createServerFn.setBodyText(`return new Server()`)

    //= export class Server {...}
    const serverCls = file.addClass({
      name: 'Server',
      isExported: true,
    })
    //= xrpc: XrpcServer = createXrpcServer(methodSchemas)
    serverCls.addProperty({
      name: 'xrpc',
      type: 'XrpcServer',
      initializer: 'createXrpcServer(methodSchemas)',
    })

    // generate classes for the schemas
    for (const ns of nsidTree) {
      //= ns: NS
      serverCls.addProperty({
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
    serverCls
      .addConstructor()
      .setBodyText(
        [
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
  //= _server: Server
  cls.addProperty({
    name: '_server',
    type: 'Server',
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

  //= constructor(server: Server) {
  //=  this._server = server
  //=  {child namespace declarations}
  //= }
  const cons = cls.addConstructor()
  cons.addParameter({
    name: 'server',
    type: 'Server',
  })
  cons.setBodyText(
    [
      `this._server = server`,
      ...ns.children.map(
        (ns) => `this.${ns.propName} = new ${ns.className}(server)`,
      ),
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
    })
    method.addParameter({
      name: 'handler',
      type: `${moduleName}.Handler`,
    })
    method.setBodyText(
      [
        // Placing schema on separate line, since the following one was being formatted
        // into multiple lines and causing the ts-ignore to ignore the wrong line.
        `const schema = '${schema.id}' // @ts-ignore`,
        `return this._server.xrpc.method(schema, handler)`,
      ].join('\n'),
    )
  }
}

const methodSchemaTs = (project, schema: MethodSchema) =>
  gen(project, `/types/${schema.id.split('.').join('/')}.ts`, async (file) => {
    //= import express from 'express'
    file.addImportDeclaration({
      moduleSpecifier: 'express',
      defaultImport: 'express',
    })

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

    //= export interface HandlerInput {...}
    if (schema.input?.encoding) {
      const handlerInput = file.addInterface({
        name: 'HandlerInput',
        isExported: true,
      })

      if (Array.isArray(schema.input.encoding)) {
        handlerInput.addProperty({
          name: 'encoding',
          type: schema.input.encoding.map((v) => `'${v}'`).join(' | '),
        })
      } else if (typeof schema.input.encoding === 'string') {
        handlerInput.addProperty({
          name: 'encoding',
          type: `'${schema.input.encoding}'`,
        })
      }
      if (schema.input.schema) {
        if (Array.isArray(schema.input.encoding)) {
          handlerInput.addProperty({
            name: 'body',
            type: 'InputSchema | Uint8Array',
          })
        } else {
          handlerInput.addProperty({ name: 'body', type: 'InputSchema' })
        }
      } else if (schema.input.encoding) {
        handlerInput.addProperty({ name: 'body', type: 'Uint8Array' })
      }
    } else {
      file.addTypeAlias({
        isExported: true,
        name: 'HandlerInput',
        type: 'undefined',
      })
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

    // export interface HandlerSuccess {...}
    let hasHandlerSuccess = false
    if (schema.output?.schema || schema.output?.encoding) {
      hasHandlerSuccess = true
      const handlerSuccess = file.addInterface({
        name: 'HandlerSuccess',
        isExported: true,
      })
      if (Array.isArray(schema.output.encoding)) {
        handlerSuccess.addProperty({
          name: 'encoding',
          type: schema.output.encoding.map((v) => `'${v}'`).join(' | '),
        })
      } else if (typeof schema.output.encoding === 'string') {
        handlerSuccess.addProperty({
          name: 'encoding',
          type: `'${schema.output.encoding}'`,
        })
      }
      if (schema.output?.schema) {
        if (Array.isArray(schema.output.encoding)) {
          handlerSuccess.addProperty({
            name: 'body',
            type: 'OutputSchema | Uint8Array',
          })
        } else {
          handlerSuccess.addProperty({ name: 'body', type: 'OutputSchema' })
        }
      } else if (schema.output?.encoding) {
        handlerSuccess.addProperty({ name: 'body', type: 'Uint8Array' })
      }
    }

    // export interface HandlerError {...}
    const handlerError = file.addInterface({
      name: 'HandlerError',
      isExported: true,
    })
    handlerError.addProperties([
      { name: 'status', type: 'number' },
      { name: 'message?', type: 'string' },
    ])
    if (schema.errors?.length) {
      handlerError.addProperty({
        name: 'error?',
        type: schema.errors.map((err) => `'${err.name}'`).join(' | '),
      })
    }

    // export type HandlerOutput = ...
    file.addTypeAlias({
      isExported: true,
      name: 'HandlerOutput',
      type: `HandlerError | ${hasHandlerSuccess ? 'HandlerSuccess' : 'void'}`,
    })

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

    file.addTypeAlias({
      name: 'Handler',
      isExported: true,
      type: `(
        params: QueryParams,
        input: HandlerInput,
        req: express.Request,
        res: express.Response,
      ) => Promise<HandlerOutput> | HandlerOutput`,
    })
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
