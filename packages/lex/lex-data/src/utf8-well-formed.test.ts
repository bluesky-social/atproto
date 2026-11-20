import { describe, expect, it } from 'vitest'
import { isWellFormedPonyfill, isWellFormedRegExp } from './utf8-well-formed.js'

describe.each([isWellFormedRegExp!, isWellFormedPonyfill])('%o', (fn) => {
  it.each([
    ['an empty string', ''],
    ['ASCII', 'hello'],
    ['BMP characters', 'é一￿'],
    ['a surrogate pair', '😀'],
    ['surrogate pairs and text', 'a😀b👨‍👩‍👧‍👧c'],
  ])('accepts %s', (_, str) => {
    expect(fn(str)).toBe(true)
  })

  it.each([
    ['a lone high surrogate', '\ud83d'],
    ['a trailing high surrogate', 'abc\ud83d'],
    ['a lone low surrogate', '\ude00'],
    ['a leading low surrogate', '\ude00abc'],
    ['reversed surrogates', '\ude00\ud83d'],
    ['two high surrogates', '\ud83d\ud83d'],
    ['a high surrogate before text', '\ud83da'],
    ['a lone surrogate after a pair', '😀\ude00'],
  ])('rejects %s', (_, str) => {
    expect(fn(str)).toBe(false)
  })
})
