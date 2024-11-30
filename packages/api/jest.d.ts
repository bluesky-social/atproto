declare namespace jest {
  // eslint-disable-next-line
  interface Matchers<R, T = {}> {
    toBeModerationResult(
      expected: ModerationTestSuiteResultFlag[] | undefined,
      context?: string,
      stringifiedResult?: string,
      ignoreCause?: boolean,
    ): R
  }

  interface Expect {
    toBeModerationResult(
      expected: ModerationTestSuiteResultFlag[] | undefined,
      context?: string,
      stringifiedResult?: string,
      ignoreCause?: boolean,
    ): void
  }
}
