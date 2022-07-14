import Ajv, { ValidateFunction } from 'ajv'
import ajvAddFormats from 'ajv-formats'
import {
  AdxSchemaDefinition,
  adxSchemaDefinition,
  AdxSchemaDefinitionMalformedError,
  SchemaNotFoundError,
  WrongSchemaTypeError,
  adxFallbackStrings,
} from './types'

const ajv = new Ajv()
ajvAddFormats(ajv)

type SomeObject = Record<string, unknown>
export interface AdxRecordValidatorDescription {
  type: string | string[]
  ext?: string | string[]
}
export * from './types'

/**
 * A compiled schema.
 */
export class AdxSchema {
  id: string
  validateRecord?: ValidateFunction
  validateParams?: ValidateFunction
  validateResponse?: ValidateFunction

  get name() {
    return this.def.name
  }

  constructor(public def: AdxSchemaDefinition) {
    this.id = `${def.author}:${def.name}`
    if (def.$type === 'adxs-record') {
      // .schema
      try {
        if (def.schema) {
          if (def.schema.type !== 'object') {
            throw new Error('The base .type must be an "object"')
          }
          this.validateRecord = ajv.compile(def.schema)
        }
      } catch (e: any) {
        throw new AdxSchemaDefinitionMalformedError(
          `The "${this.id}" .schema failed to compile: ${e.message}`,
          def,
        )
      }
    } else if (def.$type === 'adxs-view') {
      // .parameters
      try {
        if (def.parameters) {
          if (def.parameters.type !== 'object') {
            throw new Error('The base .type must be an "object"')
          }
          this.validateParams = ajv.compile(def.parameters)
        }
      } catch (e: any) {
        throw new AdxSchemaDefinitionMalformedError(
          `The "${this.id}" .parameters failed to compile: ${e.message}`,
          def,
        )
      }
      // .response
      try {
        if (def.response) {
          if (def.response.type !== 'object') {
            throw new Error('The base .type must be an "object"')
          }
          this.validateResponse = ajv.compile(def.response)
        }
      } catch (e: any) {
        throw new AdxSchemaDefinitionMalformedError(
          `The "${this.id}" .response failed to compile: ${e.message}`,
          def,
        )
      }
    }
  }
}

/**
 * A collection of compiled schemas.
 */
export class AdxSchemas {
  schemas: Map<string, AdxSchema> = new Map()
  private _locale = 'en'

  get locale() {
    return this._locale
  }

  set locale(v: string) {
    this._locale = v.split('-')[0]
  }

  /**
   * Add a schema definition.
   */
  add(schemaDef: unknown): void {
    try {
      adxSchemaDefinition.parse(schemaDef)
    } catch (e: any) {
      throw new AdxSchemaDefinitionMalformedError(
        `Failed to parse schema definition`,
        schemaDef,
        e.issues,
      )
    }
    const schema = new AdxSchema(schemaDef as AdxSchemaDefinition)
    if (this.schemas.has(schema.id)) {
      throw new Error(`${schema.id} has already been registered`)
    }
    this.schemas.set(schema.id, schema)
    if (!this.schemas.has(schema.name)) {
      this.schemas.set(schema.name, schema)
    }
  }

  /**
   * Remove a schema definition.
   */
  remove(key: string) {
    const schema = this.schemas.get(key)
    if (!schema) {
      throw new Error(`Unable to remove "${key}": does not exist`)
    }
    if (this.schemas.get(schema.id) === schema) {
      this.schemas.delete(schema.id)
    }
    if (this.schemas.get(schema.name) === schema) {
      this.schemas.delete(schema.name)
    }
  }

  /**
   * Get a schema definition.
   */
  get(key: string): AdxSchema | undefined {
    return this.schemas.get(key)
  }

