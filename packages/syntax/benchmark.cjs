/* eslint-env node, commonjs */

const { validateNsid, validateNsidRegex } = require('.')

// $ node benchmark.js
// valid NSIDs {
//   parsed: 181.56524884700775,
//   regexp: 77.61082607507706,
//   optimized: 60.183539509773254
// }
// invalid NSIDs {
//   parsed: 128.7685609459877,
//   regexp: 108.75775015354156,
//   optimized: 53.196488440036774
// }

bench('valid NSIDs', true, [
  'com.example.foo',
  'o'.repeat(63) + '.foo.bar',
  'com.' + 'o'.repeat(63) + '.foo',
  'com.example.' + 'o'.repeat(63),
  'com.' + 'middle.'.repeat(40) + 'foo',
  'com.example.fooBar',
  'net.users.bob.ping',
  'a.b.c',
  'm.xn--masekowski-d0b.pl',
  'one.two.three',
  'one.two.three.four-and.FiVe',
  'one.2.three',
  'a-0.b-1.c',
  'a0.b1.cc',
  'cn.8.lex.stuff',
  'test.12345.record',
  'a01.thing.record',
  'a.0.c',
  'xn--fiqs8s.xn--fiqa61au8b7zsevnm8ak20mc4a87e.record.two',
  'a0.b1.c3',
  'com.example.f00',
  'onion.expyuzz4wqqyqhjn.spec.getThing',
  'onion.g2zyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
  'org.4chan.lex.getThing',
  'cn.8.lex.stuff',
  'onion.2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid.lex.deleteThing',
  'a.'.repeat(158) + 'a',
])

bench('invalid NSIDs', false, [
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

function bench(name, expectedResult, cases) {
  const validators = {
    parsed: (nsid) => validateNsid(nsid).success,
    regexp: (nsid) => validateNsidRegex(nsid).success,
    optimized: (nsid) => validateNsidOptimized(nsid).success,
  }

  const times = Object.fromEntries(Object.keys(validators).map((k) => [k, 0]))

  for (let i = 0; i < 1000; i++) {
    for (const [name, fn] of Object.entries(validators)) {
      const start = performance.now()
      for (let j = 0; j < 20; j++) {
        for (const value of cases) {
          if (fn(value) !== expectedResult) {
            throw new Error(`Validator ${name} gave wrong result`)
          }
        }
      }
      times[name] += performance.now() - start
    }
  }

  console.log(
    name,
    Object.fromEntries(
      Object.entries(times).map(([k, v]) => [k, `${v.toFixed(2)} ms`]),
    ),
  )
}

/** @param value {string} */
function validateNsidOptimized(value) {
  const { length } = value
  if (length > 253 + 1 + 63) {
    return { success: false, message: 'NSID is too long (317 chars max)' }
  }

  let partCount = 1
  let partStart = 0
  let partHasLeadingDigit = false
  let partHasHyphen = false

  let charCode
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
        return {
          success: false,
          message: 'NSID first part may not start with a digit',
        }
      }

      // All good

      if (i === partStart) {
        partHasLeadingDigit = true
      }
    } else if (charCode === 45 /* - */) {
      if (i === partStart) {
        return {
          success: false,
          message: 'NSID part can not start with hyphen',
        }
      }
      if (i === length - 1 || value.charCodeAt(i + 1) === 46 /* . */) {
        return { success: false, message: 'NSID part can not end with hyphen' }
      }

      // All good

      partHasHyphen = true
    } else if (charCode === 46 /* . */) {
      // Check prev part size
      if (i === partStart) {
        return { success: false, message: 'NSID parts can not be empty' }
      }
      if (i - partStart > 63) {
        return { success: false, message: 'NSID part too long (max 63 chars)' }
      }

      // All good

      partCount++
      partStart = i + 1
      partHasHyphen = false
      partHasLeadingDigit = false
    } else {
      return {
        success: false,
        message:
          'Disallowed characters in NSID (ASCII letters, digits, dashes, periods only)',
      }
    }
  }

  // Check last part size
  if (length === partStart) {
    return { success: false, message: 'NSID parts can not be empty' }
  }
  if (length - partStart > 63) {
    return { success: false, message: 'NSID part too long (max 63 chars)' }
  }

  // Check last part chars
  if (partHasHyphen || partHasLeadingDigit) {
    return {
      success: false,
      message:
        'NSID name part must be only letters and digits (and no leading digit)',
    }
  }

  // Check part count
  if (partCount < 3) {
    return { success: false, message: 'NSID needs at least three parts' }
  }

  return { success: true, value }
}
