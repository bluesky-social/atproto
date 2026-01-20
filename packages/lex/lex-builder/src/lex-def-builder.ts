import {
  JSDocStructure,
  OptionalKind,
  SourceFile,
  VariableDeclarationKind,
} from 'ts-morph'
import {
  LexiconArray,
  LexiconArrayItems,
  LexiconBlob,
  LexiconBoolean,
  LexiconBytes,
  LexiconCid,
  LexiconDocument,
  LexiconError,
  LexiconIndexer,
  LexiconInteger,
  LexiconObject,
  LexiconParameters,
  LexiconPayload,
  LexiconPermissionSet,
  LexiconProcedure,
  LexiconQuery,
  LexiconRecord,
  LexiconRef,
  LexiconRefUnion,
  LexiconString,
  LexiconSubscription,
  LexiconToken,
  LexiconUnknown,
} from '@atproto/lex-document'
import { l } from '@atproto/lex-schema'
import {
  RefResolver,
  RefResolverOptions,
  ResolvedRef,
  getPublicIdentifiers,
} from './ref-resolver.js'
import { asNamespaceExport } from './ts-lang.js'

export type LexDefBuilderOptions = RefResolverOptions & {
  lib?: string
  allowLegacyBlobs?: boolean
  pureAnnotations?: boolean
}

/**
 * Utility class to build a TypeScript source file from a lexicon document.
 */
export class LexDefBuilder {
  private readonly refResolver: RefResolver

  constructor(
    private readonly options: LexDefBuilderOptions,
    private readonly file: SourceFile,
    private readonly doc: LexiconDocument,
    indexer: LexiconIndexer,
  ) {
    this.refResolver = new RefResolver(doc, file, indexer, options)
  }

  private pure(code: string) {
    return this.options.pureAnnotations ? markPure(code) : code
  }

