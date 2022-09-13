import AdxSchema from './schema'
import AdxRecordValidator, {
  AdxRecordValidatorDescription,
} from './record-validator'
import AdxViewValidator from './view-validator'

import {
  AdxSchemaDefinition,
  adxSchemaDefinition,
  AdxSchemaDefinitionMalformedError,
  SchemaNotFoundError,
  WrongSchemaTypeError,
} from './types'

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

export default AdxSchemas
