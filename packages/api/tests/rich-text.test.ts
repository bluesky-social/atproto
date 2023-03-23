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
        index: { start: 0, end: 1 },
        value: {
          $type: 'app.bsky.richtext.facet#link',
          uri: 'https://example.com',
        },
      },
      {
        $type: 'app.bsky.richtext.facet',
        index: { start: 1, end: 2 },
        value: {
          $type: 'app.bsky.richtext.facet#mention',
          did: 'did:plc:1234',
        },
      },
    ])
  })
})

describe('RichText#insert', () => {
  const input = new RichText({
    text: 'hello world',
    facets: [{ index: { start: 2, end: 7 }, value: { $type: '' } }],
  })

  it('correctly adjusts facets (scenario A - before)', () => {
    const output = input.clone().insert(0, 'test')
    expect(String(output.text)).toEqual('testhello world')
    expect(output.facets?.[0].index.start).toEqual(6)
    expect(output.facets?.[0].index.end).toEqual(11)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts facets (scenario B - inner)', () => {
    const output = input.clone().insert(4, 'test')
    expect(String(output.text)).toEqual('helltesto world')
    expect(output.facets?.[0].index.start).toEqual(2)
    expect(output.facets?.[0].index.end).toEqual(11)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('lltesto w')
  })

  it('correctly adjusts facets (scenario C - after)', () => {
    const output = input.clone().insert(8, 'test')
    expect(String(output.text)).toEqual('hello wotestrld')
    expect(output.facets?.[0].index.start).toEqual(2)
    expect(output.facets?.[0].index.end).toEqual(7)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('llo w')
  })
})

