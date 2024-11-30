import { handleAllSettledErrors } from '@atproto/common'
import { ImageInvalidator } from './types'

export class MultiImageInvalidator implements ImageInvalidator {
  constructor(public invalidators: ImageInvalidator[]) {}
  async invalidate(subject: string, paths: string[]) {
    const results = await Promise.allSettled(
      this.invalidators.map((invalidator) =>
        invalidator.invalidate(subject, paths),
      ),
    )
    handleAllSettledErrors(results)
  }
}
