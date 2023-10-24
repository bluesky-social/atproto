import { describe, test, it, expect } from '@jest/globals'
import {
  HASHTAG_REGEX,
  HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX,
  TRAILING_PUNCTUATION_REGEX,
  LEADING_HASH_REGEX,
  HASHTAG_INVALID_CHARACTER_REGEX,
  LEADING_PUNCTUATION_REGEX,
  sanitizeHashtag,
  validateHashtag,
} from '../src'

test('Real World™', () => {
  const text = `I like #turtles!!!`

  const loose = text.match(HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX)
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

/*
 * This is also tested indirectly via `RichText.detectFacets` tests
 */
describe('HASHTAG_REGEX', () => {
  ;(
    [
      ['#', undefined],
      ['#tag', '#tag'],
      ['#1', undefined],
      ['#a1', '#a1'],
      ['#_a', undefined],
      ['#-a', undefined],
      ['#a_', '#a_'],
      ['#a-', '#a-'],
      ['test #tag', ' #tag'],
      ['test # tag', undefined],
      ['##hashhash', undefined],
      ['url.com/path#anchor', undefined],
      ['some #n0n3s@n5e!', ' #n0n3s'],
      ['works #with,punctuation', ' #with'],
      ['#🦋', '#🦋'],
      ['#👍🏿', '#👍🏿'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.match(HASHTAG_REGEX)?.[0]).toEqual(output)
    })
  })

  /**
   * Non-english, all these mean 'squirrel'
   */
  ;(
    [
      ['#eichhörnchen', '#eichhörnchen'],
      ['#écureuil', '#écureuil'],
      ['#білка', '#білка'],
      ['#リス', '#リス'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.match(HASHTAG_REGEX)?.[0]).toEqual(output)
    })
  })
})

describe('HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX', () => {
  ;(
    [
      ['#', undefined],
      ['#tag', '#tag'],
      ['#1', undefined],
      ['#tag!', '#tag!'],
      ['test #tag?', ' #tag?'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.match(HASHTAG_WITH_TRAILING_PUNCTUATION_REGEX)?.[0]).toEqual(
        output,
      )
    })
  })
})

describe('TRAILING_PUNCTUATION_REGEX', () => {
  ;(
    [
      ['#', '#'],
      ['#tag', undefined],
      ['#1', undefined],
      ['#tag!', '!'],
      ['test #tag?', '?'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.match(TRAILING_PUNCTUATION_REGEX)?.[0]).toEqual(output)
    })
  })
})

describe('LEADING_PUNCTUATION_REGEX', () => {
  ;(
    [
      ['#', '#'],
      ['-tag', '-'],
      ['_tag', '_'],
      ['!tag', '!'],
      ['?tag', '?'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.match(LEADING_PUNCTUATION_REGEX)?.[0]).toEqual(output)
    })
  })
})

describe('HASHTAG_INVALID_CHARACTER_REGEX', () => {
  ;(
    [
      ['tag', 'tag'],
      ['#tag', 'tag'],
      ['#tag_tag', 'tag_tag'],
      ['#tag-tag', 'tag-tag'],
      ['#l33t', 'l33t'],
      ['#🦋', '🦋'],
      ['#butter🦋fly', 'butter🦋fly'],
      ['#👍🏿', '👍🏿'],
      ['pun.ctu.ati.on', 'punctuation'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(input.replace(HASHTAG_INVALID_CHARACTER_REGEX, '')).toEqual(output)
    })
  })
})

describe('validateHashtag', () => {
  ;(
    [
      ['tag', true],
      ['#tag', true],
      ['#1', false],
      ['#_a', false],
      ['#-a', false],
      ['#a_', false],
      ['#a-', false],
      ['#turtles!', false],
      ['#🦋', true],
      ['butter🦋fly', true],
      ['#👍🏿', true],
      [
        '#thisisa65characterstring_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        false,
      ],
      [
        '#🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋🦋',
        true,
      ],
    ] as [string, boolean][]
  ).forEach(([input, valid]: [string, boolean]) => {
    it(input, () => {
      expect(validateHashtag(input)).toEqual(valid)
    })
  })
})

describe('sanitizeHashtag', () => {
  ;(
    [
      ['tag', 'tag'],
      ['#tag', 'tag'],
      ['#tag_tag', 'tag_tag'],
      ['#tag-tag', 'tag-tag'],
      ['#l33t', 'l33t'],
      ['#🦋', '🦋'],
      ['#butter🦋fly', 'butter🦋fly'],
      ['#👍🏿', '👍🏿'],
      ['tag_', 'tag'],
      ['tag-', 'tag'],
      ['_tag', 'tag'],
      ['-tag', 'tag'],
      ['#0x', 'x'],
      ['pun.ctu.ati.on', 'punctuation'],
    ] as [string, string][]
  ).forEach(([input, output]: [string, string]) => {
    it(input, () => {
      expect(sanitizeHashtag(input)).toEqual(output)
    })
  })
})
