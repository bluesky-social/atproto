import {
  AtpAgent,
  RichText,
  RichTextSegment,
  HASHTAG_REGEX,
  HASHTAG_REGEX_WITH_TRAILING_PUNCTUATION,
  TRAILING_PUNCTUATION_REGEX,
  LEADING_HASH_REGEX,
  HASHTAG_INVALID_CHARACTER_REGEX,
} from '../src'
import { isTag } from '../src/client/types/app/bsky/richtext/facet'

describe('detectFacets', () => {
  const agent = new AtpAgent({ service: 'http://localhost' })
  agent.resolveHandle = ({ handle }: { handle: string }) => {
    return Promise.resolve({
      success: true,
      headers: {},
      data: { did: 'did:fake:' + handle },
    })
  }

  const inputs = [
    'no mention',
    '@handle.com middle end',
    'start @handle.com end',
    'start middle @handle.com',
    '@handle.com @handle.com @handle.com',
    '@full123-chars.test',
    'not@right',
    '@handle.com!@#$chars',
    '@handle.com\n@handle.com',
    'parenthetical (@handle.com)',
    '👨‍👩‍👧‍👧 @handle.com 👨‍👩‍👧‍👧',

    'start https://middle.com end',
    'start https://middle.com/foo/bar end',
    'start https://middle.com/foo/bar?baz=bux end',
    'start https://middle.com/foo/bar?baz=bux#hash end',
    'https://start.com/foo/bar?baz=bux#hash middle end',
    'start middle https://end.com/foo/bar?baz=bux#hash',
    'https://newline1.com\nhttps://newline2.com',
    '👨‍👩‍👧‍👧 https://middle.com 👨‍👩‍👧‍👧',

    'start middle.com end',
    'start middle.com/foo/bar end',
    'start middle.com/foo/bar?baz=bux end',
    'start middle.com/foo/bar?baz=bux#hash end',
    'start.com/foo/bar?baz=bux#hash middle end',
    'start middle end.com/foo/bar?baz=bux#hash',
    'newline1.com\nnewline2.com',

    'not.. a..url ..here',
    'e.g.',
    'something-cool.jpg',
    'website.com.jpg',
    'e.g./foo',
    'website.com.jpg/foo',

    'Classic article https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/',
    'Classic article https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/ ',
    'https://foo.com https://bar.com/whatever https://baz.com',
    'punctuation https://foo.com, https://bar.com/whatever; https://baz.com.',
    'parenthentical (https://foo.com)',
    'except for https://foo.com/thing_(cool)',
  ]
  const outputs: string[][][] = [
    [['no mention']],
    [['@handle.com', 'did:fake:handle.com'], [' middle end']],
    [['start '], ['@handle.com', 'did:fake:handle.com'], [' end']],
    [['start middle '], ['@handle.com', 'did:fake:handle.com']],
    [
      ['@handle.com', 'did:fake:handle.com'],
      [' '],
      ['@handle.com', 'did:fake:handle.com'],
      [' '],
      ['@handle.com', 'did:fake:handle.com'],
    ],
    [['@full123-chars.test', 'did:fake:full123-chars.test']],
    [['not@right']],
    [['@handle.com', 'did:fake:handle.com'], ['!@#$chars']],
    [
      ['@handle.com', 'did:fake:handle.com'],
      ['\n'],
      ['@handle.com', 'did:fake:handle.com'],
    ],
    [['parenthetical ('], ['@handle.com', 'did:fake:handle.com'], [')']],
    [['👨‍👩‍👧‍👧 '], ['@handle.com', 'did:fake:handle.com'], [' 👨‍👩‍👧‍👧']],

    [['start '], ['https://middle.com', 'https://middle.com'], [' end']],
    [
      ['start '],
      ['https://middle.com/foo/bar', 'https://middle.com/foo/bar'],
      [' end'],
    ],
    [
      ['start '],
      [
        'https://middle.com/foo/bar?baz=bux',
        'https://middle.com/foo/bar?baz=bux',
      ],
      [' end'],
    ],
    [
      ['start '],
      [
        'https://middle.com/foo/bar?baz=bux#hash',
        'https://middle.com/foo/bar?baz=bux#hash',
      ],
      [' end'],
    ],
    [
      [
        'https://start.com/foo/bar?baz=bux#hash',
        'https://start.com/foo/bar?baz=bux#hash',
      ],
      [' middle end'],
    ],
    [
      ['start middle '],
      [
        'https://end.com/foo/bar?baz=bux#hash',
        'https://end.com/foo/bar?baz=bux#hash',
      ],
    ],
    [
      ['https://newline1.com', 'https://newline1.com'],
      ['\n'],
      ['https://newline2.com', 'https://newline2.com'],
    ],
    [['👨‍👩‍👧‍👧 '], ['https://middle.com', 'https://middle.com'], [' 👨‍👩‍👧‍👧']],

    [['start '], ['middle.com', 'https://middle.com'], [' end']],
    [
      ['start '],
      ['middle.com/foo/bar', 'https://middle.com/foo/bar'],
      [' end'],
    ],
    [
      ['start '],
      ['middle.com/foo/bar?baz=bux', 'https://middle.com/foo/bar?baz=bux'],
      [' end'],
    ],
    [
      ['start '],
      [
        'middle.com/foo/bar?baz=bux#hash',
        'https://middle.com/foo/bar?baz=bux#hash',
      ],
      [' end'],
    ],
    [
      [
        'start.com/foo/bar?baz=bux#hash',
        'https://start.com/foo/bar?baz=bux#hash',
      ],
      [' middle end'],
    ],
    [
      ['start middle '],
      ['end.com/foo/bar?baz=bux#hash', 'https://end.com/foo/bar?baz=bux#hash'],
    ],
    [
      ['newline1.com', 'https://newline1.com'],
      ['\n'],
      ['newline2.com', 'https://newline2.com'],
    ],

    [['not.. a..url ..here']],
    [['e.g.']],
    [['something-cool.jpg']],
    [['website.com.jpg']],
    [['e.g./foo']],
    [['website.com.jpg/foo']],

    [
      ['Classic article '],
      [
        'https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/',
        'https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/',
      ],
    ],
    [
      ['Classic article '],
      [
        'https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/',
        'https://socket3.wordpress.com/2018/02/03/designing-windows-95s-user-interface/',
      ],
      [' '],
    ],
    [
      ['https://foo.com', 'https://foo.com'],
      [' '],
      ['https://bar.com/whatever', 'https://bar.com/whatever'],
      [' '],
      ['https://baz.com', 'https://baz.com'],
    ],
    [
      ['punctuation '],
      ['https://foo.com', 'https://foo.com'],
      [', '],
      ['https://bar.com/whatever', 'https://bar.com/whatever'],
      ['; '],
      ['https://baz.com', 'https://baz.com'],
      ['.'],
    ],
    [['parenthentical ('], ['https://foo.com', 'https://foo.com'], [')']],
    [
      ['except for '],
      ['https://foo.com/thing_(cool)', 'https://foo.com/thing_(cool)'],
    ],
  ]
  it('correctly handles a set of text inputs', async () => {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const rt = new RichText({ text: input })
      await rt.detectFacets(agent)
      expect(Array.from(rt.segments(), segmentToOutput)).toEqual(outputs[i])
    }
  })

  it('correctly detects tags inline', async () => {
    const inputs: [
      string,
      string[],
      { byteStart: number; byteEnd: number }[],
    ][] = [
      ['#a', ['a'], [{ byteStart: 0, byteEnd: 2 }]],
      [
        '#a #b',
        ['a', 'b'],
        [
          { byteStart: 0, byteEnd: 2 },
          { byteStart: 3, byteEnd: 5 },
        ],
      ],
      ['#1', [], []],
      ['#tag', ['tag'], [{ byteStart: 0, byteEnd: 4 }]],
      ['body #tag', ['tag'], [{ byteStart: 5, byteEnd: 9 }]],
      ['#tag body', ['tag'], [{ byteStart: 0, byteEnd: 4 }]],
      ['body #tag body', ['tag'], [{ byteStart: 5, byteEnd: 9 }]],
      ['body #1', [], []],
      ['body #a1', ['a1'], [{ byteStart: 5, byteEnd: 8 }]],
      ['body #a_b', ['a_b'], [{ byteStart: 5, byteEnd: 9 }]],
      ['body #a__b', ['a__b'], [{ byteStart: 5, byteEnd: 10 }]],
      ['body #_b', [], []],
      ['body #b_', ['b'], [{ byteStart: 5, byteEnd: 7 }]],
      ['body #a-b', ['a-b'], [{ byteStart: 5, byteEnd: 9 }]],
      ['body #a--b', ['a--b'], [{ byteStart: 5, byteEnd: 10 }]],
      ['body #-b', [], []],
      ['#', [], []],
      ['text #', [], []],
      ['text # text', [], []],
      [
        'body #thisisa64characterstring_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ['thisisa64characterstring_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        [{ byteStart: 5, byteEnd: 71 }],
      ],
      [
        'body #thisisa65characterstring_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab',
        [],
        [],
      ],
      ['its a #double#rainbow', ['double'], [{ byteStart: 6, byteEnd: 13 }]],
      ['##hashash', [], []],
      ['bsky.app/profile#header', [], []],
      ['some #n0n3s@n5e!', ['n0n3s'], [{ byteStart: 5, byteEnd: 11 }]],
      ['works #with,punctuation', ['with'], [{ byteStart: 6, byteEnd: 11 }]],
      [
        'strips trailing #punctuation, #like. #this!',
        ['punctuation', 'like', 'this'],
        [
          { byteStart: 16, byteEnd: 28 },
          { byteStart: 30, byteEnd: 35 },
          { byteStart: 37, byteEnd: 42 },
        ],
      ],
      ['I like #turtles!!!', ['turtles'], [{ byteStart: 7, byteEnd: 15 }]],
      [
        'works with #🦋 emoji, and #butter🦋fly, and #🦋🦋🦋',
        ['🦋', 'butter🦋fly', '🦋🦋🦋'],
        [
          { byteStart: 11, byteEnd: 16 },
          { byteStart: 28, byteEnd: 42 },
          { byteStart: 48, byteEnd: 61 },
        ],
      ],
      // emoji modifiers
      ['#👍🏻', ['👍🏻'], [{ byteStart: 0, byteEnd: 9 }]],
      ['#👍🏿', ['👍🏿'], [{ byteStart: 0, byteEnd: 9 }]],
      [
        '#same #same #but #diff',
        ['same', 'same', 'but', 'diff'],
        [
          { byteStart: 0, byteEnd: 5 },
          { byteStart: 6, byteEnd: 11 },
          { byteStart: 12, byteEnd: 16 },
          { byteStart: 17, byteEnd: 22 },
        ],
      ],
    ]

    for (const [input, tags, indices] of inputs) {
      const rt = new RichText({ text: input })
      await rt.detectFacets(agent)

      const detectedTags: string[] = []
      const detectedIndices: { byteStart: number; byteEnd: number }[] = []

      outer: for (const { facet } of rt.segments()) {
        if (!facet) continue
        for (const feature of facet.features) {
          if (!isTag(feature)) continue outer

          detectedTags.push(feature.tag)
        }
        detectedIndices.push(facet.index)
      }

      expect(detectedTags).toEqual(tags)
      expect(detectedIndices).toEqual(indices)
    }
  })
})

