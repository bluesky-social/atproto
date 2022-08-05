import AdxSchema from './schema'
import {
  AdxValidationResult,
  AdxValidationResultCode,
  AdxValidationError,
} from './validation'

/**
 * Validates views using schemas.
 */
export class AdxViewValidator {
  constructor(public view: AdxSchema) {}

  /**
   * Returns detailed information about validity and compatibility.
   */
  validateResponse(value: unknown): AdxValidationResult {
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

export default AdxViewValidator
