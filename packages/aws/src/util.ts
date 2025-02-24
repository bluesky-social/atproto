import { allFulfilled } from '@atproto/common'
import { ImageInvalidator } from './types'

export class MultiImageInvalidator implements ImageInvalidator {
  constructor(public invalidators: ImageInvalidator[]) {}
  async invalidate(subject: string, paths: string[]) {
    await allFulfilled(
      this.invalidators.map((invalidator) =>
        invalidator.invalidate(subject, paths),
      ),
    )
  }
}
