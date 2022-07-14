import {
  AdxSchemas,
  AdxSchemaDefinitionMalformedError,
  SchemaNotFoundError,
  WrongSchemaTypeError,
  AdxValidationError,
} from '../src/index'
import FeedViewSchema from './_scaffolds/schemas/feed-view'
import ZeetSchema from './_scaffolds/schemas/zeet'
import ZeetRev2Schema from './_scaffolds/schemas/zeet-rev2'
import PollSchema from './_scaffolds/schemas/poll'

describe('Create schema collections and validators', () => {
  const s = new AdxSchemas()

  it('Adds schemas', () => {
    s.add(FeedViewSchema)
    s.add(ZeetSchema)
    expect(() => s.add(ZeetRev2Schema)).toThrow()
    s.add(PollSchema)
    expect(s.schemas.size).toBe(6) // 2 for each because we register twice under name and id
  })

  it('Creates record validators by shortnames', () => {
    const v = s.createRecordValidator('Zeet')
    expect(v.type.length).toBe(1)
    expect(v.ext.length).toBe(0)
  })
  it('Creates record validators by longnames', () => {
    const v = s.createRecordValidator('blueskyweb.xyz:Zeet')
    expect(v.type.length).toBe(1)
    expect(v.ext.length).toBe(0)
  })
  it('Creates complex record validators', () => {
    const v = s.createRecordValidator({
      type: 'Zeet',
      ext: 'Poll',
    })
    expect(v.type.length).toBe(1)
    expect(v.ext.length).toBe(1)
  })

  it('Throws for invalid conditions', () => {
    expect(() => s.createRecordValidator('FeedView')).toThrow(
      WrongSchemaTypeError,
    )
    expect(() => s.createRecordValidator('Foo')).toThrow(SchemaNotFoundError)
    s.remove('Zeet')
    expect(() => s.createRecordValidator('Zeet')).toThrow(SchemaNotFoundError)
    expect(() => s.createRecordValidator('blueskyweb.xyz:Zeet')).toThrow(
      SchemaNotFoundError,
    )
  })
})

describe('Validates schemas', () => {
  const s = new AdxSchemas()
  expect(() => s.add({})).toThrow(AdxSchemaDefinitionMalformedError)
  expect(() => s.add({ $type: 'wrong' })).toThrow(
    AdxSchemaDefinitionMalformedError,
  )
  expect(() => s.add({ $type: 'adxs-record' })).toThrow(
    AdxSchemaDefinitionMalformedError,
  )
  expect(() =>
    s.add({
      $type: 'adxs-record',
      author: 'blueskyweb.xyz',
      name: 'Test',
      schema: 'wrong',
    }),
  ).toThrow(AdxSchemaDefinitionMalformedError)
  expect(() =>
    s.add({
      $type: 'adxs-record',
      author: 'blueskyweb.xyz',
      name: 'Test',
      schema: {
        type: 'array',
      },
    }),
  ).toThrow(AdxSchemaDefinitionMalformedError)
  expect(() =>
    s.add({
      $type: 'adxs-record',
      author: 'blueskyweb.xyz',
      name: 'Test',
      schema: {
        type: 'object',
        unsupportedField: 'ohno',
      },
    }),
  ).toThrow(AdxSchemaDefinitionMalformedError)
})

describe('Validates record types', () => {
  const s = new AdxSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'Zeet' })
    {
      // valid
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // valid w/extra field
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        extraField: 'foo',
        createdAt: new Date().toISOString(),
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // invalid - missing createdAt
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed blueskyweb.xyz:Zeet validation for #/required: must have required property 'createdAt'`,
      )
    }
    {
      // invalid - wrong type for createdAt
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: 1234,
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed blueskyweb.xyz:Zeet validation for #/properties/createdAt/type: must be string`,
      )
    }
    {
      // invalid - unknown type
      const res = v.validate({
        $type: 'blueskyweb.xyz:Invalid',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeFalsy()
      expect(res.error).toBe(
        'Record type blueskyweb.xyz:Invalid is not supported',
      )
    }
  }
})

describe('Validates extension types', () => {
  const s = new AdxSchemas()
  s.add(ZeetSchema)
  s.add(PollSchema)

  {
    const v = s.createRecordValidator({ type: 'Zeet', ext: 'Poll' })
    {
      // valid
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'blueskyweb.xyz:Poll': {
            $required: true,
            $fallback: {
              'en-US':
                'This zeet includes a poll which this application does not support.',
            },
            question: "Do you like ADX's schemas system?",
            answers: ['yes', 'no', 'eh'],
          },
        },
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // valid w/extra field
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'blueskyweb.xyz:Poll': {
            $required: true,
            $fallback: {
              'en-US':
                'This zeet includes a poll which this application does not support.',
            },
            question: "Do you like ADX's schemas system?",
            answers: ['yes', 'no', 'eh'],
            extraField: 'foo',
          },
        },
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // valid but partial support
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'other.org:Poll': {
            $required: false,
            $fallback: {
              'en-US':
                'This zeet includes a poll which this application does not support.',
            },
            question: "Do you like ADX's schemas system?",
            answers: ['yes', 'no', 'eh'],
          },
        },
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
      expect(res.fallbacks[0]).toBe(
        'This zeet includes a poll which this application does not support.',
      )
    }
    {
      // valid but partial support, no fallback provided
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'other.org:Poll': {
            $required: false,
            question: "Do you like ADX's schemas system?",
            answers: ['yes', 'no', 'eh'],
          },
        },
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
      expect(res.fallbacks.length).toBe(0)
    }
    {
      // invalid - extension object is missing answers
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'blueskyweb.xyz:Poll': {
            $required: true,
            $fallback: {
              'en-US':
                'This zeet includes a poll which this application does not support.',
            },
            question: "Do you like ADX's schemas system?",
          },
        },
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        "Failed blueskyweb.xyz:Poll validation for #/required: must have required property 'answers'",
      )
    }
    {
      // unsupported
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'other.org:Poll': {
            $required: true,
            $fallback: {
              'en-US':
                'This zeet includes a poll which this application does not support.',
            },
            question: "Do you like ADX's schemas system?",
            answers: ['yes', 'no', 'eh'],
          },
        },
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeFalsy()
      expect(res.error).toBe('Record extension other.org:Poll is not supported')
    }
  }
})

