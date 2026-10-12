import { readEnv } from '../src/config/env.js'

function withEnv(values: NodeJS.ProcessEnv): Disposable {
  const original = process.env
  process.env = { ...original, ...values }
  return {
    [Symbol.dispose]() {
      process.env = original
    },
  }
}

describe('cancellation timeout configuration', () => {
  it('leaves unset timeouts to the database defaults', () => {
    using _env = withEnv({
      OZONE_DB_CANCEL_CONNECTION_TIMEOUT_MS: undefined,
      OZONE_DB_CANCEL_STATEMENT_TIMEOUT_MS: undefined,
    })
    expect(readEnv()).toMatchObject({
      dbCancelConnectionTimeoutMs: undefined,
      dbCancelStatementTimeoutMs: undefined,
    })
  })

  describe.each([
    ['OZONE_DB_CANCEL_CONNECTION_TIMEOUT_MS', 'dbCancelConnectionTimeoutMs'],
    ['OZONE_DB_CANCEL_STATEMENT_TIMEOUT_MS', 'dbCancelStatementTimeoutMs'],
  ])('%s', (name, key) => {
    it.each(['0', '2500', '2147483647'])('accepts %s milliseconds', (value) => {
      using _env = withEnv({
        [name]: value,
      })
      expect(readEnv()).toHaveProperty(key, Number(value))
    })

    it.each(['-1', '1.5', 'abc', '1000ms', ' ', '2147483648'])(
      'rejects invalid value %s at startup',
      (value) => {
        using _env = withEnv({
          [name]: value,
        })
        expect(() => readEnv()).toThrow(
          `${name} must be an integer between 0 and 2147483647 milliseconds`,
        )
      },
    )
  })
})