  /**
   * Create a record validator out of one or more schemas.
   */
  createRecordValidator(
    desc: string | string[] | AdxRecordValidatorDescription,
  ): AdxRecordValidator {
    let type: string[]
    let ext: string[] = []
    if (typeof desc === 'string' || Array.isArray(desc)) {
      type = Array.isArray(desc) ? desc : [desc]
    } else {
      type = Array.isArray(desc.type) ? desc.type : [desc.type]
      if (desc.ext) {
        ext = Array.isArray(desc.ext) ? desc.ext : [desc.ext]
      }
    }
    return new AdxRecordValidator(
      this,
      type.map(mapGetSchemaOfType(this, 'adxs-record')),
      ext.map(mapGetSchemaOfType(this, 'adxs-record')),
    )
  }

  /**
   * Create a view validator out of a schema.
   */
  createViewValidator(view: string): AdxViewValidator {
    return new AdxViewValidator(mapGetSchemaOfType(this, 'adxs-view')(view))
  }
}

function mapGetSchemaOfType(schemas: AdxSchemas, schemaType: string) {
  return (t: string) => {
    const schema = schemas.get(t)
    if (!schema) {
      throw new SchemaNotFoundError(`Schema not found: ${t}`)
    }
    if (schema.def.$type !== schemaType) {
      throw new WrongSchemaTypeError(
        `Schema "${schema.id}" does not validate ${schemaType}`,
      )
    }
    return schema
  }
}

/**
 * Validates records using schemas.
 */
export class AdxRecordValidator {
  constructor(
    private schemas: AdxSchemas,
    public type: AdxSchema[],
    public ext: AdxSchema[],
  ) {}

  /**
   * Returns detailed information about validity and compatibility.
   */
  validate(value: SomeObject): AdxValidationResult {
    const res = new AdxValidationResult()

    // basic validation
    if (!value || typeof value !== 'object') {
      res._t(
        AdxValidationResultCode.Invalid,
        `The passed value is not an object`,
      )
      return res // abort now
    }
    if (!value.$type) {
      res._t(
        AdxValidationResultCode.Invalid,
        `The passed value does not declare a $type`,
      )
      return res // abort now
    }

    // lookup schema
    const typeSchema = this.type.find(schemaIdFilter(value.$type as string))
    if (!typeSchema) {
      res._t(
        AdxValidationResultCode.Incompatible,
        `Record type ${value.$type} is not supported`,
      )
    } else if (!typeSchema.validateRecord) {
      res._t(
        AdxValidationResultCode.Incompatible,
        `Record type ${value.$type} is not a record schema`,
      )
    } else {
      // validate base type
      const typeIsValid = typeSchema.validateRecord(value)
      if (!typeIsValid) {
        res._fail(typeSchema, typeSchema.validateRecord)
      }
    }

    // validate extension objects
    if ('$ext' in value && typeof value.$ext === 'object') {
      for (const [extSchemaId, obj] of Object.entries(
        value.$ext as SomeObject,
      )) {
        const extObj = obj as SomeObject

        const extIsRequired =
          '$required' in extObj && typeof extObj.$required === 'boolean'
            ? extObj.$required
            : false

        let extFallback
        if ('$fallback' in extObj) {
          const parseRes = adxFallbackStrings.safeParse(extObj.$fallback)
          if (parseRes.success) {
            extFallback = chooseFallbackLocalized(
              this.schemas.locale,
              parseRes.data,
            )
          }
        }

        // lookup extension
        const extSchema = this.ext.find(schemaIdFilter(extSchemaId))
        if (!extSchema || !extSchema.validateRecord) {
          if (extIsRequired) {
            res._t(
              AdxValidationResultCode.Incompatible,
              `Record extension ${extSchemaId} is not supported`,
            )
          } else {
            res._t(AdxValidationResultCode.Partial, extFallback)
          }
        } else {
          // validate extension object
          const extObjIsValid = extSchema.validateRecord(extObj)
          if (!extObjIsValid) {
            res._fail(extSchema, extSchema.validateRecord)
          }
        }
      }
    }

    return res
  }

  /**
   * Provides a simple boolean check of validity.
   */
  isValid(value: any) {
    const res = this.validate(value)
    return res.valid
  }

  /**
   * Like validate() but throws if validation fails.
   */
  assertValid(value: any) {
    const res = this.validate(value)
    if (!res.valid) {
      throw new AdxValidationError(res)
    }
    return res
  }
}

/**
 * Validates views using schemas.
 */
