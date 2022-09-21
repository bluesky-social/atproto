import {
  RecordSchemas,
  RecordSchemaMalformedError,
  SchemaNotFoundError,
  ValidationError,
} from '../src/index'
import ZeetSchema from './_scaffolds/schemas/zeet'
import ZeetRev2Schema from './_scaffolds/schemas/zeet-rev2'
import PollSchema from './_scaffolds/schemas/poll'

describe('Create schema collections and validators', () => {
  const s = new RecordSchemas()

  it('Adds schemas', () => {
    s.add(ZeetSchema)
    expect(() => s.add(ZeetRev2Schema)).toThrow()
    s.add(PollSchema)
    expect(s.schemas.size).toBe(2)
  })

  it('Creates record simple validators', () => {
    const v = s.createRecordValidator('com.example.zeet')
    expect(v.type.length).toBe(1)
    expect(v.ext.length).toBe(0)
  })
  it('Creates complex record validators', () => {
    const v = s.createRecordValidator({
      type: 'com.example.zeet',
      ext: 'com.example.poll',
    })
    expect(v.type.length).toBe(1)
    expect(v.ext.length).toBe(1)
  })

  it('Throws for invalid conditions', () => {
    expect(() => s.createRecordValidator('foo')).toThrow(SchemaNotFoundError)
    s.remove('com.example.zeet')
    expect(() => s.createRecordValidator('com.example.zeet')).toThrow(
      SchemaNotFoundError,
    )
  })
})

describe('Validates schemas', () => {
  const s = new RecordSchemas()
  expect(() => s.add({})).toThrow(RecordSchemaMalformedError)
  expect(() => s.add({ adx: 1 })).toThrow(RecordSchemaMalformedError)
  expect(() => s.add({ adx: 1, id: 'bad-nsid' })).toThrow(
    RecordSchemaMalformedError,
  )
  expect(() =>
    s.add({
      adx: 1,
      id: 'com.example.test',
      record: 'wrong',
    }),
  ).toThrow(RecordSchemaMalformedError)
  expect(() =>
    s.add({
      adx: 1,
      id: 'com.example.test',
      record: {
        type: 'array',
      },
    }),
  ).toThrow(RecordSchemaMalformedError)
  expect(() =>
    s.add({
      adx: 1,
      id: 'com.example.test',
      record: {
        type: 'object',
        unsupportedField: 'ohno',
      },
    }),
  ).toThrow(RecordSchemaMalformedError)
})

describe('Validates record types', () => {
  const s = new RecordSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'com.example.zeet' })
    {
      // valid
      const res = v.validate({
        $type: 'com.example.zeet',
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
        $type: 'com.example.zeet',
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
        $type: 'com.example.zeet',
        text: 'Hello, world!',
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed com.example.zeet validation for #/required: must have required property 'createdAt'`,
      )
    }
    {
      // invalid - wrong type for createdAt
      const res = v.validate({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: 1234,
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        `Failed com.example.zeet validation for #/properties/createdAt/type: must be string`,
      )
    }
    {
      // invalid - unknown type
      const res = v.validate({
        $type: 'com.example.invalid',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeFalsy()
      expect(res.error).toBe('Record type com.example.invalid is not supported')
    }
  }
})

describe('Validates extension types', () => {
  const s = new RecordSchemas()
  s.add(ZeetSchema)
  s.add(PollSchema)

  {
    const v = s.createRecordValidator({
      type: 'com.example.zeet',
      ext: 'com.example.poll',
    })
    {
      // valid
      const res = v.validate({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'com.example.poll': {
            $required: true,
            $fallback:
              'This zeet includes a poll which this application does not support.',
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
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'com.example.poll': {
            $required: true,
            $fallback:
              'This zeet includes a poll which this application does not support.',
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
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'org.other.poll': {
            $required: false,
            $fallback:
              'This zeet includes a poll which this application does not support.',
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
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'org.other.poll': {
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
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'com.example.poll': {
            $required: true,
            $fallback:
              'This zeet includes a poll which this application does not support.',
            question: "Do you like ADX's schemas system?",
          },
        },
      })
      expect(res.valid).toBeFalsy()
      expect(res.fullySupported).toBeFalsy()
      expect(res.compatible).toBeTruthy()
      expect(res.error).toBe(
        "Failed com.example.poll validation for #/required: must have required property 'answers'",
      )
    }
    {
      // unsupported
      const res = v.validate({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        $ext: {
          'org.other.poll': {
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
      expect(res.error).toBe('Record extension org.other.poll is not supported')
    }
  }
})

describe('isValid()', () => {
  const s = new RecordSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'com.example.zeet' })
    {
      // valid
      const res = v.isValid({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
      })
      expect(res).toBeTruthy()
    }
    {
      // valid w/partial support
      const res = v.isValid({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
        createdAt: new Date().toISOString(),
        'com.example.poll': {
          $required: false,
          $fallback:
            'This zeet includes a poll which this application does not support.',
          question: "Do you like ADX's schemas system?",
          answers: ['yes', 'no', 'eh'],
        },
      })
      expect(res).toBeTruthy()
    }
    {
      // invalid - missing createdAt
      const res = v.isValid({
        $type: 'com.example.zeet',
        text: 'Hello, world!',
      })
      expect(res).toBeFalsy()
    }
  }
})

describe('assertValid()', () => {
  const s = new RecordSchemas()
  s.add(ZeetSchema)

  {
    const v = s.createRecordValidator({ type: 'com.example.zeet' })
    {
      // valid
      const res = v.assertValid({
        $type: 'com.example.zeet',
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
          $type: 'com.example.zeet',
          text: 'Hello, world!',
        }),
      ).toThrow(ValidationError)
    }
  }
})
