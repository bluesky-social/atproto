import { CID } from 'multiformats/cid'
import { LexiconDoc, Lexicons, parseLexiconDoc } from '../src/index'
import LexiconDocs from './_scaffolds/lexicons'

describe('Lexicons collection', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Adds schemas', () => {
    expect(() => lex.add(LexiconDocs[0])).toThrow()
  })

  it('Correctly references all definitions', () => {
    expect(lex.getDef('com.example.kitchenSink')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#main')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#main')).toEqual(
      LexiconDocs[0].defs.main,
    )
    expect(lex.getDef('com.example.kitchenSink#object')).toEqual(
      LexiconDocs[0].defs.object,
    )
    expect(lex.getDef('lex:com.example.kitchenSink#object')).toEqual(
      LexiconDocs[0].defs.object,
    )
  })
})

describe('General validation', () => {
  const lex = new Lexicons(LexiconDocs)
  it('Validates records correctly', () => {
    {
      const res = lex.validate('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        object: {
          object: { boolean: true },
          array: ['one', 'two'],
          boolean: true,
          integer: 123,
          string: 'string',
        },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
        atUri: 'at://did:web:example.com/com.example.test/self',
        did: 'did:web:example.com',
        cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        bytes: new Uint8Array([0, 1, 2, 3]),
        cidLink: CID.parse(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
      })
      expect(res.success).toBe(true)
    }
    {
      const res = lex.validate('com.example.kitchenSink', {})
      expect(res.success).toBe(false)
      if (res.success) throw new Error('Asserted')
      expect(res.error?.message).toBe('Record must have the property "object"')
    }
  })
  it('Validates objects correctly', () => {
    {
      const res = lex.validate('com.example.kitchenSink#object', {
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
      })
      expect(res.success).toBe(true)
    }
    {
      const res = lex.validate('com.example.kitchenSink#object', {})
      expect(res.success).toBe(false)
      if (res.success) throw new Error('Asserted')
      expect(res.error?.message).toBe('Object must have the property "object"')
    }
  })
  it('fails when a required property is missing', () => {
    const schema = {
      lexicon: 1,
      id: 'com.example.kitchenSink',
      defs: {
        test: {
          type: 'object',
          required: ['foo'],
          properties: {},
        },
      },
    }
    expect(() => {
      parseLexiconDoc(schema)
    }).toThrow('Required field \\"foo\\" not defined')
  })
  it('fails when unknown fields are present', () => {
    const schema = {
      lexicon: 1,
      id: 'com.example.unknownFields',
      defs: {
        test: {
          type: 'object',
          foo: 3,
        },
      },
    }

    expect(() => {
      parseLexiconDoc(schema)
    }).toThrow("Unrecognized key(s) in object: 'foo'")
  })
  it('fails lexicon parsing when uri is invalid', () => {
    const schema: LexiconDoc = {
      lexicon: 1,
      id: 'com.example.invalidUri',
      defs: {
        main: {
          type: 'object',
          properties: {
            test: { type: 'ref', ref: 'com.example.invalid#test#test' },
          },
        },
      },
    }

    expect(() => {
      new Lexicons([schema])
    }).toThrow('Uri can only have one hash segment')
  })
  it('fails validation when ref uri has multiple hash segments', () => {
    const schema: LexiconDoc = {
      lexicon: 1,
      id: 'com.example.invalidUri',
      defs: {
        main: {
          type: 'object',
          properties: {
            test: { type: 'integer' },
          },
        },
        object: {
          type: 'object',
          required: ['test'],
          properties: {
            test: {
              type: 'union',
              refs: ['com.example.invalidUri'],
            },
          },
        },
      },
    }
    const lexicons = new Lexicons([schema])
    expect(() => {
      lexicons.validate('com.example.invalidUri#object', {
        test: {
          $type: 'com.example.invalidUri#main#main',
          test: 123,
        },
      })
    }).toThrow('Uri can only have one hash segment')
  })
  it('union handles both implicit and explicit #main', () => {
    const schemas: LexiconDoc[] = [
      {
        lexicon: 1,
        id: 'com.example.implicitMain',
        defs: {
          main: {
            type: 'object',
            required: ['test'],
            properties: {
              test: { type: 'string' },
            },
          },
        },
      },
      {
        lexicon: 1,
        id: 'com.example.testImplicitMain',
        defs: {
          main: {
            type: 'object',
            required: ['union'],
            properties: {
              union: {
                type: 'union',
                refs: ['com.example.implicitMain'],
              },
            },
          },
        },
      },
      {
        lexicon: 1,
        id: 'com.example.testExplicitMain',
        defs: {
          main: {
            type: 'object',
            required: ['union'],
            properties: {
              union: {
                type: 'union',
                refs: ['com.example.implicitMain#main'],
              },
            },
          },
        },
      },
    ]

    const lexicon = new Lexicons(schemas)

    let result = lexicon.validate('com.example.testImplicitMain', {
      union: {
        $type: 'com.example.implicitMain',
        test: 123,
      },
    })
    expect(result.success).toBeFalsy()
    expect(result['error']?.message).toBe('Object/union/test must be a string')

    result = lexicon.validate('com.example.testImplicitMain', {
      union: {
        $type: 'com.example.implicitMain#main',
        test: 123,
      },
    })
    expect(result.success).toBeFalsy()
    expect(result['error']?.message).toBe('Object/union/test must be a string')

    result = lexicon.validate('com.example.testExplicitMain', {
      union: {
        $type: 'com.example.implicitMain',
        test: 123,
      },
    })
    expect(result.success).toBeFalsy()
    expect(result['error']?.message).toBe('Object/union/test must be a string')

    result = lexicon.validate('com.example.testExplicitMain', {
      union: {
        $type: 'com.example.implicitMain#main',
        test: 123,
      },
    })
    expect(result.success).toBeFalsy()
    expect(result['error']?.message).toBe('Object/union/test must be a string')
  })
})

