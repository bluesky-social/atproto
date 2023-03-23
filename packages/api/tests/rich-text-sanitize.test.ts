import { RichText, sanitizeRichText, Facet } from '../src'

describe('sanitizeRichText: cleanNewlines', () => {
  it('removes more than two consecutive new lines', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with spaces', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n \n \n \n \n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n  \n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('returns original string if there are no consecutive new lines', () => {
    const input = new RichText({ text: 'test\n\ntest\n\ntest\n\ntest\n\ntest' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual(input.text)
  })

  it('returns original string if there are no new lines', () => {
    const input = new RichText({ text: 'test test          test test test' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual(input.text)
  })

  it('returns empty string if input is empty', () => {
    const input = new RichText({ text: '' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('')
  })

  it('works with different types of new line characters', () => {
    const input = new RichText({
      text: 'test\r\ntest\n\rtest\rtest\n\n\n\ntest\n\r \n \n \n \n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\r\ntest\n\rtest\rtest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with zero width space', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200B\u200B\n\n\n\ntest\n \u200B\u200B \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with zero width non-joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200C\u200C\n\n\n\ntest\n \u200C\u200C \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with zero width joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200D\u200D\n\n\n\ntest\n \u200D\u200D \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with soft hyphen', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u00AD\u00AD\n\n\n\ntest\n \u00AD\u00AD \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })

  it('removes more than two consecutive new lines with word joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u2060\u2060\n\n\n\ntest\n \u2060\u2060 \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
  })
})

describe('sanitizeRichText w/facets: cleanNewlines', () => {
  it('preserves entities as expected', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest',
      facets: [
        { index: { start: 0, end: 13 }, value: { $type: '' } },
        { index: { start: 13, end: 24 }, value: { $type: '' } },
        { index: { start: 9, end: 15 }, value: { $type: '' } },
        { index: { start: 4, end: 9 }, value: { $type: '' } },
      ],
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(facetToStr(input.text, input.facets?.[0])).toEqual(
      'test\n\n\n\n\ntest',
    )
    expect(facetToStr(input.text, input.facets?.[1])).toEqual(
      '\n\n\n\n\n\n\ntest',
    )
    expect(facetToStr(input.text, input.facets?.[2])).toEqual('test\n\n')
    expect(facetToStr(input.text, input.facets?.[3])).toEqual('\n\n\n\n\n')
    expect(output.text).toEqual('test\n\ntest\n\ntest\n\ntest\n\ntest')
    expect(facetToStr(output.text, output.facets?.[0])).toEqual('test\n\ntest')
    expect(facetToStr(output.text, output.facets?.[1])).toEqual('test')
    expect(facetToStr(output.text, output.facets?.[2])).toEqual('test')
    expect(output.facets?.[3]).toEqual(undefined)
  })
})

function facetToStr(str: string, ent?: Facet) {
  if (!ent) {
    return ''
  }
  return str.slice(ent.index.start, ent.index.end)
}
