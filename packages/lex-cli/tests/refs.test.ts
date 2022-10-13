import { Schema } from '@adxp/lexicon'
import { resolveAllRefs } from '../src/refs'

describe('Reference resolution', () => {
  it('Correctly resolves references within itself', () => {
    const obj = {
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: '#/$defs/subject' },
        },
      },
      $defs: {
        subject: { type: 'string' },
      },
    }
    resolveAllRefs([obj] as Schema[])
    expect(obj).toEqual({
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: {
            $ref: '#/$defs/appBskyLikeSubject',
          },
        },
        $defs: {
          appBskyLikeSubject: {
            type: 'string',
          },
        },
      },
      $defs: {
        subject: {
          type: 'string',
        },
      },
    })
  })
  it('Correctly resolves cascading references', () => {
    const obj = {
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: '#/$defs/subjectArr' },
        },
      },
      $defs: {
        subjectArr: {
          type: 'array',
          items: { type: { $ref: '#/$defs/subject' } },
        },
        subject: {
          type: 'string',
        },
      },
    }
    resolveAllRefs([obj] as Schema[])
    expect(obj).toEqual({
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: {
            $ref: '#/$defs/appBskyLikeSubjectArr',
          },
        },
        $defs: {
          appBskyLikeSubjectArr: {
            type: 'array',
            items: { type: { $ref: '#/$defs/appBskyLikeSubject' } },
          },
          appBskyLikeSubject: {
            type: 'string',
          },
        },
      },
      $defs: {
        subjectArr: {
          type: 'array',
          items: { type: { $ref: '#/$defs/appBskyLikeSubject' } },
        },
        subject: {
          type: 'string',
        },
      },
    })
  })
  it('Correctly resolves references to other lexicons', () => {
    const obj = {
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: '#/$defs/subject' },
          otherSubject: { $ref: 'lex:app.bsky.repost#/$defs/subject' },
          displayName: { $ref: 'lex:app.bsky.profile#/$defs/displayName' },
        },
      },
      $defs: {
        subject: { type: 'string' },
      },
    }
    const obj2 = {
      lexicon: 1,
      id: 'app.bsky.repost',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: '#/$defs/subject' },
        },
      },
      $defs: {
        subject: { type: 'string' },
      },
    }
    const obj3 = {
      lexicon: 1,
      id: 'app.bsky.profile',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          displayName: { $ref: '#/$defs/displayName' },
        },
      },
      $defs: {
        displayName: { type: 'string' },
      },
    }
    resolveAllRefs([obj, obj2, obj3] as Schema[])
    expect(obj).toEqual({
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: {
            $ref: '#/$defs/appBskyLikeSubject',
          },
          otherSubject: {
            $ref: '#/$defs/appBskyRepostSubject',
          },
          displayName: {
            $ref: '#/$defs/appBskyProfileDisplayName',
          },
        },
        $defs: {
          appBskyLikeSubject: {
            type: 'string',
          },
          appBskyRepostSubject: {
            type: 'string',
          },
          appBskyProfileDisplayName: {
            type: 'string',
          },
        },
      },
      $defs: {
        subject: {
          type: 'string',
        },
      },
    })
  })
  it('Throws on an invalid reference', () => {
    const obj = {
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: '#/$defs/bad' },
        },
      },
      $defs: {
        subject: { type: 'string' },
      },
    }
    expect(() => resolveAllRefs([obj] as Schema[])).toThrow()
  })
  it('Throws on a schema not found', () => {
    const obj = {
      lexicon: 1,
      id: 'app.bsky.like',
      type: 'record',
      record: {
        type: 'object',
        properties: {
          subject: { $ref: 'lex:com.foo.bar#/$defs/bad' },
        },
      },
      $defs: {
        subject: { type: 'string' },
      },
    }
    expect(() => resolveAllRefs([obj] as Schema[])).toThrow()
  })
})