describe('Record validation', () => {
  const lex = new Lexicons(LexiconDocs)

  const passingSink = {
    $type: 'com.example.kitchenSink',
    object: {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      integer: 123,
      string: 'string',
    },
    array: ['one', 'two'],
    boolean: true,
    integer: 123,
    string: 'string',
    bytes: new Uint8Array([0, 1, 2, 3]),
    cidLink: CID.parse(
      'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    ),
  }

  it('Passes valid schemas', () => {
    lex.assertValidRecord('com.example.kitchenSink', passingSink)
  })

  it('Fails invalid input types', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', undefined),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', 1234),
    ).toThrow('Record must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', 'string'),
    ).toThrow('Record must be an object')
  })

  it('Fails incorrect $type', () => {
    expect(() => lex.assertValidRecord('com.example.kitchenSink', {})).toThrow(
      'Record/$type must be a string',
    )
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', { $type: 'foo' }),
    ).toThrow('Invalid $type: must be lex:com.example.kitchenSink, got foo')
  })

  it('Fails missing required', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        $type: 'com.example.kitchenSink',
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
        datetime: new Date().toISOString(),
        atUri: 'at://did:web:example.com/com.example.test/self',
        did: 'did:web:example.com',
        cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        bytes: new Uint8Array([0, 1, 2, 3]),
        cidLink: CID.parse(
          'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
        ),
      }),
    ).toThrow('Record must have the property "object"')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        object: undefined,
      }),
    ).toThrow('Record must have the property "object"')
  })

  it('Fails incorrect types', () => {
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        object: {
          ...passingSink.object,
          object: { boolean: '1234' },
        },
      }),
    ).toThrow('Record/object/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        object: true,
      }),
    ).toThrow('Record/object must be an object')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        array: 1234,
      }),
    ).toThrow('Record/array must be an array')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        integer: true,
      }),
    ).toThrow('Record/integer must be an integer')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        string: {},
      }),
    ).toThrow('Record/string must be a string')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        bytes: 1234,
      }),
    ).toThrow('Record/bytes must be a byte array')
    expect(() =>
      lex.assertValidRecord('com.example.kitchenSink', {
        ...passingSink,
        cidLink: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      }),
    ).toThrow('Record/cidLink must be a CID')
  })

  it('Handles optional properties correctly', () => {
    lex.assertValidRecord('com.example.optional', {
      $type: 'com.example.optional',
    })
  })

  it('Handles default properties correctly', () => {
    const result = lex.assertValidRecord('com.example.default', {
      $type: 'com.example.default',
      object: {},
    })
    expect(result).toEqual({
      $type: 'com.example.default',
      boolean: false,
      integer: 0,
      string: '',
      object: {
        boolean: true,
        integer: 1,
        string: 'x',
      },
    })
    expect(result).not.toHaveProperty('datetime')
  })

  it('Handles unions correctly', () => {
    lex.assertValidRecord('com.example.union', {
      $type: 'com.example.union',
      unionOpen: {
        $type: 'com.example.kitchenSink#object',
        object: { boolean: true },
        array: ['one', 'two'],
        boolean: true,
        integer: 123,
        string: 'string',
      },
      unionClosed: {
        $type: 'com.example.kitchenSink#subobject',
        boolean: true,
      },
    })
    lex.assertValidRecord('com.example.union', {
      $type: 'com.example.union',
      unionOpen: {
        $type: 'com.example.other',
      },
      unionClosed: {
        $type: 'com.example.kitchenSink#subobject',
        boolean: true,
      },
    })
    expect(() =>
      lex.assertValidRecord('com.example.union', {
        $type: 'com.example.union',
        unionOpen: {},
        unionClosed: {},
      }),
    ).toThrow(
      'Record/unionOpen must be an object which includes the "$type" property',
    )
    expect(() =>
      lex.assertValidRecord('com.example.union', {
        $type: 'com.example.union',
        unionOpen: {
          $type: 'com.example.other',
        },
        unionClosed: {
          $type: 'com.example.other',
          boolean: true,
        },
      }),
    ).toThrow(
      'Record/unionClosed $type must be one of lex:com.example.kitchenSink#object, lex:com.example.kitchenSink#subobject',
    )
  })

  it('Handles unknowns correctly', () => {
    lex.assertValidRecord('com.example.unknown', {
      $type: 'com.example.unknown',
      unknown: { foo: 'bar' },
    })
    expect(() =>
      lex.assertValidRecord('com.example.unknown', {
        $type: 'com.example.unknown',
      }),
    ).toThrow('Record must have the property "unknown"')
  })

  it('Applies array length constraints', () => {
    lex.assertValidRecord('com.example.arrayLength', {
      $type: 'com.example.arrayLength',
      array: [1, 2, 3],
    })
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1],
      }),
    ).toThrow('Record/array must not have fewer than 2 elements')
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, 2, 3, 4, 5],
      }),
    ).toThrow('Record/array must not have more than 4 elements')
  })

  it('Applies array item constraints', () => {
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, '2', 3],
      }),
    ).toThrow('Record/array/1 must be an integer')
    expect(() =>
      lex.assertValidRecord('com.example.arrayLength', {
        $type: 'com.example.arrayLength',
        array: [1, undefined, 3],
      }),
    ).toThrow('Record/array/1 must be an integer')
  })

  it('Applies boolean const constraint', () => {
    lex.assertValidRecord('com.example.boolConst', {
      $type: 'com.example.boolConst',
      boolean: false,
    })
    expect(() =>
      lex.assertValidRecord('com.example.boolConst', {
        $type: 'com.example.boolConst',
        boolean: true,
      }),
    ).toThrow('Record/boolean must be false')
  })

  it('Applies integer range constraint', () => {
    lex.assertValidRecord('com.example.integerRange', {
      $type: 'com.example.integerRange',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 1,
      }),
    ).toThrow('Record/integer can not be less than 2')
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 5,
      }),
    ).toThrow('Record/integer can not be greater than 4')
  })

  it('Applies integer enum constraint', () => {
    lex.assertValidRecord('com.example.integerEnum', {
      $type: 'com.example.integerEnum',
      integer: 2,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerEnum', {
        $type: 'com.example.integerEnum',
        integer: 0,
      }),
    ).toThrow('Record/integer must be one of (1|2)')
  })

  it('Applies integer const constraint', () => {
    lex.assertValidRecord('com.example.integerConst', {
      $type: 'com.example.integerConst',
      integer: 0,
    })
    expect(() =>
      lex.assertValidRecord('com.example.integerConst', {
        $type: 'com.example.integerConst',
        integer: 1,
      }),
    ).toThrow('Record/integer must be 0')
  })

  it('Applies integer whole-number constraint', () => {
    expect(() =>
      lex.assertValidRecord('com.example.integerRange', {
        $type: 'com.example.integerRange',
        integer: 2.5,
      }),
    ).toThrow('Record/integer must be an integer')
  })

  it('Applies string length constraint', () => {
    lex.assertValidRecord('com.example.stringLength', {
      $type: 'com.example.stringLength',
      string: '123',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringLength', {
        $type: 'com.example.stringLength',
        string: '1',
      }),
    ).toThrow('Record/string must not be shorter than 2 characters')
    expect(() =>
      lex.assertValidRecord('com.example.stringLength', {
        $type: 'com.example.stringLength',
        string: '12345',
      }),
    ).toThrow('Record/string must not be longer than 4 characters')
    expect(() =>
      lex.assertValidRecord('com.example.stringLength', {
        $type: 'com.example.stringLength',
        string: '👨‍👩‍👧‍👧',
      }),
    ).toThrow('Record/string must not be longer than 4 characters')
  })

  it('Applies grapheme string length constraint', () => {
    lex.assertValidRecord('com.example.stringLengthGrapheme', {
      $type: 'com.example.stringLengthGrapheme',
      string: '12👨‍👩‍👧‍👧',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringLengthGrapheme', {
        $type: 'com.example.stringLengthGrapheme',
        string: '👨‍👩‍👧‍👧',
      }),
    ).toThrow('Record/string must not be shorter than 2 graphemes')
    expect(() =>
      lex.assertValidRecord('com.example.stringLengthGrapheme', {
        $type: 'com.example.stringLengthGrapheme',
        string: '12345',
      }),
    ).toThrow('Record/string must not be longer than 4 graphemes')
  })

  it('Applies string enum constraint', () => {
    lex.assertValidRecord('com.example.stringEnum', {
      $type: 'com.example.stringEnum',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringEnum', {
        $type: 'com.example.stringEnum',
        string: 'c',
      }),
    ).toThrow('Record/string must be one of (a|b)')
  })

  it('Applies string const constraint', () => {
    lex.assertValidRecord('com.example.stringConst', {
      $type: 'com.example.stringConst',
      string: 'a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.stringConst', {
        $type: 'com.example.stringConst',
        string: 'b',
      }),
    ).toThrow('Record/string must be a')
  })

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
      lex.assertValidRecord('com.example.datetime', {
        $type: 'com.example.datetime',
        datetime,
      })
    }
    expect(() =>
      lex.assertValidRecord('com.example.datetime', {
        $type: 'com.example.datetime',
        datetime: 'bad date',
      }),
    ).toThrow(
      'Record/datetime must be an valid atproto datetime (both RFC-3339 and ISO-8601)',
    )
  })

  it('Applies uri formatting constraint', () => {
    for (const uri of [
      'https://example.com',
      'https://example.com/with/path',
      'https://example.com/with/path?and=query',
      'at://bsky.social',
      'did:example:test',
    ]) {
      lex.assertValidRecord('com.example.uri', {
        $type: 'com.example.uri',
        uri,
      })
    }
    expect(() =>
      lex.assertValidRecord('com.example.uri', {
        $type: 'com.example.uri',
        uri: 'not a uri',
      }),
    ).toThrow('Record/uri must be a uri')
  })

  it('Applies at-uri formatting constraint', () => {
    lex.assertValidRecord('com.example.atUri', {
      $type: 'com.example.atUri',
      atUri: 'at://did:web:example.com/com.example.test/self',
    })
    expect(() =>
      lex.assertValidRecord('com.example.atUri', {
        $type: 'com.example.atUri',
        atUri: 'http://not-atproto.com',
      }),
    ).toThrow('Record/atUri must be a valid at-uri')
  })

  it('Applies did formatting constraint', () => {
    lex.assertValidRecord('com.example.did', {
      $type: 'com.example.did',
      did: 'did:web:example.com',
    })
    lex.assertValidRecord('com.example.did', {
      $type: 'com.example.did',
      did: 'did:plc:12345678abcdefghijklmnop',
    })

    expect(() =>
      lex.assertValidRecord('com.example.did', {
        $type: 'com.example.did',
        did: 'bad did',
      }),
    ).toThrow('Record/did must be a valid did')
    expect(() =>
      lex.assertValidRecord('com.example.did', {
        $type: 'com.example.did',
        did: 'did:short',
      }),
    ).toThrow('Record/did must be a valid did')
  })

  it('Applies handle formatting constraint', () => {
    lex.assertValidRecord('com.example.handle', {
      $type: 'com.example.handle',
      handle: 'test.bsky.social',
    })
    lex.assertValidRecord('com.example.handle', {
      $type: 'com.example.handle',
      handle: 'bsky.test',
    })

    expect(() =>
      lex.assertValidRecord('com.example.handle', {
        $type: 'com.example.handle',
        handle: 'bad handle',
      }),
    ).toThrow('Record/handle must be a valid handle')
    expect(() =>
      lex.assertValidRecord('com.example.handle', {
        $type: 'com.example.handle',
        handle: '-bad-.test',
      }),
    ).toThrow('Record/handle must be a valid handle')
  })

  it('Applies at-identifier formatting constraint', () => {
    lex.assertValidRecord('com.example.atIdentifier', {
      $type: 'com.example.atIdentifier',
      atIdentifier: 'bsky.test',
    })
    lex.assertValidRecord('com.example.atIdentifier', {
      $type: 'com.example.atIdentifier',
      atIdentifier: 'did:plc:12345678abcdefghijklmnop',
    })

    expect(() =>
      lex.assertValidRecord('com.example.atIdentifier', {
        $type: 'com.example.atIdentifier',
        atIdentifier: 'bad id',
      }),
    ).toThrow('Record/atIdentifier must be a valid did or a handle')
    expect(() =>
      lex.assertValidRecord('com.example.atIdentifier', {
        $type: 'com.example.atIdentifier',
        atIdentifier: '-bad-.test',
      }),
    ).toThrow('Record/atIdentifier must be a valid did or a handle')
  })

  it('Applies nsid formatting constraint', () => {
    lex.assertValidRecord('com.example.nsid', {
      $type: 'com.example.nsid',
      nsid: 'com.atproto.test',
    })
    lex.assertValidRecord('com.example.nsid', {
      $type: 'com.example.nsid',
      nsid: 'app.bsky.nested.test',
    })

    expect(() =>
      lex.assertValidRecord('com.example.nsid', {
        $type: 'com.example.nsid',
        nsid: 'bad nsid',
      }),
    ).toThrow('Record/nsid must be a valid nsid')
    expect(() =>
      lex.assertValidRecord('com.example.nsid', {
        $type: 'com.example.nsid',
        nsid: 'com.bad-.foo',
      }),
    ).toThrow('Record/nsid must be a valid nsid')
  })

  it('Applies cid formatting constraint', () => {
    lex.assertValidRecord('com.example.cid', {
      $type: 'com.example.cid',
      cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
    })
    expect(() =>
      lex.assertValidRecord('com.example.cid', {
        $type: 'com.example.cid',
        cid: 'abapsdofiuwrpoiasdfuaspdfoiu',
      }),
    ).toThrow('Record/cid must be a cid string')
  })

  it('Applies language formatting constraint', () => {
    lex.assertValidRecord('com.example.language', {
      $type: 'com.example.language',
      language: 'en-US-boont',
    })
    expect(() =>
      lex.assertValidRecord('com.example.language', {
        $type: 'com.example.language',
        language: 'not-a-language-',
      }),
    ).toThrow('Record/language must be a well-formed BCP 47 language tag')
  })

  it('Applies bytes length constraints', () => {
    lex.assertValidRecord('com.example.byteLength', {
      $type: 'com.example.byteLength',
      bytes: new Uint8Array([1, 2, 3]),
    })
    expect(() =>
      lex.assertValidRecord('com.example.byteLength', {
        $type: 'com.example.byteLength',
        bytes: new Uint8Array([1]),
      }),
    ).toThrow('Record/bytes must not be smaller than 2 bytes')
    expect(() =>
      lex.assertValidRecord('com.example.byteLength', {
        $type: 'com.example.byteLength',
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
      }),
    ).toThrow('Record/bytes must not be larger than 4 bytes')
  })
})

