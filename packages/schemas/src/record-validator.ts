import Ajv from 'ajv'
import ajvAddFormats from 'ajv-formats'
import { adxFallbackStrings } from './types'

import AdxSchema from './schema'
import AdxSchemas from './schemas'
import {
  AdxValidationError,
  AdxValidationResult,
  AdxValidationResultCode,
} from './validation'

const ajv = new Ajv()
ajvAddFormats(ajv)

export interface AdxRecordValidatorDescription {
  type: string | string[]
  ext?: string | string[]
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
  validate(value: Record<string, unknown>): AdxValidationResult {
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
        value.$ext as Record<string, unknown>,
      )) {
        const extObj = obj as Record<string, unknown>

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

export default AdxRecordValidator
