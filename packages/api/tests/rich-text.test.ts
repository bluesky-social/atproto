import { RichText } from '../src'

describe('RichText', () => {
  it('converts entities to facets correctly', () => {
    const rt = new RichText({
      text: 'test',
      entities: [
        {
          index: { start: 0, end: 1 },
          type: 'link',
          value: 'https://example.com',
        },
        {
          index: { start: 1, end: 2 },
          type: 'mention',
          value: 'did:plc:1234',
        },
        {
          index: { start: 2, end: 3 },
          type: 'other',
          value: 'willbedropped',
        },
      ],
    })
    expect(rt.facets).toEqual([
      {
        $type: 'app.bsky.richtext.facet',
        index: { byteStart: 0, byteEnd: 1 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com',
          },
        ],
      },
      {
        $type: 'app.bsky.richtext.facet',
        index: { byteStart: 1, byteEnd: 2 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:1234',
          },
        ],
      },
    ])
  })

  it('converts entity utf16 indices to facet utf8 indices', () => {
    const rt = new RichText({
      text: '👨‍👩‍👧‍👧👨‍👩‍👧‍👧👨‍👩‍👧‍👧',
      entities: [
        {
          index: { start: 0, end: 11 },
          type: 'link',
          value: 'https://example.com',
        },
        {
          index: { start: 11, end: 22 },
          type: 'mention',
          value: 'did:plc:1234',
        },
        {
          index: { start: 22, end: 33 },
          type: 'other',
          value: 'willbedropped',
        },
      ],
    })
    expect(rt.facets).toEqual([
      {
        $type: 'app.bsky.richtext.facet',
        index: { byteStart: 0, byteEnd: 25 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: 'https://example.com',
          },
        ],
      },
      {
        $type: 'app.bsky.richtext.facet',
        index: { byteStart: 25, byteEnd: 50 },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: 'did:plc:1234',
          },
        ],
      },
    ])
  })

  it('calculates bytelength and grapheme length correctly', () => {
    {
      const rt = new RichText({ text: 'Hello!' })
      expect(rt.length).toBe(6)
      expect(rt.graphemeLength).toBe(6)
    }
    {
      const rt = new RichText({ text: '👨‍👩‍👧‍👧' })
      expect(rt.length).toBe(25)
      expect(rt.graphemeLength).toBe(1)
    }
    {
      const rt = new RichText({ text: '👨‍👩‍👧‍👧🔥 good!✅' })
      expect(rt.length).toBe(38)
      expect(rt.graphemeLength).toBe(9)
    }
  })
})

describe('RichText#insert', () => {
  const input = new RichText({
    text: 'hello world',
    facets: [
      { index: { byteStart: 2, byteEnd: 7 }, features: [{ $type: '' }] },
    ],
  })

  it('correctly adjusts facets (scenario A - before)', () => {
    const output = input.clone().insert(0, 'test')
    expect(output.text).toEqual('testhello world')
    expect(output.facets?.[0].index.byteStart).toEqual(6)
    expect(output.facets?.[0].index.byteEnd).toEqual(11)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts facets (scenario B - inner)', () => {
    const output = input.clone().insert(4, 'test')
    expect(output.text).toEqual('helltesto world')
    expect(output.facets?.[0].index.byteStart).toEqual(2)
    expect(output.facets?.[0].index.byteEnd).toEqual(11)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('lltesto w')
  })

  it('correctly adjusts facets (scenario C - after)', () => {
    const output = input.clone().insert(8, 'test')
    expect(output.text).toEqual('hello wotestrld')
    expect(output.facets?.[0].index.byteStart).toEqual(2)
    expect(output.facets?.[0].index.byteEnd).toEqual(7)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('llo w')
  })
})