describe('Validates views', () => {
  const s = new AdxSchemas()
  s.add(FeedViewSchema)

  {
    const v = s.createViewValidator('FeedView')
    {
      // valid
      const res = v.validateResponse({
        feed: [
          {
            uri: 'adx://bob.com/blueskyweb.xyz:Feed/123',
            author: {
              username: 'bob.com',
              displayName: 'Bob',
            },
            zeet: {
              $type: 'blueskyweb.xyz:Zeet',
              text: 'Hello, world!',
              createdAt: new Date().toISOString(),
            },
            replyCount: 0,
            likeCount: 0,
            indexedAt: new Date().toISOString(),
          },
        ],
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // valid w/extra field
      const res = v.validateResponse({
        extra: true,
        feed: [
          {
            uri: 'adx://bob.com/blueskyweb.xyz:Feed/123',
            author: {
              username: 'bob.com',
              displayName: 'Bob',
            },
            zeet: {
              $type: 'blueskyweb.xyz:Zeet',
              text: 'Hello, world!',
              createdAt: new Date().toISOString(),
            },
            replyCount: 0,
            likeCount: 0,
            indexedAt: new Date().toISOString(),
          },
        ],
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // invalid - missing feed
      const res = v.validateResponse({})
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed blueskyweb.xyz:FeedView validation for #/required: must have required property 'feed'`,
      )
    }
    {
      // invalid - wrong type for feed
      const res = v.validateResponse({
        feed: true,
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed blueskyweb.xyz:FeedView validation for #/properties/feed/type: must be array`,
      )
    }
  }
})

describe('isValid()', () => {
  const s = new AdxSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'Zeet' })
    {
      // valid
      const res = v.isValid({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res).toBeTruthy()
    }
    {
      // valid w/partial support
      const res = v.isValid({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        'blueskyweb.xyz:Poll': {
          $required: false,
          $fallback: {
            'en-US':
              'This zeet includes a poll which this application does not support.',
          },
          question: "Do you like ADX's schemas system?",
          answers: ['yes', 'no', 'eh'],
        },
      })
      expect(res).toBeTruthy()
    }
    {
      // invalid - missing createdAt
      const res = v.isValid({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
      })
      expect(res).toBeFalsy()
    }
  }
})

describe('assertValid()', () => {
  const s = new AdxSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'Zeet' })
    {
      // valid
      const res = v.assertValid({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res.valid).toBeTruthy()
      expect(res.fullySupported).toBeTruthy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBeFalsy()
    }
    {
      // invalid - missing createdAt
      expect(() =>
        v.assertValid({
          $type: 'blueskyweb.xyz:Zeet',
          text: 'Hello, world!',
        }),
      ).toThrow(AdxValidationError)
    }
  }
})

describe('Fallback localization', () => {
  const s = new AdxSchemas()
  s.add(ZeetSchema)
  s.add(PollSchema)

  {
    s.locale = 'en'
    const v = s.createRecordValidator({ type: 'Zeet', ext: 'Poll' })
    const res = v.validate({
      $type: 'blueskyweb.xyz:Zeet',
      text: 'Hello, world!',
      createdAt: new Date().toISOString(),
      $ext: {
        'other.org:Poll': {
          $required: false,
          $fallback: {
            'en-US':
              'This zeet includes a poll which this application does not support.',
            es: 'Este zeet incluye una encuesta que esta aplicación no admite.',
          },
          question: "Do you like ADX's schemas system?",
          answers: ['yes', 'no', 'eh'],
        },
      },
    })
    expect(res.fallbacks[0]).toBe(
      'This zeet includes a poll which this application does not support.',
    )
  }

  {
    s.locale = 'es'
    const v = s.createRecordValidator({ type: 'Zeet', ext: 'Poll' })
    const res = v.validate({
      $type: 'blueskyweb.xyz:Zeet',
      text: 'Hello, world!',
      createdAt: new Date().toISOString(),
      $ext: {
        'other.org:Poll': {
          $required: false,
          $fallback: {
            'en-US':
              'This zeet includes a poll which this application does not support.',
            es: 'Este zeet incluye una encuesta que esta aplicación no admite.',
          },
          question: "Do you like ADX's schemas system?",
          answers: ['yes', 'no', 'eh'],
        },
      },
    })
    expect(res.fallbacks[0]).toBe(
      'Este zeet incluye una encuesta que esta aplicación no admite.',
    )
  }
})
