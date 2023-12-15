import { AtpAgent, RichText, RichTextSegment } from '../src'
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
    'a example.com/index.php php link',
    'a trailing bsky.app: colon',

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
    [
      ['a '],
      ['example.com/index.php', 'https://example.com/index.php'],
      [' php link'],
    ],
    [['a trailing '], ['bsky.app', 'https://bsky.app'], [': colon']],

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
      [
        'its a #double#rainbow',
        ['double#rainbow'],
        [{ byteStart: 6, byteEnd: 21 }],
      ],
      ['##hashash', ['#hashash'], [{ byteStart: 0, byteEnd: 9 }]],
      ['some #n0n3s@n5e!', ['n0n3s@n5e'], [{ byteStart: 5, byteEnd: 15 }]],
      [
        'works #with,punctuation',
        ['with,punctuation'],
        [{ byteStart: 6, byteEnd: 23 }],
      ],
      [
        'strips trailing #punctuation, #like. #this!',
        ['punctuation', 'like', 'this'],
        [
          { byteStart: 16, byteEnd: 28 },
          { byteStart: 30, byteEnd: 35 },
          { byteStart: 37, byteEnd: 42 },
        ],
      ],
      [
        'strips #multi_trailing___...',
        ['multi_trailing'],
        [{ byteStart: 7, byteEnd: 22 }],
      ],
      [
        'works with #🦋 emoji, and #butter🦋fly',
        ['🦋', 'butter🦋fly'],
        [
          { byteStart: 11, byteEnd: 16 },
          { byteStart: 28, byteEnd: 42 },
        ],
      ],
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

      for (const { facet } of rt.segments()) {
        if (!facet) continue
        for (const feature of facet.features) {
          if (isTag(feature)) {
            detectedTags.push(feature.tag)
          }
        }
        detectedIndices.push(facet.index)
      }

      expect(detectedTags).toEqual(tags)
      expect(detectedIndices).toEqual(indices)
    }
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
