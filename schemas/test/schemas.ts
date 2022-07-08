import test from 'ava'
import {
  AdxSchemas,
  AdxSchemaDefinitionMalformedError,
  SchemaNotFoundError,
  WrongSchemaTypeError,
  AdxValidationError,
} from '../src/index.js'
import FeedViewSchema from './_scaffolds/schemas/feed-view.js'
import ZeetSchema from './_scaffolds/schemas/zeet.js'
import ZeetRev2Schema from './_scaffolds/schemas/zeet-rev2.js'
import PollSchema from './_scaffolds/schemas/poll.js'

test('Create schema collections and validators', (t) => {
  const s = new AdxSchemas()
  s.add(FeedViewSchema)
  s.add(ZeetSchema)
  t.throws(() => s.add(ZeetRev2Schema))
  s.add(PollSchema)
  t.is(s.schemas.size, 6) // 2 for each because we register twice under name and id

  {
    const v = s.createRecordValidator('Zeet')
    t.is(v.type.length, 1)
    t.is(v.ext.length, 0)
  }
  {
    const v = s.createRecordValidator('blueskyweb.xyz:Zeet')
    t.is(v.type.length, 1)
    t.is(v.ext.length, 0)
  }
  {
    const v = s.createRecordValidator({
      type: 'Zeet',
      ext: 'Poll',
    })
    t.is(v.type.length, 1)
    t.is(v.ext.length, 1)
  }

  t.throws(() => s.createRecordValidator('FeedView'), {
    instanceOf: WrongSchemaTypeError,
    message: 'Schema "blueskyweb.xyz:FeedView" does not validate adxs-record',
  })
  t.throws(() => s.createRecordValidator('Foo'), {
    instanceOf: SchemaNotFoundError,
    message: 'Schema not found: Foo',
  })
  s.remove('Zeet')
  t.throws(() => s.createRecordValidator('Zeet'), {
    instanceOf: SchemaNotFoundError,
    message: 'Schema not found: Zeet',
  })
  t.throws(() => s.createRecordValidator('blueskyweb.xyz:Zeet'), {
    instanceOf: SchemaNotFoundError,
    message: 'Schema not found: blueskyweb.xyz:Zeet',
  })
})

test('Validates schemas', (t) => {
  const s = new AdxSchemas()
  t.throws(() => s.add({}), {
    instanceOf: AdxSchemaDefinitionMalformedError,
    message: 'Failed to parse schema definition',
  })
  t.throws(() => s.add({ $type: 'wrong' }), {
    instanceOf: AdxSchemaDefinitionMalformedError,
    message: 'Failed to parse schema definition',
  })
  t.throws(() => s.add({ $type: 'adxs-record' }), {
    instanceOf: AdxSchemaDefinitionMalformedError,
    message: 'Failed to parse schema definition',
  })
  t.throws(
    () =>
      s.add({
        $type: 'adxs-record',
        author: 'blueskyweb.xyz',
        name: 'Test',
        schema: 'wrong',
      }),
    {
      instanceOf: AdxSchemaDefinitionMalformedError,
      message:
        'The "blueskyweb.xyz:Test" .schema failed to compile: The base .type must be an "object"',
    },
  )
  t.throws(
    () =>
      s.add({
        $type: 'adxs-record',
        author: 'blueskyweb.xyz',
        name: 'Test',
        schema: {
          type: 'array',
        },
      }),
    {
      instanceOf: AdxSchemaDefinitionMalformedError,
      message:
        'The "blueskyweb.xyz:Test" .schema failed to compile: The base .type must be an "object"',
    },
  )
  t.throws(
    () =>
      s.add({
        $type: 'adxs-record',
        author: 'blueskyweb.xyz',
        name: 'Test',
        schema: {
          type: 'object',
          unsupportedField: 'ohno',
        },
      }),
    {
      instanceOf: AdxSchemaDefinitionMalformedError,
      message:
        'The "blueskyweb.xyz:Test" .schema failed to compile: strict mode: unknown keyword: "unsupportedField"',
    },
  )
})

test('Validates record types', (t) => {
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
    }
    {
      // valid w/extra field
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
        extraField: 'foo',
        createdAt: new Date().toISOString(),
      })
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
    }
    {
      // invalid - missing createdAt
      const res = v.validate({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
      })
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.is(
        res.error,
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
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.is(
        res.error,
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
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.truthy(res.incompatible)
      t.is(res.error, 'Record type blueskyweb.xyz:Invalid is not supported')
    }
  }
})

test('Validates extension types', (t) => {
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
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
      t.truthy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
      t.is(
        res.fallbacks[0],
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
      t.truthy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
      t.is(res.fallbacks.length, 0)
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
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.is(
        res.error,
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
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.truthy(res.incompatible)
      t.is(res.error, 'Record extension other.org:Poll is not supported')
    }
  }
})

test('Validates views', (t) => {
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
    }
    {
      // invalid - missing feed
      const res = v.validateResponse({})
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.is(
        res.error,
        `Failed blueskyweb.xyz:FeedView validation for #/required: must have required property 'feed'`,
      )
    }
    {
      // invalid - wrong type for feed
      const res = v.validateResponse({
        feed: true,
      })
      t.falsy(res.valid)
      t.falsy(res.fullySupported)
      t.falsy(res.incompatible)
      t.is(
        res.error,
        `Failed blueskyweb.xyz:FeedView validation for #/properties/feed/type: must be array`,
      )
    }
  }
})

test('isValid()', (t) => {
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
      t.truthy(res)
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
      t.truthy(res)
    }
    {
      // invalid - missing createdAt
      const res = v.isValid({
        $type: 'blueskyweb.xyz:Zeet',
        text: 'Hello, world!',
      })
      t.falsy(res)
    }
  }
})

test('assertValid()', (t) => {
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
      t.truthy(res.valid)
      t.truthy(res.fullySupported)
      t.falsy(res.incompatible)
      t.falsy(res.error)
    }
    {
      // invalid - missing createdAt
      t.throws(
        () =>
          v.assertValid({
            $type: 'blueskyweb.xyz:Zeet',
            text: 'Hello, world!',
          }),
        {
          instanceOf: AdxValidationError,
          message: `Failed blueskyweb.xyz:Zeet validation for #/required: must have required property 'createdAt'`,
        },
      )
    }
  }
})

test('Fallback localization', (t) => {
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
    t.is(
      res.fallbacks[0],
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
    t.is(
      res.fallbacks[0],
      'Este zeet incluye una encuesta que esta aplicación no admite.',
    )
  }
})
