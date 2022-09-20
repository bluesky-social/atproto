import Ajv from 'ajv'
import ajvAddFormats from 'ajv-formats'
import * as util from './util'

import CompiledRecordSchema from './schema'
import RecordSchemas from './schemas'
import {
  ValidationError,
  ValidationResult,
  ValidationResultCode,
} from './validation'

const ajv = new Ajv()
ajvAddFormats(ajv)

export interface RecordValidatorDescription {
  type: string | string[]
  ext?: string | string[]
}

/**
 * Validates records using schemas.
 */
export class RecordValidator {
  constructor(
    private schemas: RecordSchemas,
    public type: CompiledRecordSchema[],
    public ext: CompiledRecordSchema[],
  ) {}

  /**
   * Returns detailed information about validity and compatibility.
   */
  validate(value: unknown): ValidationResult {
    const res = new ValidationResult()

    // basic validation
    if (!util.isRecord(value)) {
      res._t(ValidationResultCode.Invalid, `The passed value is not an object`)
      return res // abort now
    }
    if (!value.$type) {
      res._t(
        ValidationResultCode.Invalid,
        `The passed value does not declare a $type`,
      )
      return res // abort now
    }

    // lookup schema
    const typeSchema = this.type.find(schemaIdFilter(value.$type as string))
    if (!typeSchema) {
      res._t(
        ValidationResultCode.Incompatible,
        `Record type ${value.$type} is not supported`,
      )
    } else if (!typeSchema.validate) {
      res._t(
        ValidationResultCode.Incompatible,
        `Record type ${value.$type} is not a record schema`,
      )
    } else {
      // validate base type
      const typeIsValid = typeSchema.validate(value)
      if (!typeIsValid) {
        res._fail(typeSchema, typeSchema.validate)
      }
    }

    // validate extension objects
    if ('$ext' in value && typeof value.$ext === 'object') {
      for (const [extSchemaId, obj] of Object.entries(
        value.$ext as Record<string, unknown>,
      )) {
        const extObj = obj as Record<string, unknown>

        const extIsRequired =
          '$required' in extObj && typeof extObj.$required === 'boolean'
            ? extObj.$required
            : false

        let extFallback
        if ('$fallback' in extObj && typeof extObj.$fallback === 'string') {
          extFallback = extObj.$fallback
        }

        // lookup extension
        const extSchema = this.ext.find(schemaIdFilter(extSchemaId))
        if (!extSchema || !extSchema.validate) {
          if (extIsRequired) {
            res._t(
              ValidationResultCode.Incompatible,
              `Record extension ${extSchemaId} is not supported`,
            )
          } else {
            res._t(ValidationResultCode.Partial, extFallback)
          }
        } else {
          // validate extension object
          const extObjIsValid = extSchema.validate(extObj)
          if (!extObjIsValid) {
            res._fail(extSchema, extSchema.validate)
          }
        }
      }
    }

    return res
  }

  /**
   * Provides a simple boolean check of validity.
   */
  isValid(value: unknown) {
    const res = this.validate(value)
    return res.valid
  }

  /**
   * Like validate() but throws if validation fails.
   */
  assertValid(value: unknown) {
    const res = this.validate(value)
    if (!res.valid) {
      throw new ValidationError(res)
    }
    return res
  }
}

// helpers

const schemaIdFilter = (schemaId: string) => (s: CompiledRecordSchema) =>
  s.id === schemaId

export default RecordValidator
