import { ValidateFunction } from 'ajv'
import AdxSchema from './schema'

export class AdxValidationError extends Error {
  code: AdxValidationResultCode
  messages: string[]

  constructor(res: AdxValidationResult) {
    super(res.error)
    this.code = res.code
    this.messages = res.messages
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
