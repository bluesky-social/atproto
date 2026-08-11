import { bench, describe } from 'vitest'
import { type Result, failure, success } from '../src/lib/result.js'
import { validateNsid, validateNsidRegex } from '../src/nsid.js'

// This benchmark compares three NSID validation strategies:
// - `parsed`: the current `validateNsid`, which splits the input into segments
//   and validates each one (detailed error messages)
// - `regexp`: the current `validateNsidRegex`, a single regexp pass
// - `optimized`: a candidate single-pass char-code scanner that keeps the
//   detailed error messages of `parsed`

describe('valid NSIDs', () => {
  benchNsids(true, [
    'com.example.foo',
    'com.example.fooBar',
    'net.users.bob.ping',
    'one.two.three',
    'one.two.three.four-and.FiVe',
    'one.2.three',
    'a-0.b-1.c',
    'a0.b1.cc',
    'cn.8.lex.stuff',
    'test.12345.record',
    'a01.thing.record',
    'com.example.f00',
    'onion.expyuzz4wqqyqhjn.spec.getThing',
    'org.4chan.lex.getThing',
    'cn.8.lex.stuff',
  ])
})

describe('valid outliers', () => {
  benchNsids(true, [
    'a.0.c',
    'a0.b1.c3',
    'a.b.c',
    'm.xn--masekowski-d0b.pl',
    'o'.repeat(63) + '.foo.bar',
    'com.' + 'o'.repeat(63) + '.foo',
    'com.example.' + 'o'.repeat(63),
    'com.' + 'middle.'.repeat(40) + 'foo',
    'xn--fiqs8s.xn--fiqa61au8b7zsevnm8ak20mc4a87e.record.two',
    'onion.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
    'a.'.repeat(158) + 'a',
  ])
})

describe('invalid NSIDs', () => {
  benchNsids(false, [
    'a.'.repeat(158) + '9',
    'a.'.repeat(154) + 'a😅.9',
    'o'.repeat(64) + '.foo.bar',
    'com.' + 'o'.repeat(64) + '.foo',
    'com.example.' + 'o'.repeat(64),
    'com.' + 'middle.'.repeat(50) + 'foo',
    'com.example.foo.*',
    'com.example.foo.blah*',
    'com.example.foo.*blah',
    'com.exa💩ple.thing',
    'a-0.b-1.c-3',
    'a-0.b-1.c-o',
    '1.0.0.127.record',
    '0two.example.foo',
    'example.com',
    'com.example',
    'a.',
    '.one.two.three',
    'one.two.three ',
    'one.two..three',
    'one .two.three',
    ' one.two.three',
    'com.atproto.feed.p@st',
    'com.atproto.feed.p_st',
    'com.atproto.feed.p*st',
    'com.atproto.feed.po#t',
    'com.atproto.feed.p!ot',
    'com.example-.foo',
    'com.-example.foo',
    'com.example.0foo',
    'com.example.f-o',
  ])
})

function benchNsids(expectedResult: boolean, cases: string[]) {
  const validators = {
    parsed: validateNsid,
    regexp: validateNsidRegex,
    optimized: validateNsidOptimized,
  }

  for (const [name, validate] of Object.entries(validators)) {
    // Ensure the candidates actually agree before comparing their speed.
    for (const value of cases) {
      if (validate(value).success !== expectedResult) {
        throw new Error(`Validator ${name} gave wrong result for "${value}"`)
      }
    }

    bench(name, () => {
      for (const value of cases) {
        validate(value)
      }
    })
  }
}

function validateNsidOptimized(value: string): Result<string> {
  const { length } = value
  if (length > 253 + 1 + 63) {
    return failure('NSID is too long (317 chars max)')
  }

  let partCount = 1
  let partStart = 0
  let partHasLeadingDigit = false
  let partHasHyphen = false

  let charCode: number
  for (let i = 0; i < length; i++) {
    charCode = value.charCodeAt(i)

    // Hot path: check frequent chars first
    if (
      (charCode >= 97 && charCode <= 122) /* a-z */ ||
      (charCode >= 65 && charCode <= 90) /* A-Z */
    ) {
      // All good
    } else if (charCode >= 48 && charCode <= 57 /* 0-9 */) {
      if (i === 0) {
        return failure('NSID first part may not start with a digit')
      }

      // All good

      if (i === partStart) {
        partHasLeadingDigit = true
      }
    } else if (charCode === 45 /* - */) {
      if (i === partStart) {
        return failure('NSID part can not start with hyphen')
      }
      if (i === length - 1 || value.charCodeAt(i + 1) === 46 /* . */) {
        return failure('NSID part can not end with hyphen')
      }

      // All good

      partHasHyphen = true
    } else if (charCode === 46 /* . */) {
      // Check prev part size
      if (i === partStart) {
        return failure('NSID parts can not be empty')
      }
      if (i - partStart > 63) {
        return failure('NSID part too long (max 63 chars)')
      }

      // All good

      partCount++
      partStart = i + 1
      partHasHyphen = false
      partHasLeadingDigit = false
    } else {
      return failure(
        'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
      )
    }
  }

  // Check last part size
  if (length === partStart) {
    return failure('NSID parts can not be empty')
  }
  if (length - partStart > 63) {
    return failure('NSID part too long (max 63 chars)')
  }

  // Check last part chars
  if (partHasHyphen || partHasLeadingDigit) {
    return failure(
      'NSID name part must be only letters and digits (and no leading digit)',
    )
  }

  // Check part count
  if (partCount < 3) {
    return failure('NSID needs at least three parts')
  }

  return success(value)
}
