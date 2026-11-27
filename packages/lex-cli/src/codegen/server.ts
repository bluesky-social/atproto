import {
  IndentationText,
  type MethodDeclarationStructure,
  type OptionalKind,
  Project,
  type PropertyDeclarationStructure,
  type PropertySignatureStructure,
  VariableDeclarationKind,
} from 'ts-morph'
import { type LexiconDoc, Lexicons } from '@atproto/lexicon'
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

export async function genServerApi(
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
    //= import {createServer as createXrpcServer, Server as XrpcServer} from '@atproto/xrpc-server'
    file.addImportDeclaration({
      moduleSpecifier: '@atproto/xrpc-server',
      namedImports: [
        { name: 'Auth', isTypeOnly: true },
        { name: 'Options', alias: 'XrpcOptions', isTypeOnly: true },
        { name: 'Server', alias: 'XrpcServer' },
        { name: 'StreamConfigOrHandler', isTypeOnly: true },
        { name: 'MethodConfigOrHandler', isTypeOnly: true },
        { name: 'createServer', alias: 'createXrpcServer' },
      ],
    })
    //= import {schemas} from './lexicons.js'
    file.addImportDeclaration({
      moduleSpecifier: './lexicons.js',
      namedImports: [{ name: 'schemas' }],
    })

    // generate type imports
    for (const lexiconDoc of lexiconDocs) {
      if (
        lexiconDoc.defs.main?.type !== 'query' &&
        lexiconDoc.defs.main?.type !== 'subscription' &&
        lexiconDoc.defs.main?.type !== 'procedure'
      ) {
        continue
      }
      file.addImportDeclaration({
        moduleSpecifier: `./types/${lexiconDoc.id.split('.').join('/')}.js`,
        namespaceImport: toTitleCase(lexiconDoc.id),
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

    //= export function createServer(options?: XrpcOptions) { ... }
    file.addFunction({
      name: 'createServer',
      returnType: 'Server',
      parameters: [
        { name: 'options', type: 'XrpcOptions', hasQuestionToken: true },
      ],
      isExported: true,
      statements: [`return new Server(options)`],
    })

    //= export class Server {...}
    file.addClass({
      name: 'Server',
      isExported: true,
      properties: [
        //= xrpc: XrpcServer = createXrpcServer(methodSchemas)
        {
          name: 'xrpc',
          type: 'XrpcServer',
        },
        //= ns: NS
        ...nsidTree.map((ns) => ({
          name: ns.propName,
          type: ns.className,
        })),
      ],
      //= constructor (options?: XrpcOptions) {
      //=  this.xrpc = createXrpcServer(schemas, options)
      //=  {namespace declarations}
      //= }
      ctors: [
        {
          parameters: [
            { name: 'options', type: 'XrpcOptions', hasQuestionToken: true },
          ],
          statements: [
            [
              'this.xrpc = createXrpcServer(schemas, options)',
              ...nsidTree.map(
                (ns) => `this.${ns.propName} = new ${ns.className}(this)`,
              ),
            ].join('\n'),
          ],
        },
      ],
    })

    // generate classes for the schemas
    for (const ns of nsidTree) {
      genNamespaceCls(file, ns)
    }
  })

function genNamespaceCls(file: GenFile, ns: DefTreeNode) {
  //= _server: Server
  const properties: OptionalKind<PropertyDeclarationStructure>[] = [
    { name: '_server', type: 'Server' },
  ]

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
    if (
      userType.def.type !== 'query' &&
      userType.def.type !== 'subscription' &&
      userType.def.type !== 'procedure'
    ) {
      continue
    }
    const moduleName = toTitleCase(userType.nsid)
    const name = toCamelCase(NSID.parse(userType.nsid).name || '')
    const isSubscription = userType.def.type === 'subscription'
    const methodType = isSubscription ? 'streamMethod' : 'method'
    methods.push({
      name,
      typeParameters: [
        {
          name: 'A',
          constraint: 'Auth',
          default: 'void',
        },
      ],
      parameters: [
        {
          name: 'cfg',
          type: isSubscription
            ? `StreamConfigOrHandler<
          A,
          ${moduleName}.QueryParams,
          ${moduleName}.HandlerOutput,
        >`
            : `MethodConfigOrHandler<
          A,
          ${moduleName}.QueryParams,
          ${moduleName}.HandlerInput,
          ${moduleName}.HandlerOutput,
        >`,
        },
      ],
      statements: [
        [
          // Placing schema on separate line, since the following one was being formatted
          // into multiple lines and causing the ts-ignore to ignore the wrong line.
          `const nsid = '${userType.nsid}' // @ts-ignore`,
          `return this._server.xrpc.${methodType}(nsid, cfg)`,
        ].join('\n'),
      ],
    })
  }

  //= export class {ns}NS {...}
  file.addClass({
    name: ns.className,
    isExported: true,
    properties,
    //= constructor(server: Server) {
    //=  this._server = server
    //=  {child namespace declarations}
    //= }
    ctors: [
      {
        parameters: [
          {
            name: 'server',
            type: 'Server',
          },
        ],
        statements: [
          [
            `this._server = server`,
            ...ns.children.map(
              (ns) => `this.${ns.propName} = new ${ns.className}(server)`,
            ),
          ].join('\n'),
        ],
      },
    ],
    methods,
  })

  // recurse
  for (const child of ns.children) {
    genNamespaceCls(file, child)
  }
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
      if (main?.type === 'query' || main?.type === 'procedure') {
        const streamingInput =
          main?.type === 'procedure' &&
          main.input?.encoding &&
          !main.input.schema
        const streamingOutput = main.output?.encoding && !main.output.schema
        if (streamingInput || streamingOutput) {
          //= import stream from 'node:stream'
          file.addImportDeclaration({
            moduleSpecifier: 'node:stream',
            defaultImport: 'stream',
          })
        }
      }

      genCommonImports(file, lexiconDoc.id)

      const imports: Set<string> = new Set()
      for (const defId in lexiconDoc.defs) {
        const def = lexiconDoc.defs[defId]
        const lexUri = `${lexiconDoc.id}#${defId}`
        if (defId === 'main') {
          if (def.type === 'query' || def.type === 'procedure') {
            genXrpcParams(file, lexicons, lexUri)
            genXrpcInput(file, imports, lexicons, lexUri)
            genXrpcOutput(file, imports, lexicons, lexUri, false)
            genServerXrpcMethod(file, lexicons, lexUri)
          } else if (def.type === 'subscription') {
            genXrpcParams(file, lexicons, lexUri)
            genXrpcOutput(file, imports, lexicons, lexUri, false)
            genServerXrpcStreaming(file, lexicons, lexUri)
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

function genServerXrpcMethod(
  file: GenFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['query', 'procedure'])

  //= export interface HandlerInput {...}
  if (def.type === 'procedure' && def.input?.encoding) {
    file.addInterface({
      name: 'HandlerInput',
      isExported: true,
      properties: [
        {
          name: 'encoding',
          type: def.input.encoding
            .split(',')
            .map((v) => `'${v.trim()}'`)
            .join(' | '),
        },
        {
          name: 'body',
          type: def.input.schema
            ? def.input.encoding.includes(',')
              ? 'InputSchema | stream.Readable'
              : 'InputSchema'
            : 'stream.Readable',
        },
      ],
    })
  } else {
    file.addTypeAlias({
      isExported: true,
      name: 'HandlerInput',
      type: 'void',
    })
  }

  // export interface HandlerSuccess {...}
  let hasHandlerSuccess = false
  if (def.output?.schema || def.output?.encoding) {
    hasHandlerSuccess = true
    const handlerSuccess: OptionalKind<PropertySignatureStructure>[] = []

    if (def.output.encoding) {
      handlerSuccess.push({
        name: 'encoding',
        type: def.output.encoding
          .split(',')
          .map((v) => `'${v.trim()}'`)
          .join(' | '),
      })
    }
    if (def.output?.schema) {
      if (def.output.encoding.includes(',')) {
        handlerSuccess.push({
          name: 'body',
          type: 'OutputSchema | Uint8Array | stream.Readable',
        })
      } else {
        handlerSuccess.push({ name: 'body', type: 'OutputSchema' })
      }
    } else if (def.output?.encoding) {
      handlerSuccess.push({
        name: 'body',
        type: 'Uint8Array | stream.Readable',
      })
    }
    handlerSuccess.push({
      name: 'headers?',
      type: '{ [key: string]: string }',
    })

    file.addInterface({
      name: 'HandlerSuccess',
      isExported: true,
      properties: handlerSuccess,
    })
  }

  // export interface HandlerError {...}
  const handlerError: OptionalKind<PropertySignatureStructure>[] = [
    { name: 'status', type: 'number' },
    { name: 'message?', type: 'string' },
  ]
  if (def.errors?.length) {
    handlerError.push({
      name: 'error?',
      type: def.errors.map((err) => `'${err.name}'`).join(' | '),
    })
  }
  file.addInterface({
    name: 'HandlerError',
    isExported: true,
    properties: handlerError,
  })

  // export type HandlerOutput = ...
  file.addTypeAlias({
    isExported: true,
    name: 'HandlerOutput',
    type: `HandlerError | ${hasHandlerSuccess ? 'HandlerSuccess' : 'void'}`,
  })
}

function genServerXrpcStreaming(
  file: GenFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri, ['subscription'])

  file.addImportDeclaration({
    moduleSpecifier: '@atproto/xrpc-server',
    namedImports: [{ name: 'ErrorFrame' }],
  })

  file.addImportDeclaration({
    moduleSpecifier: 'node:http',
    namedImports: [{ name: 'IncomingMessage' }],
  })

  // export type HandlerError = ...
  file.addTypeAlias({
    name: 'HandlerError',
    isExported: true,
    type: `ErrorFrame<${arrayToUnion(def.errors?.map((e) => e.name))}>`,
  })

  // export type HandlerOutput = ...
  file.addTypeAlias({
    isExported: true,
    name: 'HandlerOutput',
    type: `HandlerError | ${def.message?.schema ? 'OutputSchema' : 'void'}`,
  })
}

function arrayToUnion(arr?: string[]) {
  if (!arr?.length) {
    return 'never'
  }
  return arr.map((item) => `'${item}'`).join(' | ')
}
