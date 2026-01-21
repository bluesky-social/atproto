import { describe, expect, it } from 'vitest'
import * as com from './lexicons/com.js'

describe('com.example.stringLength', () => {
  describe('valid cases', () => {
    for (const string of [
      'ab',
      'abc',
      'abcd',
      '\u0301', // Combining acute accent (2 bytes)
      'a\u0301', // 'a' + combining acute accent (1 + 2 bytes = 3 bytes)
      'aé', // 'a' (1 byte) + 'é' (2 bytes) = 3 bytes
      '一', // CJK character (3 bytes)
      '\uD83D', // Unpaired high surrogate (3 bytes)
      'éé', // 'é' + 'é' (2 + 2 bytes = 4 bytes)
      'aaé', // 1 + 1 + 2 = 4 bytes
      '👋', // 4 bytes
    ]) {
      it(`accepts valid ${JSON.stringify(string)}`, () => {
        com.example.stringLength.$parse({
          $type: 'com.example.stringLength',
          string,
        })
      })
    }
  })

  describe('invalid cases', () => {
    for (const { string, error } of [
      { string: '', error: 'string too small (minimum 2) at $.string (got 0)' },
      {
        string: 'a',
        error: 'string too small (minimum 2) at $.string (got 1)',
      },
      {
        string: 'abcde',
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: 'a\u0301\u0301', // 1 + (2 * 2) = 5 bytes
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: '\uD83D\uD83D', // Two unpaired high surrogates (3 * 2 = 6 bytes)
        error: 'string too big (maximum 4) at $.string (got 6)',
      },
      {
        string: 'ééé', // 2 + 2 + 2 bytes = 6 bytes
        error: 'string too big (maximum 4) at $.string (got 6)',
      },
      {
        string: '👋a', // 4 + 1 bytes = 5 bytes
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: '👨👨', // 4 + 4 = 8 bytes
        error: 'string too big (maximum 4) at $.string (got 8)',
      },
      {
        string: '👨‍👩‍👧‍👧', // 4 emojis × 4 bytes + 3 ZWJs × 3 bytes = 25 bytes
        error: 'string too big (maximum 4) at $.string (got 25)',
      },
    ]) {
      it(`rejects invalid ${JSON.stringify(string)}`, () => {
        expect(() =>
          com.example.stringLength.$parse({
            $type: 'com.example.stringLength',
            string,
          }),
        ).toThrow(error)
      })
    }
  })
})

describe('com.example.stringLengthNoMinLength', () => {
  describe('valid cases', () => {
    for (const string of [
      // Shorter than two UTF8 characters
      '',
      'a',
      // Two to four UTF8 characters
      'ab',
      '\u0301', // Combining acute accent (2 bytes)
      'a\u0301', // 'a' + combining acute accent (1 + 2 bytes = 3 bytes)
      'aé', // 'a' (1 byte) + 'é' (2 bytes) = 3 bytes
      'abc',
      '一', // CJK character (3 bytes)
      '\uD83D', // Unpaired high surrogate (3 bytes)
      'abcd',
      'éé', // 'é' + 'é' (2 + 2 bytes = 4 bytes)
      'aaé', // 1 + 1 + 2 = 4 bytes
      '👋', // 4 bytes
    ]) {
      it(`accepts valid ${JSON.stringify(string)}`, () => {
        com.example.stringLengthNoMinLength.$parse({
          $type: 'com.example.stringLengthNoMinLength',
          string,
        })
      })
    }
  })

  describe('invalid cases', () => {
    for (const { string, error } of [
      {
        string: 'abcde',
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: 'a\u0301\u0301', // 1 + (2 * 2) = 5 bytes
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: '\uD83D\uD83D', // Two unpaired high surrogates (3 * 2 = 6 bytes)
        error: 'string too big (maximum 4) at $.string (got 6)',
      },
      {
        string: 'ééé', // 2 + 2 + 2 bytes = 6 bytes
        error: 'string too big (maximum 4) at $.string (got 6)',
      },
      {
        string: '👋a', // 4 + 1 bytes = 5 bytes
        error: 'string too big (maximum 4) at $.string (got 5)',
      },
      {
        string: '👨👨', // 4 + 4 = 8 bytes
        error: 'string too big (maximum 4) at $.string (got 8)',
      },
      {
        string: '👨‍👩‍👧‍👧', // 4 emojis × 4 bytes + 3 ZWJs × 3 bytes = 25 bytes
        error: 'string too big (maximum 4) at $.string (got 25)',
      },
    ]) {
      it(`rejects invalid ${JSON.stringify(string)}`, () => {
        expect(() =>
          com.example.stringLengthNoMinLength.$parse({
            $type: 'com.example.stringLengthNoMinLength',
            string,
          }),
        ).toThrow(error)
      })
    }
  })
})