  async build() {
    this.file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        { name: '$nsid', initializer: JSON.stringify(this.doc.id) },
      ],
    })

    this.file.addExportDeclaration({
      namedExports: [{ name: '$nsid' }],
    })

    const defs = Object.keys(this.doc.defs)
    if (defs.length) {
      const moduleSpecifier = this.options?.lib ?? '@atproto/lex-schema'
      this.file
        .addImportDeclaration({ moduleSpecifier })
        .addNamedImports([{ name: 'l' }])

      for (const hash of defs) {
        await this.addDef(hash)
      }
    }
  }

  private addUtils(definitions: Record<string, undefined | string>) {
    const entries = Object.entries(definitions).filter(
      (e): e is [(typeof e)[0], NonNullable<(typeof e)[1]>] => e[1] != null,
    )
    if (entries.length) {
      this.file.addVariableStatement({
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: entries.map(([name, initializer]) => ({
          name,
          initializer,
        })),
      })
    }
  }

  private async addDef(hash: string) {
    const def = Object.hasOwn(this.doc.defs, hash) ? this.doc.defs[hash] : null
    if (def == null) return

    switch (def.type) {
      case 'permission-set':
        return this.addPermissionSet(hash, def)
      case 'procedure':
        return this.addProcedure(hash, def)
      case 'query':
        return this.addQuery(hash, def)
      case 'subscription':
        return this.addSubscription(hash, def)
      case 'record':
        return this.addRecord(hash, def)
      case 'token':
        return this.addToken(hash, def)
      case 'object':
        return this.addObject(hash, def)
      case 'array':
        return this.addArray(hash, def)
      default:
        await this.addSchema(hash, def, {
          type: await this.compileContainedType(def),
          schema: await this.compileContainedSchema(def),
          validationUtils: true,
        })
    }
  }

  private async addPermissionSet(hash: string, def: LexiconPermissionSet) {
    const permission = def.permissions.map((def) => {
      const options = stringifyOptions(def, undefined, ['resource', 'type'])
      return this.pure(
        `l.permission(${JSON.stringify(def.resource)}, ${options})`,
      )
    })

    const options = stringifyOptions(def, [
      'title',
      'title:lang',
      'detail',
      'detail:lang',
    ] satisfies (keyof l.PermissionSetOptions)[])

    await this.addSchema(hash, def, {
      schema: this.pure(
        `l.permissionSet($nsid, [${permission.join(',')}], ${options})`,
      ),
    })
  }

  private async addProcedure(hash: string, def: LexiconProcedure) {
    if (hash !== 'main') {
      throw new Error(`Definition ${hash} cannot be of type ${def.type}`)
    }

    // @TODO Build the types instead of using an inferred type.

    const ref = await this.addSchema(hash, def, {
      schema: this.pure(`
        l.procedure(
          $nsid,
          ${await this.compileParamsSchema(def.parameters)},
          ${await this.compilePayload(def.input)},
          ${await this.compilePayload(def.output)},
          ${await this.compileErrors(def.errors)}
        )
      `),
    })

    this.addMethodTypeUtils(ref, def)
    this.addUtils({
      $lxm: this.pure(`${ref.varName}.nsid`),
      $params: this.pure(`${ref.varName}.parameters`),
      $input: this.pure(`${ref.varName}.input`),
      $output: this.pure(`${ref.varName}.output`),
    })
  }

  private async addQuery(hash: string, def: LexiconQuery) {
    if (hash !== 'main') {
      throw new Error(`Definition ${hash} cannot be of type ${def.type}`)
    }

    // @TODO Build the types instead of using an inferred type.

    const ref = await this.addSchema(hash, def, {
      schema: this.pure(`
        l.query(
          $nsid,
          ${await this.compileParamsSchema(def.parameters)},
          ${await this.compilePayload(def.output)},
          ${await this.compileErrors(def.errors)}
        )
      `),
    })

    this.addMethodTypeUtils(ref, def)
    this.addUtils({
      $lxm: this.pure(`${ref.varName}.nsid`),
      $params: `${ref.varName}.parameters`,
      $output: `${ref.varName}.output`,
    })
  }

  private async addSubscription(hash: string, def: LexiconSubscription) {
    if (hash !== 'main') {
      throw new Error(`Definition ${hash} cannot be of type ${def.type}`)
    }

    // @TODO Build the types instead of using an inferred type.

    const ref = await this.addSchema(hash, def, {
      schema: this.pure(`
        l.subscription(
          $nsid,
          ${await this.compileParamsSchema(def.parameters)},
          ${await this.compileBodySchema(def.message?.schema)},
          ${await this.compileErrors(def.errors)}
        )
      `),
    })

    this.addMethodTypeUtils(ref, def)
    this.addUtils({
      $lxm: this.pure(`${ref.varName}.nsid`),
      $params: `${ref.varName}.parameters`,
      $message: `${ref.varName}.message`,
    })
  }

  addMethodTypeUtils(
    ref: ResolvedRef,
    def: LexiconProcedure | LexiconQuery | LexiconSubscription,
  ) {
    this.file.addTypeAlias({
      isExported: true,
      name: 'Params',
      type: `l.InferMethodParams<typeof ${ref.varName}>`,
      docs: compileDocs(def.parameters?.description),
    })

    if (def.type === 'procedure') {
      this.file.addTypeAlias({
        isExported: true,
        name: 'Input',
        type: `l.InferMethodInput<typeof ${ref.varName}>`,
        docs: compileDocs(def.input?.description),
      })

      this.file.addTypeAlias({
        isExported: true,
        name: 'InputBody',
        type: `l.InferMethodInputBody<typeof ${ref.varName}>`,
        docs: compileDocs(def.input?.description),
      })
    }

    if (def.type === 'procedure' || def.type === 'query') {
      this.file.addTypeAlias({
        isExported: true,
        name: 'Output',
        type: `l.InferMethodOutput<typeof ${ref.varName}>`,
        docs: compileDocs(def.output?.description),
      })

      this.file.addTypeAlias({
        isExported: true,
        name: 'OutputBody',
        type: `l.InferMethodOutputBody<typeof ${ref.varName}>`,
        docs: compileDocs(def.output?.description),
      })
    }

    if (def.type === 'subscription') {
      this.file.addTypeAlias({
        isExported: true,
        name: 'Message',
        type: `l.InferSubscriptionMessage<typeof ${ref.varName}>`,
        docs: compileDocs(def.message?.description),
      })
    }
  }

  private async addRecord(hash: string, def: LexiconRecord) {
    if (hash !== 'main') {
      throw new Error(`Definition ${hash} cannot be of type ${def.type}`)
    }

    const key = JSON.stringify(def.key ?? 'any')
    const objectSchema = await this.compileObjectSchema(def.record)

    const properties = await this.compilePropertiesTypes(def.record)
    properties.unshift(`$type: ${JSON.stringify(l.$type(this.doc.id, hash))}`)

    await this.addSchema(hash, def, {
      type: `{ ${properties.join(';')} }`,
      schema: (ref) =>
        this.pure(
          `l.record<${key}, ${ref.typeName}>(${key}, $nsid, ${objectSchema})`,
        ),
      objectUtils: true,
      validationUtils: true,
    })
  }

  private async addObject(hash: string, def: LexiconObject) {
    const objectSchema = await this.compileObjectSchema(def)

    const properties = await this.compilePropertiesTypes(def)
    properties.unshift(`$type?: ${JSON.stringify(l.$type(this.doc.id, hash))}`)

    await this.addSchema(hash, def, {
      type: `{ ${properties.join(';')} }`,
      schema: (ref) =>
        this.pure(
          `l.typedObject<${ref.typeName}>($nsid, ${JSON.stringify(hash)}, ${objectSchema})`,
        ),
      objectUtils: true,
      validationUtils: true,
    })
  }

  private async addToken(hash: string, def: LexiconToken) {
    await this.addSchema(hash, def, {
      schema: this.pure(`l.token($nsid, ${JSON.stringify(hash)})`),
      type: JSON.stringify(l.$type(this.doc.id, hash)),
      validationUtils: true,
    })
  }

  private async addArray(hash: string, def: LexiconArray) {
    // @TODO It could be nice to expose the array item type as a separate type.
    // This was not done (yet) as there is no easy way to name it to avoid
    // collisions.

    const itemSchema = await this.compileContainedSchema(def.items)
    const options = stringifyOptions(def, [
      'minLength',
      'maxLength',
    ] satisfies (keyof l.ArraySchemaOptions)[])

    await this.addSchema(hash, def, {
      type: `(${await this.compileContainedType(def.items)})[]`,
      // @NOTE Not using compileArraySchema to allow specifying the generic
      // parameter to l.array<>.
      schema: (ref) =>
        this.pure(
          `l.array<${ref.typeName}[number]>(${itemSchema}, ${options})`,
        ),
      validationUtils: true,
    })
  }

  private async addSchema(
    hash: string,
    def: { description?: string },
    {
      type,
      schema,
      objectUtils,
      validationUtils,
    }: {
      type?: string | ((ref: ResolvedRef) => string)
      schema?: string | ((ref: ResolvedRef) => string)
      objectUtils?: boolean
      validationUtils?: boolean
    },
  ): Promise<ResolvedRef> {
    const ref = await this.refResolver.resolveLocal(hash)
    const pub = getPublicIdentifiers(hash)

    if (type) {
      this.file.addTypeAlias({
        name: ref.typeName,
        type: typeof type === 'function' ? type(ref) : type,
        docs: compileDocs(def.description),
      })

      this.file.addExportDeclaration({
        isTypeOnly: true,
        namedExports: [
          {
            name: ref.typeName,
            alias:
              ref.typeName === pub.typeName
                ? undefined
                : asNamespaceExport(pub.typeName),
          },
        ],
      })
    }

    if (schema) {
      this.file.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: ref.varName,
            initializer: typeof schema === 'function' ? schema(ref) : schema,
          },
        ],
        docs: compileDocs(def.description),
      })

      this.file.addExportDeclaration({
        namedExports: [
          {
            name: ref.varName,
            alias:
              ref.varName === pub.varName
                ? undefined
                : asNamespaceExport(pub.varName),
          },
        ],
      })
    }

    if (hash === 'main' && objectUtils) {
      this.addUtils({
        $isTypeOf: markPure(`${ref.varName}.isTypeOf.bind(${ref.varName})`),
        $build: markPure(`${ref.varName}.build.bind(${ref.varName})`),
        $type: markPure(`${ref.varName}.$type`),
      })
    }

    if (hash === 'main' && validationUtils) {
      this.addUtils({
        $assert: markPure(`${ref.varName}.assert.bind(${ref.varName})`),
        $check: markPure(`${ref.varName}.check.bind(${ref.varName})`),
        $cast: markPure(`${ref.varName}.cast.bind(${ref.varName})`),
        $ifMatches: markPure(`${ref.varName}.ifMatches.bind(${ref.varName})`),
        $matches: markPure(`${ref.varName}.matches.bind(${ref.varName})`),
        $parse: markPure(`${ref.varName}.parse.bind(${ref.varName})`),
        $safeParse: markPure(`${ref.varName}.safeParse.bind(${ref.varName})`),
        $validate: markPure(`${ref.varName}.validate.bind(${ref.varName})`),
        $safeValidate: markPure(
          `${ref.varName}.safeValidate.bind(${ref.varName})`,
        ),
      })
    }

    return ref
  }

  private async compilePayload(def: LexiconPayload | undefined) {
    if (!def) return this.pure(`l.payload()`)

    // Special case for JSON object payloads
    if (def.encoding === 'application/json' && def.schema?.type === 'object') {
      const properties = await this.compilePropertiesSchemas(def.schema)
      return this.pure(`l.jsonPayload({${properties.join(',')}})`)
    }

    const encodedEncoding = JSON.stringify(def.encoding)
    if (def.schema) {
      const bodySchema = await this.compileBodySchema(def.schema)
      return this.pure(`l.payload(${encodedEncoding}, ${bodySchema})`)
    } else {
      return this.pure(`l.payload(${encodedEncoding})`)
    }
  }

  private async compileBodySchema(
    def?: LexiconRef | LexiconRefUnion | LexiconObject,
  ): Promise<string> {
    if (!def) return 'undefined'
    if (def.type === 'object') return this.compileObjectSchema(def)
    return this.compileContainedSchema(def)
  }

  private async compileParamsSchema(def: undefined | LexiconParameters) {
    if (!def) return this.pure(`l.params()`)

    const properties = await this.compilePropertiesSchemas(def)
    return this.pure(
      properties.length === 0
        ? `l.params()`
        : `l.params({${properties.join(',')}})`,
    )
  }

  private async compileErrors(defs?: readonly LexiconError[]) {
    if (!defs?.length) return ''
    return JSON.stringify(defs.map((d) => d.name))
  }

  private async compileObjectSchema(def: LexiconObject): Promise<string> {
    const properties = await this.compilePropertiesSchemas(def)
    return this.pure(`l.object({${properties.join(',')}})`)
  }

  private async compilePropertiesSchemas(options: {
    properties: Record<string, LexiconArray | LexiconArrayItems>
    required?: readonly string[]
    nullable?: readonly string[]
  }): Promise<string[]> {
    for (const opt of ['required', 'nullable'] as const) {
      if (options[opt]) {
        for (const prop of options[opt]) {
          if (!Object.hasOwn(options.properties, prop)) {
            throw new Error(`No schema found for ${opt} property "${prop}"`)
          }
        }
      }
    }

    return Promise.all(
      Object.entries(options.properties).map((entry) => {
        return this.compilePropertyEntrySchema(entry, options)
      }),
    )
  }

  private async compilePropertiesTypes(options: {
    properties: Record<string, LexiconArray | LexiconArrayItems>
    required?: readonly string[]
    nullable?: readonly string[]
  }) {
    return Promise.all(
      Object.entries(options.properties).map((entry) => {
        return this.compilePropertyEntryType(entry, options)
      }),
    )
  }

  private async compilePropertyEntrySchema(
    [key, def]: [string, LexiconArray | LexiconArrayItems],
    options: {
      required?: readonly string[]
      nullable?: readonly string[]
    },
  ) {
    const isNullable = options.nullable?.includes(key)
    const isRequired = options.required?.includes(key)

    let schema = await this.compileContainedSchema(def)

    if (isNullable) {
      schema = this.pure(`l.nullable(${schema})`)
    }

    if (!isRequired) {
      schema = this.pure(`l.optional(${schema})`)
    }

    return `${JSON.stringify(key)}:${schema}`
  }

  private async compilePropertyEntryType(
    [key, def]: [string, LexiconArray | LexiconArrayItems],
    options: {
      required?: readonly string[]
      nullable?: readonly string[]
    },
  ) {
    const isNullable = options.nullable?.includes(key)
    const isRequired = options.required?.includes(key)

    const optional = isRequired ? '' : '?'
    const append = isNullable ? ' | null' : ''

    const jsDoc = compileLeadingTrivia(def.description) || ''
    const name = JSON.stringify(key)
    const type = await this.compileContainedType(def)

    return `${jsDoc}${name}${optional}:${type}${append}`
  }

  private async compileContainedSchema(
    def: LexiconArray | LexiconArrayItems,
  ): Promise<string> {
    switch (def.type) {
      case 'unknown':
        return this.compileUnknownSchema(def)
      case 'boolean':
        return this.compileBooleanSchema(def)
      case 'integer':
        return this.compileIntegerSchema(def)
      case 'string':
        return this.compileStringSchema(def)
      case 'bytes':
        return this.compileBytesSchema(def)
      case 'blob':
        return this.compileBlobSchema(def)
      case 'cid-link':
        return this.compileCidLinkSchema(def)
      case 'ref':
        return this.compileRefSchema(def)
      case 'union':
        return this.compileRefUnionSchema(def)
      case 'array':
        return this.compileArraySchema(def)
      default:
        // @ts-expect-error
        throw new Error(`Unsupported def type: ${def.type}`)
    }
  }

  private async compileContainedType(
    def: LexiconArray | LexiconArrayItems,
  ): Promise<string> {
    switch (def.type) {
      case 'unknown':
        return this.compileUnknownType(def)
      case 'boolean':
        return this.compileBooleanType(def)
      case 'integer':
        return this.compileIntegerType(def)
      case 'string':
        return this.compileStringType(def)
      case 'bytes':
        return this.compileBytesType(def)
      case 'blob':
        return this.compileBlobType(def)
      case 'cid-link':
        return this.compileCidLinkType(def)
      case 'ref':
        return this.compileRefType(def)
      case 'union':
        return this.compileRefUnionType(def)
      case 'array':
        return this.compileArrayType(def)
      default:
        // @ts-expect-error
        throw new Error(`Unsupported def type: ${def.type}`)
    }
  }

  private async compileArraySchema(def: LexiconArray): Promise<string> {
    const itemSchema = await this.compileContainedSchema(def.items)
    const options = stringifyOptions(def, [
      'minLength',
      'maxLength',
    ] satisfies (keyof l.ArraySchemaOptions)[])
    return this.pure(`l.array(${itemSchema}, ${options})`)
  }

  private async compileArrayType(def: LexiconArray): Promise<string> {
    return `(${await this.compileContainedType(def.items)})[]`
  }

  private async compileUnknownSchema(_def: LexiconUnknown): Promise<string> {
    return this.pure(`l.unknownObject()`)
  }

  private async compileUnknownType(_def: LexiconUnknown): Promise<string> {
    return `l.UnknownObject`
  }

  private withDefault(schema: string, defaultValue: unknown) {
    if (defaultValue === undefined) return schema

    return this.pure(
      `l.withDefault(${schema}, ${JSON.stringify(defaultValue)})`,
    )
  }

  private async compileBooleanSchema(def: LexiconBoolean): Promise<string> {
    const schema = l.boolean()

    if (def.default !== undefined) {
      schema.check(def.default)
    }

    if (hasConst(def)) return this.compileConstSchema(def)

    return this.withDefault(this.pure(`l.boolean()`), def.default)
  }

  private async compileBooleanType(def: LexiconBoolean): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    return 'boolean'
  }

  private async compileIntegerSchema(def: LexiconInteger): Promise<string> {
    const schema = l.integer(def)

    if (hasConst(def)) {
      schema.check(def.const)
    }

    if (hasEnum(def)) {
      for (const val of def.enum) schema.check(val)
    }

    if (def.default !== undefined) {
      schema.check(def.default)
    }

    if (hasConst(def)) return this.compileConstSchema(def)
    if (hasEnum(def)) return this.compileEnumSchema(def)

    const options = stringifyOptions(def, [
      'maximum',
      'minimum',
    ] satisfies (keyof l.IntegerSchemaOptions)[])

    return this.withDefault(this.pure(`l.integer(${options})`), def.default)
  }

  private async compileIntegerType(def: LexiconInteger): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    if (hasEnum(def)) return this.compileEnumType(def)

    return 'number'
  }

  private async compileStringSchema(def: LexiconString): Promise<string> {
    const schema = l.string(def)

    if (hasConst(def)) {
      schema.check(def.const)
    }

    if (hasEnum(def)) {
      for (const val of def.enum) schema.check(val)
    }

    if (def.default !== undefined) {
      schema.check(def.default)
    }

    if (hasConst(def)) return this.compileConstSchema(def)
    if (hasEnum(def)) return this.compileEnumSchema(def)

    const options = stringifyOptions(def, [
      'format',
      'maxGraphemes',
      'minGraphemes',
      'maxLength',
      'minLength',
    ] satisfies (keyof l.StringSchemaOptions)[])

    return this.withDefault(this.pure(`l.string(${options})`), def.default)
  }

  private async compileStringType(def: LexiconString): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    if (hasEnum(def)) return this.compileEnumType(def)

    switch (def.format) {
      case undefined:
        break
      case 'datetime':
        return 'l.DatetimeString'
      case 'uri':
        return 'l.UriString'
      case 'at-uri':
        return 'l.AtUriString'
      case 'did':
        return 'l.DidString'
      case 'handle':
        return 'l.HandleString'
      case 'at-identifier':
        return 'l.AtIdentifierString'
      case 'nsid':
        return 'l.NsidString'
      case 'tid':
        return 'l.TidString'
      case 'cid':
        return 'l.CidString'
      case 'language':
        return 'l.LanguageString'
      case 'record-key':
        return 'l.RecordKeyString'
      default:
        throw new Error(`Unknown string format: ${def.format}`)
    }

    if (def.knownValues?.length) {
      return (
        def.knownValues.map((v) => JSON.stringify(v)).join(' | ') +
        ' | l.UnknownString'
      )
    }

    return 'string'
  }

  private async compileBytesSchema(def: LexiconBytes): Promise<string> {
    const options = stringifyOptions(def, [
      'minLength',
      'maxLength',
    ] satisfies (keyof l.BytesSchemaOptions)[])
    return this.pure(`l.bytes(${options})`)
  }

  private async compileBytesType(_def: LexiconBytes): Promise<string> {
    return 'Uint8Array'
  }

  private async compileBlobSchema(def: LexiconBlob): Promise<string> {
    const opts = { ...def, allowLegacy: this.options.allowLegacyBlobs === true }
    const options = stringifyOptions(opts, [
      'maxSize',
      'accept',
      'allowLegacy',
    ] satisfies (keyof l.BlobSchemaOptions)[])
    return this.pure(`l.blob(${options})`)
  }

  private async compileBlobType(_def: LexiconBlob): Promise<string> {
    return this.options.allowLegacyBlobs
      ? 'l.BlobRef | l.LegacyBlobRef'
      : 'l.BlobRef'
  }

  private async compileCidLinkSchema(_def: LexiconCid): Promise<string> {
    return this.pure(`l.cid()`)
  }

  private async compileCidLinkType(_def: LexiconCid): Promise<string> {
    return 'l.Cid'
  }

  private async compileRefSchema(def: LexiconRef): Promise<string> {
    const { varName, typeName } = await this.refResolver.resolve(def.ref)
    // @NOTE "as any" is needed in schemas with circular refs as TypeScript
    // cannot infer the type of a value that depends on its initializer type
    return this.pure(`l.ref<${typeName}>((() => ${varName}) as any)`)
  }

  private async compileRefType(def: LexiconRef): Promise<string> {
    const ref = await this.refResolver.resolve(def.ref)
    return ref.typeName
  }

  private async compileRefUnionSchema(def: LexiconRefUnion): Promise<string> {
    if (def.refs.length === 0 && def.closed) {
      return this.pure(`l.never()`)
    }

    const refs = await Promise.all(
      def.refs.map(async (ref: string) => {
        const { varName, typeName } = await this.refResolver.resolve(ref)
        // @NOTE "as any" is needed in schemas with circular refs as TypeScript
        // cannot infer the type of a value that depends on its initializer type
        return this.pure(`l.typedRef<${typeName}>((() => ${varName}) as any)`)
      }),
    )

    return this.pure(
      `l.typedUnion([${refs.join(',')}], ${def.closed ?? false})`,
    )
  }

  private async compileRefUnionType(def: LexiconRefUnion): Promise<string> {
    const types = await Promise.all(
      def.refs.map(async (ref) => {
        const { typeName } = await this.refResolver.resolve(ref)
        return `l.$Typed<${typeName}>`
      }),
    )
    if (!def.closed) types.push('l.Unknown$TypedObject')
    return types.join(' | ') || 'never'
  }

  private async compileConstSchema<
    T extends null | number | string | boolean,
  >(def: { const: T; enum?: readonly T[]; default?: T }): Promise<string> {
    if (hasEnum(def) && !def.enum.includes(def.const)) {
      return this.pure(`l.never()`)
    }

    const result = this.pure(`l.literal(${JSON.stringify(def.const)})`)

    return this.withDefault(result, def.default)
  }

  private async compileConstType<
    T extends null | number | string | boolean,
  >(def: { const: T; enum?: readonly T[] }): Promise<string> {
    if (hasEnum(def) && !def.enum.includes(def.const)) {
      return 'never'
    }
    return JSON.stringify(def.const)
  }

  private async compileEnumSchema<T extends null | number | string>(def: {
    enum: readonly T[]
    default?: T
  }): Promise<string> {
    if (def.enum.length === 0) {
      return this.pure(`l.never()`)
    }

    const result =
      def.enum.length === 1
        ? this.pure(`l.literal(${JSON.stringify(def.enum[0])})`)
        : this.pure(`l.enum(${JSON.stringify(def.enum)})`)

    return this.withDefault(result, def.default)
  }

  private async compileEnumType<T extends null | number | string>(def: {
    enum: readonly T[]
  }): Promise<string> {
    return def.enum.map((v) => JSON.stringify(v)).join(' | ') || 'never'
  }
}