describe('utils', () => {
  // HASHTAG_REGEX is also tested in detection tests above
  it('general parsing', () => {
    const text = `I like #turtles!!!`

    const loose = text.match(HASHTAG_REGEX_WITH_TRAILING_PUNCTUATION)
    expect(loose?.[0]).toEqual(' #turtles!!!')

    const strict = text.match(HASHTAG_REGEX)
    expect(strict?.[0]).toEqual(' #turtles')

    const trimmed = loose?.[0].replace(TRAILING_PUNCTUATION_REGEX, '').trim()
    expect(trimmed).toEqual('#turtles')

    const sanitized = trimmed?.replace(LEADING_HASH_REGEX, '')
    expect(sanitized).toEqual('turtles')

    const punctuation = loose?.[0].match(TRAILING_PUNCTUATION_REGEX)
    expect(punctuation?.[0]).toEqual('!!!')
  })

  it('can remove invalid characters', () => {
    expect('tag'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual('tag')
    expect('#tag'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual('tag')
    expect('#tag!'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual('tag')
    expect(
      '#in,the,middle'.replace(HASHTAG_INVALID_CHARACTER_REGEX, ''),
    ).toEqual('inthemiddle')
    expect('multi_word'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual(
      'multi_word',
    )
    expect('multi-word'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual(
      'multi-word',
    )
    expect('#butter🦋fly'.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual(
      'butter🦋fly',
    )
  })
})

function segmentToOutput(segment: RichTextSegment): string[] {
  if (segment.facet) {
    return [
      segment.text,
      segment.facet?.features.map((f) => {
        if (f.did) {
          return String(f.did)
        }
        if (f.uri) {
          return String(f.uri)
        }
        return undefined
      })?.[0] || '',
    ]
  }
  return [segment.text]
}