describe('com.example.stringLengthGrapheme', () => {
  describe('valid cases', () => {
    for (const string of [
      'ab',
      'a\u0301b', // 'áb' with combining accent
      'a\u0301b\u0301', // 'áb́'
      '😀😀',
      '12👨‍👩‍👧‍👧',
      'abcd',
      'a\u0301b\u0301c\u0301d\u0301', // 'áb́ćd́'
    ]) {
      it(`accepts valid ${JSON.stringify(string)}`, () => {
        com.example.stringLengthGrapheme.$parse({
          $type: 'com.example.stringLengthGrapheme',
          string,
        })
      })
    }
  })

  describe('invalid cases', () => {
    for (const { string, error } of [
      // Shorter than two graphemes
      {
        string: '',
        error: 'grapheme too small (minimum 2) at $.string (got 0)',
      },
      {
        string: '\u0301\u0301\u0301', // Three combining acute accents
        error: 'grapheme too small (minimum 2) at $.string (got 1)',
      },
      {
        string: 'a',
        error: 'grapheme too small (minimum 2) at $.string (got 1)',
      },
      {
        string: 'a\u0301\u0301\u0301\u0301', // 'á́́́' ('a' with four combining acute accents)
        error: 'grapheme too small (minimum 2) at $.string (got 1)',
      },
      {
        string: '5\uFE0F', // '5️' with emoji presentation
        error: 'grapheme too small (minimum 2) at $.string (got 1)',
      },
      {
        string: '👨‍👩‍👧‍👧',
        error: 'grapheme too small (minimum 2) at $.string (got 1)',
      },
      // Longer than four graphemes
      {
        string: 'abcde',
        error: 'grapheme too big (maximum 4) at $.string (got 5)',
      },
      {
        string: 'a\u0301b\u0301c\u0301d\u0301e\u0301', // 'áb́ćd́é'
        error: 'grapheme too big (maximum 4) at $.string (got 5)',
      },
      {
        string: '😀😀😀😀😀',
        error: 'grapheme too big (maximum 4) at $.string (got 5)',
      },
      {
        string: 'ab😀de',
        error: 'grapheme too big (maximum 4) at $.string (got 5)',
      },
    ]) {
      it(`rejects invalid ${JSON.stringify(string)}`, () => {
        expect(() =>
          com.example.stringLengthGrapheme.$parse({
            $type: 'com.example.stringLengthGrapheme',
            string,
          }),
        ).toThrow(error)
      })
    }
  })
})