type ParsedDescription = OptionalKind<JSDocStructure> & {
  description?: string
  tags?: { tagName: string; text?: string }[]
}

function parseDescription(description: string): ParsedDescription {
  if (/deprecated/i.test(description)) {
    const deprecationMatch = description.match(
      /(\s*deprecated\s*(?:--?|:)?\s*([^-]*)(?:-+)?)/i,
    )
    if (deprecationMatch) {
      const { 1: match, 2: deprecationNotice } = deprecationMatch
      return {
        description: description.replace(match, '').trim() || undefined,
        tags: [{ tagName: 'deprecated', text: deprecationNotice?.trim() }],
      }
    } else {
      return {
        description: description.trim() || undefined,
        tags: [{ tagName: 'deprecated' }],
      }
    }
  }

  return {
    description: description.trim() || undefined,
  }
}

function compileLeadingTrivia(description?: string) {
  if (!description) return undefined
  const parsed = parseDescription(description)
  if (!parsed.description && !parsed.tags?.length) return undefined
  const tags = parsed.tags
    ?.map(({ tagName, text }) => (text ? `@${tagName} ${text}` : `@${tagName}`))
    ?.join('\n')
  const text = `\n${[parsed.description, tags].filter(Boolean).join('\n\n')}`
  return `\n\n/**${text.replaceAll('\n', '\n * ')}\n */\n`
}

function compileDocs(description?: string) {
  if (!description) return undefined
  return [parseDescription(description)]
}

function stringifyOptions<O extends Record<string, unknown>>(
  obj: O,
  include?: (keyof O)[],
  exclude?: (keyof O)[],
) {
  const filtered = Object.entries(obj).filter(
    ([k]) => (!include || include.includes(k)) && !exclude?.includes(k),
  )
  return filtered.length ? JSON.stringify(Object.fromEntries(filtered)) : ''
}

function hasConst<T extends { const?: unknown }>(
  def: T,
): def is T & { const: NonNullable<T['const']> } {
  return def.const != null
}

function hasEnum<T extends { enum?: readonly unknown[] }>(
  def: T,
): def is T & { enum: unknown[] } {
  return def.enum != null
}

function markPure<T extends string>(v: T): `/*#__PURE__*/ ${T}` {
  return `/*#__PURE__*/ ${v}`
}
