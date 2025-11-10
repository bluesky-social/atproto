import { lexiconsLockSchema } from './lexicons-lock.js'

describe('lexiconsLockSchema', () => {
  it('validates a correct lexicons lock', () => {
    const data = {
      lexicons: {
        'com.example.lexicon':
          'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
      },
      resolutions: {
        'com.example.lexicon': {
          cid: 'bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku',
          uri: 'at://did:example:123/com.example.lexicon',
          dependencies: ['com.example.dependency'],
        },
      },
    }
    const result = lexiconsLockSchema.validate(data)
    expect(result.success).toBe(true)
  })
})
