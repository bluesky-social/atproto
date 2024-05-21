import { ModerationUI } from './src'
import { ModerationTestSuiteResultFlag } from './tests/util/moderation-behavior'

expect.extend({
  toBeModerationResult(
    actual: ModerationUI,
    expected: ModerationTestSuiteResultFlag[] | undefined,
    context = '',
    stringifiedResult: string | undefined = undefined,
    _ignoreCause = false,
  ) {
    const fail = (msg: string) => ({
      pass: false,
      message: () =>
        `${msg}.${
          stringifiedResult ? ` Full result: ${stringifiedResult}` : ''
        }`,
    })
    // let cause = actual.causes?.type as string
    // if (actual.cause?.type === 'label') {
    //   cause = `label:${actual.cause.labelDef.id}`
    // } else if (actual.cause?.type === 'muted') {
    //   if (actual.cause.source.type === 'list') {
    //     cause = 'muted-by-list'
    //   }
    // } else if (actual.cause?.type === 'blocking') {
    //   if (actual.cause.source.type === 'list') {
    //     cause = 'blocking-by-list'
    //   }
    // }
    if (!expected) {
      // if (!ignoreCause && actual.cause) {
      //   return fail(`${context} expected to be a no-op, got ${cause}`)
      // }
      if (actual.inform) {
        return fail(`${context} expected to be a no-op, got inform=true`)
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
      // if (!ignoreCause && cause !== expected.cause) {
      //   return fail(`${context} expected to be ${expected.cause}, got ${cause}`)
      // }
      const expectedInform = expected.includes('inform')
      if (!!actual.inform !== expectedInform) {
        return fail(
          `${context} expected to be inform=${expectedInform}, got ${
            actual.inform || false
          }`,
        )
      }
      const expectedAlert = expected.includes('alert')
      if (!!actual.alert !== expectedAlert) {
        return fail(
          `${context} expected to be alert=${expectedAlert}, got ${
            actual.alert || false
          }`,
        )
      }
      const expectedBlur = expected.includes('blur')
      if (!!actual.blur !== expectedBlur) {
        return fail(
          `${context} expected to be blur=${expectedBlur}, got ${
            actual.blur || false
          }`,
        )
      }
      const expectedFilter = expected.includes('filter')
      if (!!actual.filter !== expectedFilter) {
        return fail(
          `${context} expected to be filter=${expectedFilter}, got ${
            actual.filter || false
          }`,
        )
      }
      const expectedNoOverride = expected.includes('noOverride')
      if (!!actual.noOverride !== expectedNoOverride) {
        return fail(
          `${context} expected to be noOverride=${expectedNoOverride}, got ${
            actual.noOverride || false
          }`,
        )
      }
    }
    return { pass: true, message: () => '' }
  },
})
