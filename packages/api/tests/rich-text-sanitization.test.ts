import { RichText, sanitizeRichText, Facet, UnicodeString } from '../src'

describe('sanitizeRichText: cleanNewlines', () => {
  it('removes more than two consecutive new lines', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines w/fat unicode', () => {
    const input = new RichText({
      text: 'test👨‍👩‍👧‍👧\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n\n\ntest👨‍👩‍👧‍👧\n\n\n\n\n\n\ntest\n\n\n\n\n\n\n👨‍👩‍👧‍👧test',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test👨‍👩‍👧‍👧\n\n👨‍👩‍👧‍👧test\n\ntest👨‍👩‍👧‍👧\n\ntest\n\n👨‍👩‍👧‍👧test',
    )
  })

  it('removes more than two consecutive new lines with spaces', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n \n \n \n \n\n\ntest\n\n\n\n\n\n\ntest\n\n\n\n\n  \n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('returns original string if there are no consecutive new lines', () => {
    const input = new RichText({ text: 'test\n\ntest\n\ntest\n\ntest\n\ntest' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(String(input.unicodeText))
  })

  it('returns original string if there are no new lines', () => {
    const input = new RichText({ text: 'test test          test test test' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(String(input.unicodeText))
  })

  it('returns empty string if input is empty', () => {
    const input = new RichText({ text: '' })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual('')
  })

  it('works with different types of new line characters', () => {
    const input = new RichText({
      text: 'test\r\ntest\n\rtest\rtest\n\n\n\ntest\n\r \n \n \n \n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\r\ntest\n\rtest\rtest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines with zero width space', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200B\u200B\n\n\n\ntest\n \u200B\u200B \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines with zero width non-joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200C\u200C\n\n\n\ntest\n \u200C\u200C \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines with zero width joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u200D\u200D\n\n\n\ntest\n \u200D\u200D \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines with soft hyphen', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u00AD\u00AD\n\n\n\ntest\n \u00AD\u00AD \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
  })

  it('removes more than two consecutive new lines with word joiner', () => {
    const input = new RichText({
      text: 'test\n\n\n\n\ntest\n\u2060\u2060\n\n\n\ntest\n \u2060\u2060 \n\n\n\ntest\n\n\n\n\n\n\ntest',
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
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
    expect(facetToStr(String(input.unicodeText), input.facets?.[0])).toEqual(
      'test\n\n\n\n\ntest',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[1])).toEqual(
      '\n\n\n\n\n\n\ntest',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[2])).toEqual(
      'test\n\n',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[3])).toEqual(
      '\n\n\n\n\n',
    )
    expect(String(output.unicodeText)).toEqual(
      'test\n\ntest\n\ntest\n\ntest\n\ntest',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[0])).toEqual(
      'test\n\ntest',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[1])).toEqual(
      'test',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[2])).toEqual(
      'test',
    )
    expect(output.facets?.[3]).toEqual(undefined)
  })

  it('preserves entities as expected w/fat unicode', () => {
    const str = new UnicodeString(
      '👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test\n\n\n\n\n',
    )
    let lastI = 0
    const makeFacet = (match: string) => {
      const i = str.utf16.indexOf(match, lastI)
      lastI = i + match.length
      const start = str.utf16IndexToUtf8Index(i)
      const end = start + new UnicodeString(match).length
      return { index: { start, end }, value: { $type: '' } }
    }

    const input = new RichText({
      text: str.utf16,
      facets: [
        makeFacet('👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test'),
        makeFacet('\n\n\n\n\n👨‍👩‍👧‍👧test'),
        makeFacet('👨‍👩‍👧‍👧test\n\n'),
        makeFacet('\n\n'),
      ],
    })
    const output = sanitizeRichText(input, { cleanNewlines: true })
    expect(facetToStr(String(input.unicodeText), input.facets?.[0])).toEqual(
      '👨‍👩‍👧‍👧test\n\n\n\n\n👨‍👩‍👧‍👧test',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[1])).toEqual(
      '\n\n\n\n\n👨‍👩‍👧‍👧test',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[2])).toEqual(
      '👨‍👩‍👧‍👧test\n\n',
    )
    expect(facetToStr(String(input.unicodeText), input.facets?.[3])).toEqual(
      '\n\n',
    )
    expect(String(output.unicodeText)).toEqual(
      '👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test\n\n',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[0])).toEqual(
      '👨‍👩‍👧‍👧test\n\n👨‍👩‍👧‍👧test',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[1])).toEqual(
      '👨‍👩‍👧‍👧test',
    )
    expect(facetToStr(String(output.unicodeText), output.facets?.[2])).toEqual(
      '👨‍👩‍👧‍👧test',
    )
    expect(output.facets?.[3]).toEqual(undefined)
  })
})

function facetToStr(str: string, ent?: Facet) {
  if (!ent) {
    return ''
  }
  return new UnicodeString(str).slice(ent.index.start, ent.index.end)
}
