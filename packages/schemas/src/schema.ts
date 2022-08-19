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

export default AdxSchema
