import CompiledRecordSchema from './schema'
import RecordValidator, { RecordValidatorDescription } from './validator'

import {
  RecordSchema,
  recordSchema,
  RecordSchemaMalformedError,
  SchemaNotFoundError,
} from '../types'

/**
 * A collection of compiled schemas.
 */
export class RecordSchemas {
  schemas: Map<string, CompiledRecordSchema> = new Map()

  /**
   * Add a schema definition.
   */
  add(schemaDef: unknown): void {
    try {
      recordSchema.parse(schemaDef)
    } catch (e: any) {
      throw new RecordSchemaMalformedError(
        `Failed to parse schema definition`,
        schemaDef,
        e.issues,
      )
    }
    const schema = new CompiledRecordSchema(schemaDef as RecordSchema)
    if (this.schemas.has(schema.id)) {
      throw new Error(`${schema.id} has already been registered`)
    }
    this.schemas.set(schema.id, schema)
  }

  /**
   * Remove a schema definition.
   */
  remove(key: string) {
    const schema = this.schemas.get(key)
    if (!schema) {
      throw new Error(`Unable to remove "${key}": does not exist`)
    }
    this.schemas.delete(schema.id)
  }

  /**
   * Get a schema definition.
   */
  get(key: string): CompiledRecordSchema | undefined {
    return this.schemas.get(key)
  }

  /**
   * Create a record validator out of one or more schemas.
   */
  createRecordValidator(
    desc: string | string[] | RecordValidatorDescription,
  ): RecordValidator {
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
    return new RecordValidator(
      this,
      type.map(mapGetSchema(this)),
      ext.map(mapGetSchema(this)),
    )
  }
}

function mapGetSchema(schemas: RecordSchemas) {
  return (t: string) => {
    const schema = schemas.get(t)
    if (!schema) {
      throw new SchemaNotFoundError(`Schema not found: ${t}`)
    }
    return schema
  }
}

export default RecordSchemas
