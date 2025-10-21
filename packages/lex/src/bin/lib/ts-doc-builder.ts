import assert from 'node:assert'
import { SourceFile, VariableDeclarationKind } from 'ts-morph'
import {
  LexiconArray,
  LexiconBase,
  LexiconBlob,
  LexiconBoolean,
  LexiconBytes,
  LexiconCid,
  LexiconDocument,
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
} from '../../doc/index.js'
import { l } from '../../lex/index.js'
import { TsRefResolver, useRecordExport } from './ts-ref-resolver.js'

export type TsDocBuilderOptions = {
  pureAnnotations?: boolean
}

/**
 * Utility class to build a TypeScript source file from a lexicon document.
 */
export class TsDocBuilder {
  private readonly refResolver: TsRefResolver

  constructor(
    private readonly options: TsDocBuilderOptions,
    private readonly file: SourceFile,
    private readonly doc: LexiconDocument,
    indexer: LexiconIndexer,
  ) {
    this.refResolver = new TsRefResolver(doc, file, indexer)
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
      this.file
        .addImportDeclaration({ moduleSpecifier: '@atproto/lex/lex' })
        .addNamedImports([{ name: 'l' }])

      for (const hash of defs) {
        await this.addDef(hash)
      }
    }
  }

  private async addDef(hash: string) {
    const def = l.hasOwn(this.doc.defs, hash) ? this.doc.defs[hash] : null
    if (def == null) return

    if (hash === 'main') {
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
        default:
          return this.addBaseDef(hash, def)
      }
    } else {
      switch (def.type) {
        case 'permission-set':
        case 'procedure':
        case 'query':
        case 'subscription':
        case 'record':
          throw new Error(`Definition ${hash} cannot be of type ${def.type}`)
        case 'token':
          return this.addToken(hash, def)
        case 'object':
          return this.addObject(hash, def)
        default:
          return this.addBaseDef(hash, def)
      }
    }
  }

  private async addPermissionSet(hash: string, def: LexiconPermissionSet) {
    const permission = def.permissions.map((def) => {
      const options = stringifyOptionalOptions(def, ['resource', 'type'])
      return this.pure(
        `l.permission(${JSON.stringify(def.resource)}, ${options})`,
      )
    })

    const options = stringifyOptionalOptions(def, [
      'type',
      'description',
      'permissions',
    ])

    await this.addSchema(hash, def, {
      schema: this.pure(
        `l.permissionSet($nsid, [${permission.join(',')}], ${options})`,
      ),
    })
  }

  private async addProcedure(hash: string, def: LexiconProcedure) {
    const ref = await this.refResolver.resolveLocal(hash)

    await this.addSchema(hash, def, {
      schema: this.pure(`
        l.procedure(
          $nsid,
          ${await this.compilePayloadSchema(def.input)},
          ${await this.compilePayloadSchema(def.output)}
        )
      `),
    })

    const inputTypeStmt = this.file.addTypeAlias({
      isExported: true,
      name: 'Input',
      type: `l.InferProcedureInput<typeof ${ref.varName}>`,
    })

    addJsDoc(inputTypeStmt, def.input)

    const outputTypeStmt = this.file.addTypeAlias({
      isExported: true,
      name: 'Output',
      type: `l.InferProcedureOutput<typeof ${ref.varName}>`,
    })

    addJsDoc(outputTypeStmt, def.output)
  }

  private async compilePayloadSchema(def: LexiconPayload | undefined) {
    if (!def) return this.pure(`l.payload()`)

    const encodedEncoding = JSON.stringify(def.encoding)
    if (def.schema) {
      const bodySchema = await this.compileBodySchema(def.schema)
      return this.pure(`l.payload(${encodedEncoding}, ${bodySchema})`)
    } else {
      return this.pure(`l.payload(${encodedEncoding})`)
    }
  }

  private async addQuery(hash: string, def: LexiconQuery) {
    const ref = await this.refResolver.resolveLocal(hash)

    const output = await this.compilePayloadSchema(def.output)
    const params = await this.compileParametersSchema(def.parameters)

    await this.addSchema(hash, def, {
      schema: this.pure(`l.query($nsid, ${output}, ${params})`),
    })

    this.file.addTypeAlias({
      isExported: true,
      name: 'Params',
      type: `l.InferQueryParams<typeof ${ref.varName}>`,
    })

    this.file.addTypeAlias({
      isExported: true,
      name: 'Output',
      type: `l.InferQueryOutput<typeof ${ref.varName}>`,
    })
  }

  private async compileParametersSchema(def: LexiconParameters | undefined) {
    if (!def) return this.pure(`l.params({})`)

    const properties = await this.compilePropertiesSchemas(def)
    const options = stringifyOptionalOptions(def, [
      'type',
      'description',
      'properties',
    ])
    return this.pure(`l.params({${properties.join(',')}}, ${options})`)
  }

  private async addSubscription(hash: string, def: LexiconSubscription) {
    const ref = await this.refResolver.resolveLocal(hash)

    const params = await this.compileParametersSchema(def.parameters)
    const message = await this.compileBodySchema(def.message?.schema)

    await this.addSchema(hash, def, {
      schema: this.pure(`l.subscription($nsid, ${params}, ${message})`),
    })

    this.file.addTypeAlias({
      isExported: true,
      name: 'Params',
      type: `l.InferSubscriptionParameters<typeof ${ref.varName}>`,
    })

    this.file.addTypeAlias({
      isExported: true,
      name: 'Message',
      type: `l.InferSubscriptionMessage<typeof ${ref.varName}>`,
    })
  }

  private async compileBodySchema(
    def?: LexiconRef | LexiconRefUnion | LexiconObject,
  ): Promise<string> {
    if (!def) return 'undefined'
    if (def.type === 'object') return this.compileObjectSchema(def)
    return this.compileBaseSchema(def)
  }

  private async addRecord(hash: string, def: LexiconRecord) {
    const ref = await this.refResolver.resolveLocal(hash)

    const key = JSON.stringify(def.key ?? 'any')
    const objectSchema = await this.compileObjectSchema(def.record)

    const properties = await this.compilePropertiesTypes(def.record)
    properties.unshift(`$type: ${JSON.stringify(l.$type(this.doc.id, hash))}`)

    await this.addSchema(hash, def, {
      type: `{ ${properties.join(';')} }`,
      schema: this.pure(
        `l.record<${key}, ${ref.typeName}>(${key}, $nsid, ${objectSchema})`,
      ),
    })

    // Also export a "Record" type alias for the record definition, if not
    // already defined in the lexicon (to avoid conflicts)
    if (useRecordExport(this.doc, hash)) {
      this.file.addTypeAlias({
        isExported: true,
        name: 'Record',
        type: ref.typeName,
      })
    }

    if (hash === 'main') {
      this.addObjectUtils(ref.varName)
      this.addValidationUtils(ref.varName)
    }
  }

  private async addObject(hash: string, def: LexiconObject) {
    const ref = await this.refResolver.resolveLocal(hash)

    const objectSchema = await this.compileObjectSchema(def)

    const properties = await this.compilePropertiesTypes(def)
    properties.unshift(`$type?: ${JSON.stringify(l.$type(this.doc.id, hash))}`)

    await this.addSchema(hash, def, {
      type: `{ ${properties.join(';')} }`,
      schema: this.pure(
        `l.typedObject<${ref.typeName}>($nsid, ${JSON.stringify(hash)}, ${objectSchema})`,
      ),
    })

    if (hash === 'main') {
      this.addObjectUtils(ref.varName)
      this.addValidationUtils(ref.varName)
    }
  }

  private async addObjectUtils(varName: string) {
    // @NOTE we must not use this.pure() here because the fn.bind() *must* be
    // marked as pure for tree-shaking to work properly
    this.file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: '$typed',
          initializer: markPure(`${varName}.$typed.bind(${varName})`),
        },
        {
          name: '$build',
          initializer: markPure(`${varName}.$build.bind(${varName})`),
        },
      ],
    })
  }

  private async addValidationUtils(varName: string) {
    // @NOTE we must not use this.pure() here because the fn.bind() *must* be
    // marked as pure for tree-shaking to work properly
    this.file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: '$is',
          initializer: markPure(`${varName}.$is.bind(${varName})`),
        },
        {
          name: '$parse',
          initializer: markPure(`${varName}.$parse.bind(${varName})`),
        },
        {
          name: '$assert',
          initializer: markPure(`${varName}.$assert.bind(${varName})`),
        },
        {
          name: '$validate',
          initializer: markPure(`${varName}.$validate.bind(${varName})`),
        },
      ],
    })
  }

  private async addToken(hash: string, def: LexiconToken) {
    const ref = await this.refResolver.resolveLocal(hash)

    await this.addSchema(hash, def, {
      schema: this.pure(`l.token($nsid, ${JSON.stringify(hash)})`),
      type: JSON.stringify(l.$type(this.doc.id, hash)),
    })

    if (hash === 'main') this.addValidationUtils(ref.varName)
  }

  private async addBaseDef(hash: string, def: LexiconBase | LexiconArray) {
    const ref = await this.refResolver.resolveLocal(hash)

    await this.addSchema(hash, def, {
      type: await this.compileBaseType(def),
      schema: await this.compileBaseSchema(def),
    })

    if (hash === 'main') this.addValidationUtils(ref.varName)
  }

  private async addSchema(
    hash: string,
    def: { description?: string },
    {
      type,
      schema,
    }: {
      type?: string
      schema: string
    },
  ) {
    const ref = await this.refResolver.resolveLocal(hash)

    if (type) {
      const typeStmt = this.file.addTypeAlias({
        isExported: true,
        name: ref.typeName,
        type,
      })

      addJsDoc(typeStmt, def)
    }

    const constStmt = this.file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: ref.varName, initializer: schema }],
    })

    addJsDoc(constStmt, def)

    this.file.addExportDeclaration({
      namedExports: [
        {
          name: ref.varName,
          alias: ref.varName === hash ? undefined : hash,
        },
      ],
    })
  }

  private async compileObjectSchema(def: LexiconObject): Promise<string> {
    const properties = await this.compilePropertiesSchemas(def)
    const options = stringifyOptionalOptions(def, [
      'type',
      'description',
      'properties',
    ])
    return this.pure(`l.object({${properties.join(',')}}, ${options})`)
  }

  private async compilePropertiesSchemas(options: {
    properties: Record<string, LexiconBase | LexiconArray>
    required?: readonly string[]
  }) {
    for (const prop of options.required || []) {
      if (!l.hasOwn(options.properties, prop)) {
        throw new Error(`Required property "${prop}" not found in properties`)
      }
    }

    return Promise.all(
      Object.entries(options.properties).map(
        this.compilePropertyEntrySchema,
        this,
      ),
    )
  }

  private async compilePropertiesTypes(options: {
    properties: Record<string, LexiconBase | LexiconArray>
    required?: readonly string[]
    nullable?: readonly string[]
  }) {
    return Promise.all(
      Object.entries(options.properties).map((entry) => {
        return this.compilePropertyEntryType(entry, options)
      }),
    )
  }

  private async compilePropertyEntrySchema([key, value]: [
    string,
    LexiconBase | LexiconArray,
  ]) {
    const name = JSON.stringify(key)
    const schema = await this.compileBaseSchema(value)
    return `${name}:${schema}`
  }

  private async compilePropertyEntryType(
    [key, def]: [string, LexiconBase | LexiconArray],
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
    const type = await this.compileBaseType(def)

    return `${jsDoc}${name}${optional}:${type}${append}`
  }

  private async compileBaseSchema(
    def: LexiconBase | LexiconArray,
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

  private async compileBaseType(
    def: LexiconBase | LexiconArray,
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
    const itemSchema = await this.compileBaseSchema(def.items)
    const options = stringifyOptionalOptions(def, [
      'type',
      'description',
      'items',
    ])
    return this.pure(`l.array(${itemSchema}, ${options})`)
  }

  private async compileArrayType(def: LexiconArray): Promise<string> {
    return `Array<${await this.compileBaseType(def.items)}>`
  }

  private async compileUnknownSchema(_def: LexiconUnknown): Promise<string> {
    return this.pure(`l.unknown()`)
  }

  private async compileUnknownType(_def: LexiconUnknown): Promise<string> {
    return `unknown`
  }

  private async compileBooleanSchema(def: LexiconBoolean): Promise<string> {
    if (hasConst(def)) return this.compileConstSchema(def)

    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.boolean(${options})`)
  }

  private async compileBooleanType(def: LexiconBoolean): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    return 'boolean'
  }

  private async compileIntegerSchema(def: LexiconInteger): Promise<string> {
    if (hasConst(def)) {
      const schema = l.integer(def)
      assert(
        schema.$is(def.const),
        `Integer const ${def.const} is out of bounds`,
      )
    }

    if (hasEnum(def)) {
      const schema = l.integer(def)
      for (const val of def.enum) {
        assert(schema.$is(val), `Integer enum value ${val} is out of bounds`)
      }
    }

    if (hasConst(def)) return this.compileConstSchema(def)
    if (hasEnum(def)) return this.compileEnumSchema(def)

    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.integer(${options})`)
  }

  private async compileIntegerType(def: LexiconInteger): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    if (hasEnum(def)) return this.compileEnumType(def)

    return 'number'
  }

  private async compileStringSchema(def: LexiconString): Promise<string> {
    if (hasConst(def)) {
      const schema = l.string(def)
      assert(
        schema.$is(def.const),
        `String const "${def.const}" does not match format`,
      )
    } else if (hasEnum(def)) {
      const schema = l.string(def)
      for (const val of def.enum) {
        assert(
          schema.$is(val),
          `String enum value "${val}" does not match format`,
        )
      }
    }

    if (hasConst(def)) return this.compileConstSchema(def)
    if (hasEnum(def)) return this.compileEnumSchema(def)

    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.string(${options})`)
  }

  private async compileStringType(def: LexiconString): Promise<string> {
    if (hasConst(def)) return this.compileConstType(def)
    if (hasEnum(def)) return this.compileEnumType(def)

    switch (def.format) {
      case 'datetime':
        return 'l.Datetime'
      case 'uri':
        return 'l.Uri'
      case 'at-uri':
        return 'l.AtUri'
      case 'did':
        return 'l.Did'
      case 'handle':
        return 'l.Handle'
      case 'at-identifier':
        return 'l.AtIdentifier'
      case 'nsid':
        return 'l.Nsid'
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
    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.bytes(${options})`)
  }

  private async compileBytesType(_def: LexiconBytes): Promise<string> {
    return 'Uint8Array'
  }

  private async compileBlobSchema(def: LexiconBlob): Promise<string> {
    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.blob(${options})`)
  }

  private async compileBlobType(_def: LexiconBlob): Promise<string> {
    return 'l.BlobRef'
  }

  private async compileCidLinkSchema(def: LexiconCid): Promise<string> {
    const options = stringifyOptionalOptions(def, ['type', 'description'])
    return this.pure(`l.cidLink(${options})`)
  }

  private async compileCidLinkType(_def: LexiconCid): Promise<string> {
    return 'l.CID'
  }

  private async compileRefSchema(def: LexiconRef): Promise<string> {
    const { varName, typeName } = await this.refResolver.resolve(def.ref)
    // @NOTE "as" is needed in schemas with circular refs as TypeScript cannot
    // infer the type of a value that depends on its initializer type
    return this.pure(
      // @TODO Only add the "as" if there is a circular ref
      `l.ref((() => ${varName}) as l.RefSchemaGetter<${typeName}>)`,
    )
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
        // @NOTE "as" is needed in schemas with circular refs as TypeScript cannot
        // infer the type of a value that depends on its initializer type
        return this.pure(
          // @TODO Only add the "as" if there is a circular ref
          `l.typedRef((() => ${varName}) as l.TypedRefSchemaGetter<${typeName}>)`,
        )
      }),
    )

    return this.pure(
      `l.typedUnion([${refs.join(',')}], ${def.closed ?? false})`,
    )
  }

  private async compileRefUnionType(def: LexiconRefUnion): Promise<string> {
    const types = await Promise.all(
      def.refs.map(async (r) => (await this.refResolver.resolve(r)).typeName),
    )
    if (!def.closed) types.push('l.UnknownTypedObject')
    return types.join(' | ') || 'never'
  }

  private async compileConstSchema<
    T extends null | number | string | boolean,
  >(def: { const: T; enum?: readonly T[] }): Promise<string> {
    if (hasEnum(def) && !def.enum.includes(def.const)) {
      return this.pure(`l.never()`)
    }

    return this.pure(`l.literal(${JSON.stringify(def.const)})`)
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
  }): Promise<string> {
    if (def.enum.length === 0) {
      return this.pure(`l.never()`)
    }
    if (def.enum.length === 1) {
      return this.pure(`l.literal(${JSON.stringify(def.enum[0])})`)
    }
    return this.pure(`l.enum(${JSON.stringify(def.enum)})`)
  }

  private async compileEnumType<T extends null | number | string>(def: {
    enum: readonly T[]
  }): Promise<string> {
    if (def.enum.length === 0) {
      return 'never'
    }
    if (def.enum.length === 1) {
      return JSON.stringify(def.enum[0])
    }

    return def.enum.map((v) => JSON.stringify(v)).join(' | ')
  }
}

type ParsedDescription = {
  description: string
  deprecated: boolean | string
}

function parseDescription(description: string): ParsedDescription {
  if (/deprecated/i.test(description)) {
    const deprecationMatch = description.match(
      /(\s*deprecated\s*(?:--?|:)?\s*([^-]*)(?:-+)?)/i,
    )
    if (deprecationMatch) {
      const [, match, deprecationNotice] = deprecationMatch
      return {
        description: description.replace(match, '').trim(),
        deprecated: deprecationNotice?.trim() || true,
      }
    } else {
      return {
        description: description.trim(),
        deprecated: true,
      }
    }
  }

  return {
    description: description.trim(),
    deprecated: false,
  }
}

function compileLeadingTrivia(description?: string) {
  if (!description) return undefined
  return `\n\n/**${compileJsDoc(description).replaceAll('\n', '\n * ')}\n */\n`
}

function addJsDoc(
  declaration: { addJsDoc: (text: string) => void },
  def?: { description?: string },
) {
  if (def?.description) {
    declaration.addJsDoc(compileJsDoc(def.description))
  }
}

function compileJsDoc(description: string) {
  const parsed = parseDescription(description)
  return `\n${parsed.description}${
    !parsed.deprecated
      ? ''
      : (parsed.description ? '\n\n' : '') +
        (parsed.deprecated === true
          ? '@deprecated'
          : `@deprecated ${parsed.deprecated}`)
  }`
}

function stringifyOptionalOptions<O extends Record<string, unknown>>(
  obj: O,
  omit?: (keyof O)[],
) {
  const filtered = Object.entries(obj).filter(([k]) => !omit?.includes(k))
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
