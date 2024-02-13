import { ModerationBehaviorResult } from './definitions/moderation-behaviors'
import { ModerationUI } from './src'

expect.extend({
  toBeModerationResult(
    actual: ModerationUI,
    expected: ModerationBehaviorResult | undefined,
    context: string,
    stringifiedResult: string,
    ignoreCause = false,
  ) {
    const fail = (msg: string) => ({
      pass: false,
      message: () => `${msg}. Full result: ${stringifiedResult}`,
    })
    let cause = actual.cause?.type as string
    if (actual.cause?.type === 'label') {
      cause = `label:${actual.cause.labelDef.id}`
    } else if (actual.cause?.type === 'muted') {
      if (actual.cause.source.type === 'list') {
        cause = 'muted-by-list'
      }
    } else if (actual.cause?.type === 'blocking') {
      if (actual.cause.source.type === 'list') {
        cause = 'blocking-by-list'
      }
    }
    if (!expected) {
      if (!ignoreCause && actual.cause) {
        return fail(`${context} expected to be a no-op, got ${cause}`)
      }
      if (actual.alert) {
        return fail(`${context} expected to be a no-op, got alert=true`)
      }
      if (actual.blur) {
        return fail(`${context} expected to be a no-op, got blur=true`)
      }
      if (actual.filter) {
        return fail(`${context} expected to be a no-op, got filter=true`)
      }
      if (actual.noOverride) {
        return fail(`${context} expected to be a no-op, got noOverride=true`)
      }
    } else {
      if (!ignoreCause && cause !== expected.cause) {
        return fail(`${context} expected to be ${expected.cause}, got ${cause}`)
      }
      if (!!actual.alert !== !!expected.alert) {
        return fail(
          `${context} expected to be alert=${expected.alert || false}, got ${
            actual.alert || false
          }`,
        )
      }
      if (!!actual.blur !== !!expected.blur) {
        return fail(
          `${context} expected to be blur=${expected.blur || false}, got ${
            actual.blur || false
          }`,
        )
      }
      if (!!actual.filter !== !!expected.filter) {
        return fail(
          `${context} expected to be filter=${expected.filter || false}, got ${
            actual.filter || false
          }`,
        )
      }
      if (!!actual.noOverride !== !!expected.noOverride) {
        return fail(
          `${context} expected to be noOverride=${
            expected.noOverride || false
          }, got ${actual.noOverride || false}`,
        )
      }
    }
    return { pass: true, message: () => '' }
  },
})