export class AdxViewValidator {
  constructor(public view: AdxSchema) {}

  /**
   * Returns detailed information about validity and compatibility.
   */
  validateResponse(value: SomeObject): AdxValidationResult {
    const res = new AdxValidationResult()

    if (!value || typeof value !== 'object') {
      res._t(
        AdxValidationResultCode.Invalid,
        `The passed value is not an object`,
      )
      return res // abort now
    }

    if (this.view.validateResponse) {
      const viewIsValid = this.view.validateResponse(value)
      if (!viewIsValid) {
        res._fail(this.view, this.view.validateResponse)
      }
    }

    return res
  }

  /**
   * Provides a simple boolean check of validity.
   */
  isResponseValid(value: any) {
    const res = this.validateResponse(value)
    return res.valid
  }

  /**
   * Like validateResponse() but throws if validation fails.
   */
  assertResponseValid(value: any) {
    const res = this.validateResponse(value)
    if (!res.valid) {
      throw new AdxValidationError(res)
    }
    return res
  }
}

export enum AdxValidationResultCode {
  Full = 'full',
  Partial = 'partial',
  Incompatible = 'incompatible',
  Invalid = 'invalid',
}

export class AdxValidationResult {
  code = AdxValidationResultCode.Full

  /**
   * The error message (if fatal)
   */
  error: string | undefined

  /**
   * A collection of all fallback messages
   */
  fallbacks: string[] = []

  /**
   * A collection of all messages
   */
  messages: string[] = []

  get valid() {
    return (
      this.code === AdxValidationResultCode.Full ||
      this.code === AdxValidationResultCode.Partial
    )
  }

  get fullySupported() {
    return this.code === AdxValidationResultCode.Full
  }

  get compatible() {
    return this.code !== AdxValidationResultCode.Incompatible
  }

  /**
   * Internal - used to transition the state machine.
   */
  _t(to: AdxValidationResultCode, message?: string) {
    if (to === AdxValidationResultCode.Partial) {
      // can -> 'partial' if currently 'full'
      if (this.code === AdxValidationResultCode.Full) {
        this.code = to
      }
      if (message) {
        this.fallbacks.push(message)
      }
    } else if (to === AdxValidationResultCode.Incompatible) {
      // can -> 'incompatible' if currently 'full' or 'partial'
      if (
        this.code === AdxValidationResultCode.Full ||
        this.code === AdxValidationResultCode.Partial
      ) {
        this.code = to
        if (message && !this.error) {
          // set error message
          this.error = message
        }
      }
    } else if (to === AdxValidationResultCode.Invalid) {
      // can always -> 'invalid'
      this.code = to
      if (message && !this.error) {
        // set error message
        this.error = message
      }
    }

    if (message) {
      this.messages.push(message)
    }
  }

  /**
   * Internal - used to transition the state machine.
   */
  _fail(schema: AdxSchema, validator: ValidateFunction) {
    if (validator.errors) {
      for (const err of validator.errors) {
        this._t(
          AdxValidationResultCode.Invalid,
          `Failed ${schema.id} validation for ${err.schemaPath}: ${
            err.message || `Invalid value`
          }`,
        )
      }
    } else {
      this._t(AdxValidationResultCode.Invalid, `Failed ${schema.id} validation`)
    }
  }
}

export class AdxValidationError extends Error {
  code: AdxValidationResultCode
  messages: string[]

  constructor(res: AdxValidationResult) {
    super(res.error)
    this.code = res.code
    this.messages = res.messages
  }
}

// helpers

const schemaIdFilter = (schemaId: string) => (s: AdxSchema) => s.id === schemaId

function chooseFallbackLocalized(
  locale: string,
  fallbacks: Record<string, string>,
) {
  // exact match
  if (fallbacks[locale]) {
    return fallbacks[locale]
  }
  // use the language only (drop the region)
  for (const fallbackLocale of Object.keys(fallbacks)) {
    const fallbackLocaleShort = fallbackLocale.split('-')[0]
    if (fallbackLocaleShort === locale) {
      return fallbacks[fallbackLocale]
    }
  }
  // fallback to any available
  return fallbacks[Object.keys(fallbacks)[0]]
}
