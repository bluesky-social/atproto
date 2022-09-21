import { ValidateFunction } from 'ajv'
import CompiledRecordSchema from './schema'

export class ValidationError extends Error {
  code: ValidationResultCode
  messages: string[]

  constructor(res: ValidationResult) {
    super(res.error)
    this.code = res.code
    this.messages = res.messages
  }
}

export enum ValidationResultCode {
  Full = 'full',
  Partial = 'partial',
  Incompatible = 'incompatible',
  Invalid = 'invalid',
}

export class ValidationResult {
  code = ValidationResultCode.Full

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
      this.code === ValidationResultCode.Full ||
      this.code === ValidationResultCode.Partial
    )
  }

  get fullySupported() {
    return this.code === ValidationResultCode.Full
  }

  get compatible() {
    return this.code !== ValidationResultCode.Incompatible
  }

  /**
   * Internal - used to transition the state machine.
   */
  _t(to: ValidationResultCode, message?: string) {
    if (to === ValidationResultCode.Partial) {
      // can -> 'partial' if currently 'full'
      if (this.code === ValidationResultCode.Full) {
        this.code = to
      }
      if (message) {
        this.fallbacks.push(message)
      }
    } else if (to === ValidationResultCode.Incompatible) {
      // can -> 'incompatible' if currently 'full' or 'partial'
      if (
        this.code === ValidationResultCode.Full ||
        this.code === ValidationResultCode.Partial
      ) {
        this.code = to
        if (message && !this.error) {
          // set error message
          this.error = message
        }
      }
    } else if (to === ValidationResultCode.Invalid) {
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
  _fail(schema: CompiledRecordSchema, validator: ValidateFunction) {
    if (validator.errors) {
      for (const err of validator.errors) {
        this._t(
          ValidationResultCode.Invalid,
          `Failed ${schema.id} validation for ${err.schemaPath}: ${
            err.message || `Invalid value`
          }`,
        )
      }
    } else {
      this._t(ValidationResultCode.Invalid, `Failed ${schema.id} validation`)
    }
  }
}