describe('RichText#insert w/fat unicode', () => {
  const input = new RichText({
    text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
    facets: [
      { index: { start: 0, end: 28 }, value: { $type: '' } },
      { index: { start: 29, end: 57 }, value: { $type: '' } },
      { index: { start: 58, end: 88 }, value: { $type: '' } },
    ],
  })

  it('correctly adjusts facets (scenario A - before)', () => {
    const output = input.clone().insert(0, 'test')
    expect(String(output.text)).toEqual('testone👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('one👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[1].index.start,
        output.facets?.[1].index.end,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[2].index.start,
        output.facets?.[2].index.end,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario B - inner)', () => {
    const output = input.clone().insert(3, 'test')
    expect(String(output.text)).toEqual('onetest👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('onetest👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[1].index.start,
        output.facets?.[1].index.end,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[2].index.start,
        output.facets?.[2].index.end,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario C - after)', () => {
    const output = input.clone().insert(28, 'test')
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧test two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('one👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[1].index.start,
        output.facets?.[1].index.end,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
    expect(
      output.text.slice(
        output.facets?.[2].index.start,
        output.facets?.[2].index.end,
      ),
    ).toEqual('three👨‍👩‍👧‍👧')
  })
})

describe('RichText#delete', () => {
  const input = new RichText({
    text: 'hello world',
    facets: [{ index: { start: 2, end: 7 }, value: { $type: '' } }],
  })

  it('correctly adjusts facets (scenario A - entirely outer)', () => {
    const output = input.clone().delete(0, 9)
    expect(String(output.text)).toEqual('ld')
    expect(output.facets?.length).toEqual(0)
  })

  it('correctly adjusts facets (scenario B - entirely after)', () => {
    const output = input.clone().delete(7, 11)
    expect(String(output.text)).toEqual('hello w')
    expect(output.facets?.[0].index.start).toEqual(2)
    expect(output.facets?.[0].index.end).toEqual(7)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts facets (scenario C - partially after)', () => {
    const output = input.clone().delete(4, 11)
    expect(String(output.text)).toEqual('hell')
    expect(output.facets?.[0].index.start).toEqual(2)
    expect(output.facets?.[0].index.end).toEqual(4)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('ll')
  })

  it('correctly adjusts facets (scenario D - entirely inner)', () => {
    const output = input.clone().delete(3, 5)
    expect(String(output.text)).toEqual('hel world')
    expect(output.facets?.[0].index.start).toEqual(2)
    expect(output.facets?.[0].index.end).toEqual(5)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('l w')
  })

  it('correctly adjusts facets (scenario E - partially before)', () => {
    const output = input.clone().delete(1, 5)
    expect(String(output.text)).toEqual('h world')
    expect(output.facets?.[0].index.start).toEqual(1)
    expect(output.facets?.[0].index.end).toEqual(3)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual(' w')
  })

  it('correctly adjusts facets (scenario F - entirely before)', () => {
    const output = input.clone().delete(0, 2)
    expect(String(output.text)).toEqual('llo world')
    expect(output.facets?.[0].index.start).toEqual(0)
    expect(output.facets?.[0].index.end).toEqual(5)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('llo w')
  })
})

describe('RichText#delete w/fat unicode', () => {
  const input = new RichText({
    text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
    facets: [{ index: { start: 29, end: 57 }, value: { $type: '' } }],
  })

  it('correctly adjusts facets (scenario A - entirely outer)', () => {
    const output = input.clone().delete(28, 58)
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧three👨‍👩‍👧‍👧')
    expect(output.facets?.length).toEqual(0)
  })

  it('correctly adjusts facets (scenario B - entirely after)', () => {
    const output = input.clone().delete(57, 88)
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.start).toEqual(29)
    expect(output.facets?.[0].index.end).toEqual(57)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('two👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario C - partially after)', () => {
    const output = input.clone().delete(31, 88)
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧 tw')
    expect(output.facets?.[0].index.start).toEqual(29)
    expect(output.facets?.[0].index.end).toEqual(31)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('tw')
  })

  it('correctly adjusts facets (scenario D - entirely inner)', () => {
    const output = input.clone().delete(30, 32)
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧 t👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.start).toEqual(29)
    expect(output.facets?.[0].index.end).toEqual(55)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('t👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario E - partially before)', () => {
    const output = input.clone().delete(28, 31)
    expect(String(output.text)).toEqual('one👨‍👩‍👧‍👧o👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.start).toEqual(28)
    expect(output.facets?.[0].index.end).toEqual(54)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
      ),
    ).toEqual('o👨‍👩‍👧‍👧')
  })

  it('correctly adjusts facets (scenario F - entirely before)', () => {
    const output = input.clone().delete(0, 2)
    expect(String(output.text)).toEqual('e👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧')
    expect(output.facets?.[0].index.start).toEqual(27)
    expect(output.facets?.[0].index.end).toEqual(55)
    expect(
      output.text.slice(
        output.facets?.[0].index.start,
        output.facets?.[0].index.end,
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
      facets: [{ index: { start: 4, end: 7 }, value: { $type: '' } }],
    })
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two',
        facet: { index: { start: 4, end: 7 }, value: { $type: '' } },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the start', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [{ index: { start: 0, end: 7 }, value: { $type: '' } }],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two',
        facet: { index: { start: 0, end: 7 }, value: { $type: '' } },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the end', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [{ index: { start: 4, end: 13 }, value: { $type: '' } }],
    })
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two three',
        facet: { index: { start: 4, end: 13 }, value: { $type: '' } },
      },
    ])
  })

  it('produces 1 segments with 1 entity around the entire string', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [{ index: { start: 0, end: 13 }, value: { $type: '' } }],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two three',
        facet: { index: { start: 0, end: 13 }, value: { $type: '' } },
      },
    ])
  })

  it('produces 5 segments with 3 facets covering each word', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { start: 0, end: 3 }, value: { $type: '' } },
        { index: { start: 4, end: 7 }, value: { $type: '' } },
        { index: { start: 8, end: 13 }, value: { $type: '' } },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: { index: { start: 0, end: 3 }, value: { $type: '' } },
      },
      { text: ' ' },
      {
        text: 'two',
        facet: { index: { start: 4, end: 7 }, value: { $type: '' } },
      },
      { text: ' ' },
      {
        text: 'three',
        facet: { index: { start: 8, end: 13 }, value: { $type: '' } },
      },
    ])
  })

  it('uses utf8 indices', () => {
    const input = new RichText({
      text: 'one👨‍👩‍👧‍👧 two👨‍👩‍👧‍👧 three👨‍👩‍👧‍👧',
      facets: [
        { index: { start: 0, end: 28 }, value: { $type: '' } },
        { index: { start: 29, end: 57 }, value: { $type: '' } },
        { index: { start: 58, end: 88 }, value: { $type: '' } },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one👨‍👩‍👧‍👧',
        facet: { index: { start: 0, end: 28 }, value: { $type: '' } },
      },
      { text: ' ' },
      {
        text: 'two👨‍👩‍👧‍👧',
        facet: { index: { start: 29, end: 57 }, value: { $type: '' } },
      },
      { text: ' ' },
      {
        text: 'three👨‍👩‍👧‍👧',
        facet: { index: { start: 58, end: 88 }, value: { $type: '' } },
      },
    ])
  })

  it('skips facets that incorrectly overlap (left edge)', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { start: 0, end: 3 }, value: { $type: '' } },
        { index: { start: 2, end: 9 }, value: { $type: '' } },
        { index: { start: 8, end: 13 }, value: { $type: '' } },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: { index: { start: 0, end: 3 }, value: { $type: '' } },
      },
      {
        text: ' two ',
      },
      {
        text: 'three',
        facet: { index: { start: 8, end: 13 }, value: { $type: '' } },
      },
    ])
  })

  it('skips facets that incorrectly overlap (right edge)', () => {
    const input = new RichText({
      text: 'one two three',
      facets: [
        { index: { start: 0, end: 3 }, value: { $type: '' } },
        { index: { start: 4, end: 9 }, value: { $type: '' } },
        { index: { start: 8, end: 13 }, value: { $type: '' } },
      ],
    })
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        facet: { index: { start: 0, end: 3 }, value: { $type: '' } },
      },
      { text: ' ' },
      {
        text: 'two t',
        facet: { index: { start: 4, end: 9 }, value: { $type: '' } },
      },
      {
        text: 'hree',
      },
    ])
  })
})