describe('RichText#insert w/fat unicode', () => {
  const input = new RichText({
    text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
    facets: [
      { index: { byteStart: 0, byteEnd: 28 }, features: [{ $type: '' }] },
      { index: { byteStart: 29, byteEnd: 57 }, features: [{ $type: '' }] },
      { index: { byteStart: 58, byteEnd: 88 }, features: [{ $type: '' }] },
    ],
  })

  it('correctly adjusts facets (scenario A - before)', () => {
    const output = input.clone().insert(0, 'test')
    expect(output.text).toEqual('testone👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('one👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[1].index.byteStart,
        output.facets?.[1].index.byteEnd,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[2].index.byteStart,
        output.facets?.[2].index.byteEnd,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario B - inner)', () => {
    const output = input.clone().insert(3, 'test')
    expect(output.text).toEqual('onetest👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('onetest👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[1].index.byteStart,
        output.facets?.[1].index.byteEnd,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[2].index.byteStart,
        output.facets?.[2].index.byteEnd,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario C - after)', () => {
    const output = input.clone().insert(28, 'test')
    expect(output.text).toEqual('one👨‍👩‍👧‍👧test two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('one👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[1].index.byteStart,
        output.facets?.[1].index.byteEnd,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.unicodeText.slice(
        output.facets?.[2].index.byteStart,
        output.facets?.[2].index.byteEnd,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })
})

describe('RichText#delete', () => {
  const input = new RichText({
    text: 'hello world',
    facets: [
      { index: { byteStart: 2, byteEnd: 7 }, features: [{ $type: '' }] },
    ],
  })

  it('correctly adjusts facets (scenario A - entirely outer)', () => {
    const output = input.clone().delete(0, 9)
    expect(output.text).toEqual('ld')
    expect(output.facets?.length).toEqual(0)
  })

  it('correctly adjusts facets (scenario B - entirely after)', () => {
    const output = input.clone().delete(7, 11)
    expect(output.text).toEqual('hello w')
    expect(output.facets?.[0].index.byteStart).toEqual(2)
    expect(output.facets?.[0].index.byteEnd).toEqual(7)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts facets (scenario C - partially after)', () => {
    const output = input.clone().delete(4, 11)
    expect(output.text).toEqual('hell')
    expect(output.facets?.[0].index.byteStart).toEqual(2)
    expect(output.facets?.[0].index.byteEnd).toEqual(4)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('ll')
  })

  it('correctly adjusts facets (scenario D - entirely inner)', () => {
    const output = input.clone().delete(3, 5)
    expect(output.text).toEqual('hel world')
    expect(output.facets?.[0].index.byteStart).toEqual(2)
    expect(output.facets?.[0].index.byteEnd).toEqual(5)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('l w')
  })

  it('correctly adjusts facets (scenario E - partially before)', () => {
    const output = input.clone().delete(1, 5)
    expect(output.text).toEqual('h world')
    expect(output.facets?.[0].index.byteStart).toEqual(1)
    expect(output.facets?.[0].index.byteEnd).toEqual(3)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual(' w')
  })

  it('correctly adjusts facets (scenario F - entirely before)', () => {
    const output = input.clone().delete(0, 2)
    expect(output.text).toEqual('llo world')
    expect(output.facets?.[0].index.byteStart).toEqual(0)
    expect(output.facets?.[0].index.byteEnd).toEqual(5)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('llo w')
  })
})

describe('RichText#delete w/fat unicode', () => {
  const input = new RichText({
    text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
    facets: [
      { index: { byteStart: 29, byteEnd: 57 }, features: [{ $type: '' }] },
    ],
  })

  it('correctly adjusts facets (scenario A - entirely outer)', () => {
    const output = input.clone().delete(28, 58)
    expect(output.text).toEqual('one👨‍👩‍👧‍👧three👨‍👩‍👧‍👧')
    expect(output.facets?.length).toEqual(0)
  })

  it('correctly adjusts facets (scenario B - entirely after)', () => {
    const output = input.clone().delete(57, 88)
    expect(output.text).toEqual('one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.byteStart).toEqual(29)
    expect(output.facets?.[0].index.byteEnd).toEqual(57)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario C - partially after)', () => {
    const output = input.clone().delete(31, 88)
    expect(output.text).toEqual('one👨‍👩‍👧‍👧 tw')
    expect(output.facets?.[0].index.byteStart).toEqual(29)
    expect(output.facets?.[0].index.byteEnd).toEqual(31)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('tw')
  })

  it('correctly adjusts facets (scenario D - entirely inner)', () => {
    const output = input.clone().delete(30, 32)
    expect(output.text).toEqual('one👨‍👩‍👧‍👧 t👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.byteStart).toEqual(29)
    expect(output.facets?.[0].index.byteEnd).toEqual(55)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('t👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario E - partially before)', () => {
    const output = input.clone().delete(28, 31)
    expect(output.text).toEqual('one👨‍👩‍👧‍👧o👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.byteStart).toEqual(28)
    expect(output.facets?.[0].index.byteEnd).toEqual(54)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('o👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario F - entirely before)', () => {
    const output = input.clone().delete(0, 2)
    expect(output.text).toEqual('e👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.byteStart).toEqual(27)
    expect(output.facets?.[0].index.byteEnd).toEqual(55)
    expect(
      output.unicodeText.slice(
        output.facets?.[0].index.byteStart,
        output.facets?.[0].index.byteEnd,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
  })
})

describe('RichText#segments', () => {
  it('produces an empty output for an empty input', () => {
    const input = new RichText({ text: '' })
    expect(Array.from(input.segments())).toEqual([{ text: '' }])
  })

  it('produces a single segment when no facets are present', () => {
    const input = new RichText({ text: 'hello' })
    expect(Array.from(input.segments())).toEqual([{ text: 'hello' }])
  })

  it('produces 3 segments with 1 entity in the middle', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 4, byteEnd: 7 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two',
        facet: {
          index: { byteStart: 4, byteEnd: 7 },
          features: [{ $type: '' }],
        },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the byteStart', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 0, byteEnd: 7 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two',
        facet: {
          index: { byteStart: 0, byteEnd: 7 },
          features: [{ $type: '' }],
        },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the end', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 4, byteEnd: 13 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two three',
        facet: {
          index: { byteStart: 4, byteEnd: 13 },
          features: [{ $type: '' }],
        },
      },
    ])
  })

  it('produces 1 segments with 1 entity around the entire string', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 0, byteEnd: 13 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two three',
        facet: {
          index: { byteStart: 0, byteEnd: 13 },
          features: [{ $type: '' }],
        },
      },
    ])
  })

  it('produces 5 segments with 3 facets covering each word', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 0, byteEnd: 3 }, features: [{ $type: '' }] },
        { index: { byteStart: 4, byteEnd: 7 }, features: [{ $type: '' }] },
        { index: { byteStart: 8, byteEnd: 13 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: {
          index: { byteStart: 0, byteEnd: 3 },
          features: [{ $type: '' }],
        },
      },
      { text: ' ' },
      {
        text: 'two',
        facet: {
          index: { byteStart: 4, byteEnd: 7 },
          features: [{ $type: '' }],
        },
      },
      { text: ' ' },
      {
        text: 'three',
        facet: {
          index: { byteStart: 8, byteEnd: 13 },
          features: [{ $type: '' }],
        },
      },
    ])
  })

  it('uses utf8 indices', () => {
    const input = new RichText({
      text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
      facets: [
        { index: { byteStart: 0, byteEnd: 28 }, features: [{ $type: '' }] },
        { index: { byteStart: 29, byteEnd: 57 }, features: [{ $type: '' }] },
        { index: { byteStart: 58, byteEnd: 88 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one👨‍👩‍👧‍👧',
        facet: {
          index: { byteStart: 0, byteEnd: 28 },
          features: [{ $type: '' }],
        },
      },
      { text: ' ' },
      {
        text: 'two👨‍👩‍👧‍👧',
        facet: {
          index: { byteStart: 29, byteEnd: 57 },
          features: [{ $type: '' }],
        },
      },
      { text: ' ' },
      {
        text: 'three👨‍👩‍👧‍👧',
        facet: {
          index: { byteStart: 58, byteEnd: 88 },
          features: [{ $type: '' }],
        },
      },
    ])
  })

  it('correctly identifies mentions and links', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        {
          index: { byteStart: 0, byteEnd: 3 },
          features: [
            {
              $type: 'app.bsky.richtext.facet#mention',
              did: 'did:plc:123',
            },
          ],
        },
        {
          index: { byteStart: 4, byteEnd: 7 },
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: 'https://example.com',
            },
          ],
        },
        {
          index: { byteStart: 8, byteEnd: 13 },
          features: [{ $type: 'other' }],
        },
      ],
    })
    const segments = Array.from(input.segments())
    expect(segments[0].isLink()).toBe(false)
    expect(segments[0].isMention()).toBe(true)
    expect(segments[1].isLink()).toBe(false)
    expect(segments[1].isMention()).toBe(false)
    expect(segments[2].isLink()).toBe(true)
    expect(segments[2].isMention()).toBe(false)
    expect(segments[3].isLink()).toBe(false)
    expect(segments[3].isMention()).toBe(false)
    expect(segments[4].isLink()).toBe(false)
    expect(segments[4].isMention()).toBe(false)
  })

  it('skips facets that incorrectly overlap (left edge)', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 0, byteEnd: 3 }, features: [{ $type: '' }] },
        { index: { byteStart: 2, byteEnd: 9 }, features: [{ $type: '' }] },
        { index: { byteStart: 8, byteEnd: 13 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: {
          index: { byteStart: 0, byteEnd: 3 },
          features: [{ $type: '' }],
        },
      },
      {
        text: ' two ',
      },
      {
        text: 'three',
        facet: {
          index: { byteStart: 8, byteEnd: 13 },
          features: [{ $type: '' }],
        },
      },
    ])
  })

  it('skips facets that incorrectly overlap (right edge)', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { byteStart: 0, byteEnd: 3 }, features: [{ $type: '' }] },
        { index: { byteStart: 4, byteEnd: 9 }, features: [{ $type: '' }] },
        { index: { byteStart: 8, byteEnd: 13 }, features: [{ $type: '' }] },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: {
          index: { byteStart: 0, byteEnd: 3 },
          features: [{ $type: '' }],
        },
      },
      { text: ' ' },
      {
        text: 'two t',
        facet: {
          index: { byteStart: 4, byteEnd: 9 },
          features: [{ $type: '' }],
        },
      },
      {
        text: 'hree',
      },
    ])
  })
})
