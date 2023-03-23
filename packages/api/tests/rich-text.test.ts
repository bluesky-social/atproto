import { RichText } from '../src'

describe('richText.insert', () => {
  const input = new RichText('hello world', [
    { index: { start: 2, end: 7 }, type: '', value: '' },
  ])

  it('correctly adjusts entities (scenario A - before)', () => {
    const output = input.clone().insert(0, 'test')
    expect(output.text).toEqual('testhello world')
    expect(output.entities?.[0].index.start).toEqual(6)
    expect(output.entities?.[0].index.end).toEqual(11)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts entities (scenario B - inner)', () => {
    const output = input.clone().insert(4, 'test')
    expect(output.text).toEqual('helltesto world')
    expect(output.entities?.[0].index.start).toEqual(2)
    expect(output.entities?.[0].index.end).toEqual(11)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('lltesto w')
  })

  it('correctly adjusts entities (scenario C - after)', () => {
    const output = input.clone().insert(8, 'test')
    expect(output.text).toEqual('hello wotestrld')
    expect(output.entities?.[0].index.start).toEqual(2)
    expect(output.entities?.[0].index.end).toEqual(7)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('llo w')
  })
})

describe('richText.delete', () => {
  const input = new RichText('hello world', [
    { index: { start: 2, end: 7 }, type: '', value: '' },
  ])

  it('correctly adjusts entities (scenario A - entirely outer)', () => {
    const output = input.clone().delete(0, 9)
    expect(output.text).toEqual('ld')
    expect(output.entities?.length).toEqual(0)
  })

  it('correctly adjusts entities (scenario B - entirely after)', () => {
    const output = input.clone().delete(7, 11)
    expect(output.text).toEqual('hello w')
    expect(output.entities?.[0].index.start).toEqual(2)
    expect(output.entities?.[0].index.end).toEqual(7)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('llo w')
  })

  it('correctly adjusts entities (scenario C - partially after)', () => {
    const output = input.clone().delete(4, 11)
    expect(output.text).toEqual('hell')
    expect(output.entities?.[0].index.start).toEqual(2)
    expect(output.entities?.[0].index.end).toEqual(4)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('ll')
  })

  it('correctly adjusts entities (scenario D - entirely inner)', () => {
    const output = input.clone().delete(3, 5)
    expect(output.text).toEqual('hel world')
    expect(output.entities?.[0].index.start).toEqual(2)
    expect(output.entities?.[0].index.end).toEqual(5)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('l w')
  })

  it('correctly adjusts entities (scenario E - partially before)', () => {
    const output = input.clone().delete(1, 5)
    expect(output.text).toEqual('h world')
    expect(output.entities?.[0].index.start).toEqual(1)
    expect(output.entities?.[0].index.end).toEqual(3)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual(' w')
  })

  it('correctly adjusts entities (scenario F - entirely before)', () => {
    const output = input.clone().delete(0, 2)
    expect(output.text).toEqual('llo world')
    expect(output.entities?.[0].index.start).toEqual(0)
    expect(output.entities?.[0].index.end).toEqual(5)
    expect(
      output.text.slice(
        output.entities?.[0].index.start,
        output.entities?.[0].index.end,
      ),
    ).toEqual('llo w')
  })
})

describe('richText.segments', () => {
  it('produces an empty output for an empty input', () => {
    const input = new RichText('')
    expect(Array.from(input.segments())).toEqual([{ text: '' }])
  })

  it('produces a single segment when no entities are present', () => {
    const input = new RichText('hello')
    expect(Array.from(input.segments())).toEqual([{ text: 'hello' }])
  })

  it('produces 3 segments with 1 entity in the middle', () => {
    const input = new RichText('one two three', [
      { index: { start: 4, end: 7 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two',
        entity: { index: { start: 4, end: 7 }, type: 'type', value: 'value' },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the start', () => {
    const input = new RichText('one two three', [
      { index: { start: 0, end: 7 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two',
        entity: { index: { start: 0, end: 7 }, type: 'type', value: 'value' },
      },
      { text: ' three' },
    ])
  })

  it('produces 2 segments with 1 entity in the end', () => {
    const input = new RichText('one two three', [
      { index: { start: 4, end: 13 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      { text: 'one ' },
      {
        text: 'two three',
        entity: { index: { start: 4, end: 13 }, type: 'type', value: 'value' },
      },
    ])
  })

  it('produces 1 segments with 1 entity around the entire string', () => {
    const input = new RichText('one two three', [
      { index: { start: 0, end: 13 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one two three',
        entity: { index: { start: 0, end: 13 }, type: 'type', value: 'value' },
      },
    ])
  })

  it('produces 5 segments with 3 entities covering each word', () => {
    const input = new RichText('one two three', [
      { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      { index: { start: 4, end: 7 }, type: 'type', value: 'value' },
      { index: { start: 8, end: 13 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        entity: { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      },
      { text: ' ' },
      {
        text: 'two',
        entity: { index: { start: 4, end: 7 }, type: 'type', value: 'value' },
      },
      { text: ' ' },
      {
        text: 'three',
        entity: { index: { start: 8, end: 13 }, type: 'type', value: 'value' },
      },
    ])
  })

  it('skips entities that incorrectly overlap (left edge)', () => {
    const input = new RichText('one two three', [
      { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      { index: { start: 2, end: 9 }, type: 'type', value: 'value' },
      { index: { start: 8, end: 13 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        entity: { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      },
      {
        text: ' two ',
      },
      {
        text: 'three',
        entity: { index: { start: 8, end: 13 }, type: 'type', value: 'value' },
      },
    ])
  })

  it('skips entities that incorrectly overlap (right edge)', () => {
    const input = new RichText('one two three', [
      { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      { index: { start: 4, end: 9 }, type: 'type', value: 'value' },
      { index: { start: 8, end: 13 }, type: 'type', value: 'value' },
    ])
    expect(Array.from(input.segments())).toEqual([
      {
        text: 'one',
        entity: { index: { start: 0, end: 3 }, type: 'type', value: 'value' },
      },
      { text: ' ' },
      {
        text: 'two t',
        entity: { index: { start: 4, end: 9 }, type: 'type', value: 'value' },
      },
      {
        text: 'hree',
      },
    ])
  })
})