describe('com.example.stringEnum', () => {
  it('Applies string enum constraint', () => {
    com.example.stringEnum.$parse({
      $type: 'com.example.stringEnum',
      string: 'a',
    })
    expect(() =>
      com.example.stringEnum.$parse({
        $type: 'com.example.stringEnum',
        string: 'c',
      }),
    ).toThrow('Expected one of "a" or "b" at $.string (got "c")')
  })
})
describe('com.example.stringConst', () => {
  it('Applies string const constraint', () => {
    com.example.stringConst.$parse({
      $type: 'com.example.stringConst',
      string: 'a',
    })
    expect(() =>
      com.example.stringConst.$parse({
        $type: 'com.example.stringConst',
        string: 'b',
      }),
    ).toThrow('Expected "a" at $.string (got "b")')
  })
})
describe('com.example.datetime', () => {
  it('Applies datetime formatting constraint', () => {
    for (const datetime of [
      '2022-12-12T00:50:36.809Z',
      '2022-12-12T00:50:36Z',
      '2022-12-12T00:50:36.8Z',
      '2022-12-12T00:50:36.80Z',
      '2022-12-12T00:50:36+00:00',
      '2022-12-12T00:50:36.8+00:00',
      '2022-12-11T19:50:36-05:00',
      '2022-12-11T19:50:36.8-05:00',
      '2022-12-11T19:50:36.80-05:00',
      '2022-12-11T19:50:36.809-05:00',
    ]) {
      com.example.datetime.$parse({
        $type: 'com.example.datetime',
        datetime,
      })
    }
    expect(() =>
      com.example.datetime.$parse({
        $type: 'com.example.datetime',
        datetime: 'bad date',
      }),
    ).toThrow('Invalid datetime at $.datetime (got "bad date")')
  })
})
describe('com.example.uri', () => {
  it('Applies uri formatting constraint', () => {
    for (const uri of [
      'https://example.com',
      'https://example.com/with/path',
      'https://example.com/with/path?and=query',
      'at://bsky.social',
      'did:example:test',
    ]) {
      com.example.uri.$parse({
        $type: 'com.example.uri',
        uri,
      })
    }
    expect(() =>
      com.example.uri.$parse({
        $type: 'com.example.uri',
        uri: 'not a uri',
      }),
    ).toThrow('Invalid uri at $.uri (got "not a uri")')
  })
})
describe('com.example.atUri', () => {
  it('Applies at-uri formatting constraint', () => {
    com.example.atUri.$parse({
      $type: 'com.example.atUri',
      atUri: 'at://did:web:example.com/com.example.test/self',
    })
    expect(() =>
      com.example.atUri.$parse({
        $type: 'com.example.atUri',
        atUri: 'http://not-atproto.com',
      }),
    ).toThrow('Invalid at-uri at $.atUri (got "http://not-atproto.com")')
  })
})
describe('com.example.did', () => {
  it('Applies did formatting constraint', () => {
    com.example.did.$parse({
      $type: 'com.example.did',
      did: 'did:web:example.com',
    })
    com.example.did.$parse({
      $type: 'com.example.did',
      did: 'did:plc:12345678abcdefghijklmnop',
    })

    expect(() =>
      com.example.did.$parse({
        $type: 'com.example.did',
        did: 'bad did',
      }),
    ).toThrow('Invalid DID at $.did (got "bad did")')
    expect(() =>
      com.example.did.$parse({
        $type: 'com.example.did',
        did: 'did:short',
      }),
    ).toThrow('Invalid DID at $.did (got "did:short")')
  })
})
describe('com.example.handle', () => {
  it('Applies handle formatting constraint', () => {
    com.example.handle.$parse({
      $type: 'com.example.handle',
      handle: 'test.bsky.social',
    })
    com.example.handle.$parse({
      $type: 'com.example.handle',
      handle: 'bsky.test',
    })

    expect(() =>
      com.example.handle.$parse({
        $type: 'com.example.handle',
        handle: 'bad handle',
      }),
    ).toThrow('Invalid handle at $.handle (got "bad handle")')
    expect(() =>
      com.example.handle.$parse({
        $type: 'com.example.handle',
        handle: '-bad-.test',
      }),
    ).toThrow('Invalid handle at $.handle (got "-bad-.test")')
  })
})
describe('com.example.atIdentifier', () => {
  it('Applies at-identifier formatting constraint', () => {
    com.example.atIdentifier.$parse({
      $type: 'com.example.atIdentifier',
      atIdentifier: 'bsky.test',
    })
    com.example.atIdentifier.$parse({
      $type: 'com.example.atIdentifier',
      atIdentifier: 'did:plc:12345678abcdefghijklmnop',
    })

    expect(() =>
      com.example.atIdentifier.$parse({
        $type: 'com.example.atIdentifier',
        atIdentifier: 'bad id',
      }),
    ).toThrow('Invalid AT identifier at $.atIdentifier (got "bad id")')
    expect(() =>
      com.example.atIdentifier.$parse({
        $type: 'com.example.atIdentifier',
        atIdentifier: '-bad-.test',
      }),
    ).toThrow('Invalid AT identifier at $.atIdentifier (got "-bad-.test")')
  })
})
describe('com.example.nsid', () => {
  it('Applies nsid formatting constraint', () => {
    com.example.nsid.$parse({
      $type: 'com.example.nsid',
      nsid: 'com.atproto.test',
    })
    com.example.nsid.$parse({
      $type: 'com.example.nsid',
      nsid: 'app.bsky.nested.test',
    })

    expect(() =>
      com.example.nsid.$parse({
        $type: 'com.example.nsid',
        nsid: 'bad nsid',
      }),
    ).toThrow('Invalid NSID at $.nsid (got "bad nsid")')
    expect(() =>
      com.example.nsid.$parse({
        $type: 'com.example.nsid',
        nsid: 'com.bad-.foo',
      }),
    ).toThrow('Invalid NSID at $.nsid (got "com.bad-.foo")')
  })
})
describe('com.example.cid', () => {
  it('Applies cid formatting constraint', () => {
    com.example.cid.$parse({
      $type: 'com.example.cid',
      cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    })
    expect(() =>
      com.example.cid.$parse({
        $type: 'com.example.cid',
        cid: 'abapsdofiuwrpoiasdfuaspdfoiu',
      }),
    ).toThrow(
      'Invalid CID string at $.cid (got "abapsdofiuwrpoiasdfuaspdfoiu")',
    )
  })
})
describe('com.example.language', () => {
  it('Applies language formatting constraint', () => {
    com.example.language.$parse({
      $type: 'com.example.language',
      language: 'en-US-boont',
    })
    expect(() =>
      com.example.language.$parse({
        $type: 'com.example.language',
        language: 'not-a-language-',
      }),
    ).toThrow('Invalid language at $.language (got "not-a-language-")')
  })
})
