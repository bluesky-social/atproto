import Ajv, { ValidateFunction } from 'ajv'
import ajvAddFormats from 'ajv-formats'
import { AdxSchemaDefinition, AdxSchemaDefinitionMalformedError } from './types'

const ajv = new Ajv()
ajvAddFormats(ajv)

/**
 * A compiled schema.
 */
export class AdxSchema {
  id: string
  validateRecord?: ValidateFunction

  constructor(public def: AdxSchemaDefinition) {
    this.id = def.id

    // .record
    try {
      if (def.record) {
        if (def.record.type !== 'object') {
          throw new Error('The base .type must be an "object"')
        }
        this.validateRecord = ajv.compile(def.record)
      }
    } catch (e: any) {
      throw new AdxSchemaDefinitionMalformedError(
        `The "${this.id}" .record failed to compile: ${e.message}`,
        def,
      )
    }
  }
}

export default AdxSchema
