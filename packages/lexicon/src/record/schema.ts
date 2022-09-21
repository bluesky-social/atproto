import Ajv, { ValidateFunction } from 'ajv'
import ajvAddFormats from 'ajv-formats'
import { RecordSchema, RecordSchemaMalformedError } from '../types'

const ajv = new Ajv()
ajvAddFormats(ajv)

/**
 * A compiled schema.
 */
export class CompiledRecordSchema {
  id: string
  validate?: ValidateFunction

  constructor(public def: RecordSchema) {
    this.id = def.id

    // .record
    try {
      if (def.record) {
        if (def.record.type !== 'object') {
          throw new Error('The base .type must be an "object"')
        }
        this.validate = ajv.compile(def.record)
      }
    } catch (e: any) {
      throw new RecordSchemaMalformedError(
        `The "${this.id}" .record failed to compile: ${e.message}`,
        def,
      )
    }
  }
}

export default CompiledRecordSchema