describe('XRPC parameter validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid parameters', () => {
    const queryResult = lex.assertValidXrpcParams('com.example.query', {
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
    })
    expect(queryResult).toEqual({
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
      def: 0,
    })
    const paramResult = lex.assertValidXrpcParams('com.example.procedure', {
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
      def: 1,
    })
    expect(paramResult).toEqual({
      boolean: true,
      integer: 123,
      string: 'string',
      array: ['x', 'y'],
      def: 1,
    })
  })

  it('Handles required correctly', () => {
    lex.assertValidXrpcParams('com.example.query', {
      boolean: true,
      integer: 123,
    })
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
      }),
    ).toThrow('Params must have the property "integer"')
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
        integer: undefined,
      }),
    ).toThrow('Params must have the property "integer"')
  })

  it('Validates parameter types', () => {
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: 'string',
        integer: 123,
        string: 'string',
      }),
    ).toThrow('boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcParams('com.example.query', {
        boolean: true,
        float: 123.45,
        integer: 123,
        string: 'string',
        array: 'x',
      }),
    ).toThrow('array must be an array')
  })
})

describe('XRPC input validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid inputs', () => {
    lex.assertValidXrpcInput('com.example.procedure', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      float: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Validates the input', () => {
    // dont need to check this extensively since it's the same logic as tested in record validation
    expect(() =>
      lex.assertValidXrpcInput('com.example.procedure', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        float: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Input/object/boolean must be a boolean')
    expect(() => lex.assertValidXrpcInput('com.example.procedure', {})).toThrow(
      'Input must have the property "object"',
    )
  })
})

describe('XRPC output validation', () => {
  const lex = new Lexicons(LexiconDocs)

  it('Passes valid outputs', () => {
    lex.assertValidXrpcOutput('com.example.query', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      float: 123.45,
      integer: 123,
      string: 'string',
    })
    lex.assertValidXrpcOutput('com.example.procedure', {
      object: { boolean: true },
      array: ['one', 'two'],
      boolean: true,
      float: 123.45,
      integer: 123,
      string: 'string',
    })
  })

  it('Validates the output', () => {
    // dont need to check this extensively since it's the same logic as tested in record validation
    expect(() =>
      lex.assertValidXrpcOutput('com.example.query', {
        object: { boolean: 'string' },
        array: ['one', 'two'],
        boolean: true,
        float: 123.45,
        integer: 123,
        string: 'string',
      }),
    ).toThrow('Output/object/boolean must be a boolean')
    expect(() =>
      lex.assertValidXrpcOutput('com.example.procedure', {}),
    ).toThrow('Output must have the property "object"')
  })
})
