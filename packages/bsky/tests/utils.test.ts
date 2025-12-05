import {
  PostSearchQuery,
  parsePostSearchQuery,
} from '../src/data-plane/server/util'

describe('parsePostSearchQuery', () => {
  type TestCase = {
    input: string
    output: PostSearchQuery
  }

  const tests: TestCase[] = [
    {
      input: `bluesky `,
      output: { q: `bluesky`, author: undefined },
    },
    {
      input: ` bluesky  from:esb.lol`,
      output: { q: `bluesky`, author: `esb.lol` },
    },
    {
      input: `bluesky "from:esb.lol"`,
      output: { q: `bluesky "from:esb.lol"`, author: undefined },
    },
    {
      input: `bluesky mentions:@esb.lol `,
      output: { q: `bluesky mentions:@esb.lol`, author: undefined },
    },
    {
      input: `bluesky lang:"en"`,
      output: { q: `bluesky lang:"en"`, author: undefined },
    },
    {
      input: `bluesky "literal" "from:invalid" did:test:123 `,
      output: {
        q: `bluesky "literal" "from:invalid"`,
        author: `did:test:123`,
      },
    },
  ]

  it.each(tests)(`'$input' -> '$output'`, ({ input, output }) => {
    expect(parsePostSearchQuery(input)).toEqual(output)
  })
})
