/**
* GENERATED CODE - DO NOT MODIFY
*/
import { LexiconDoc } from '@atproto/lexicon'

export const lexicons: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'com.atproto.account.create',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an account.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle', 'email', 'password'],
            properties: {
              email: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              inviteCode: {
                type: 'string',
              },
              password: {
                type: 'string',
              },
              recoveryKey: {
                type: 'string',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['accessJwt', 'refreshJwt', 'handle', 'did'],
            properties: {
              accessJwt: {
                type: 'string',
              },
              refreshJwt: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidHandle',
          },
          {
            name: 'InvalidPassword',
          },
          {
            name: 'InvalidInviteCode',
          },
          {
            name: 'HandleNotAvailable',
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.account.createInviteCode',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an invite code.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['useCount'],
            properties: {
              useCount: {
                type: 'integer',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['code'],
            properties: {
              code: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.account.delete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete an account.',
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.account.get',
    defs: {
      main: {
        type: 'query',
        description: 'Get information about an account.',
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.account.requestPasswordReset',
    defs: {
      main: {
        type: 'procedure',
        description: 'Initiate a user account password reset via email.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['email'],
            properties: {
              email: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.account.resetPassword',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reset a user account password using a token.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['token', 'password'],
            properties: {
              token: {
                type: 'string',
              },
              password: {
                type: 'string',
              },
            },
          },
        },
        errors: [
          {
            name: 'ExpiredToken',
          },
          {
            name: 'InvalidToken',
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.handle.resolve',
    defs: {
      main: {
        type: 'query',
        description: 'Provides the DID of a repo.',
        parameters: {
          handle: {
            type: 'string',
            description:
              "The handle to resolve. If not supplied, will resolve the host's own handle.",
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did'],
            properties: {
              did: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.batchWrite',
    defs: {
      main: {
        type: 'procedure',
        description: 'Apply a batch transaction of creates, puts, and deletes.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'writes'],
            properties: {
              did: {
                type: 'string',
                description: 'The DID of the repo.',
              },
              validate: {
                type: 'boolean',
                default: true,
                description: 'Validate the records?',
              },
              writes: {
                type: 'array',
                items: ['#create', '#update', '#delete'],
              },
            },
          },
        },
      },
      create: {
        type: 'object',
        required: ['action', 'collection', 'value'],
        properties: {
          action: {
            type: 'string',
            const: 'create',
          },
          collection: {
            type: 'string',
          },
          rkey: {
            type: 'string',
          },
          value: {
            type: 'unknown',
          },
        },
      },
      update: {
        type: 'object',
        required: ['action', 'collection', 'rkey', 'value'],
        properties: {
          action: {
            type: 'string',
            const: 'update',
          },
          collection: {
            type: 'string',
          },
          rkey: {
            type: 'string',
          },
          value: {
            type: 'unknown',
          },
        },
      },
      delete: {
        type: 'object',
        required: ['action', 'collection', 'rkey'],
        properties: {
          action: {
            type: 'string',
            const: 'delete',
          },
          collection: {
            type: 'string',
          },
          rkey: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.createRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create a new record.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'collection', 'record'],
            properties: {
              did: {
                type: 'string',
                description: 'The DID of the repo.',
              },
              collection: {
                type: 'string',
                description: 'The NSID of the record collection.',
              },
              validate: {
                type: 'boolean',
                default: true,
                description: 'Validate the record?',
              },
              record: {
                type: 'unknown',
                description: 'The record to create.',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete a record.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'collection', 'rkey'],
            properties: {
              did: {
                type: 'string',
                description: 'The DID of the repo.',
              },
              collection: {
                type: 'string',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                description: 'The key of the record.',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.describe',
    defs: {
      main: {
        type: 'query',
        description:
          'Get information about the repo, including the list of collections.',
        parameters: {
          user: {
            type: 'string',
            description: 'The handle or DID of the repo.',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'handle',
              'did',
              'didDoc',
              'collections',
              'handleIsCorrect',
            ],
            properties: {
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
              didDoc: {
                type: 'unknown',
              },
              collections: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              handleIsCorrect: {
                type: 'boolean',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'Fetch a record.',
        parameters: {
          user: {
            type: 'string',
            description: 'The handle or DID of the repo.',
          },
          collection: {
            type: 'string',
            description: 'The NSID of the collection.',
          },
          rkey: {
            type: 'string',
            description: 'The key of the record.',
          },
          cid: {
            type: 'string',
            description:
              'The CID of the version of the record. If not specified, then return the most recent version.',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'value'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              value: {
                type: 'unknown',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.listRecords',
    defs: {
      main: {
        type: 'query',
        description: 'List a range of records in a collection.',
        parameters: {
          user: {
            type: 'string',
            description: 'The handle or DID of the repo.',
          },
          collection: {
            type: 'string',
            description: 'The NSID of the record type.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'The number of records to return.',
          },
          before: {
            type: 'string',
            description: 'A TID to filter the range of records returned.',
          },
          after: {
            type: 'string',
            description: 'A TID to filter the range of records returned.',
          },
          reverse: {
            type: 'boolean',
            description: 'Reverse the order of the returned records?',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['records'],
            properties: {
              cursor: {
                type: 'string',
              },
              records: {
                type: 'array',
                items: '#record',
              },
            },
          },
        },
      },
      record: {
        type: 'object',
        required: ['uri', 'cid', 'value'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          value: {
            type: 'unknown',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Write a record.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'collection', 'rkey', 'record'],
            properties: {
              did: {
                type: 'string',
                description: 'The DID of the repo.',
              },
              collection: {
                type: 'string',
                description: 'The NSID of the record type.',
              },
              rkey: {
                type: 'string',
                description: 'The TID of the record.',
              },
              validate: {
                type: 'boolean',
                default: true,
                description: 'Validate the record?',
              },
              record: {
                type: 'unknown',
                description: 'The record to create.',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.server.getAccountsConfig',
    defs: {
      main: {
        type: 'query',
        description:
          "Get a document describing the service's accounts configuration.",
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['availableUserDomains'],
            properties: {
              inviteCodeRequired: {
                type: 'boolean',
              },
              availableUserDomains: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.session.create',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an authentication session.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle', 'password'],
            properties: {
              handle: {
                type: 'string',
              },
              password: {
                type: 'string',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['accessJwt', 'refreshJwt', 'handle', 'did'],
            properties: {
              accessJwt: {
                type: 'string',
              },
              refreshJwt: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.session.delete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete the current session.',
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.session.get',
    defs: {
      main: {
        type: 'query',
        description: 'Get information about the current session.',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle', 'did'],
            properties: {
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.session.refresh',
    defs: {
      main: {
        type: 'procedure',
        description: 'Refresh an authentication session.',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['accessJwt', 'refreshJwt', 'handle', 'did'],
            properties: {
              accessJwt: {
                type: 'string',
              },
              refreshJwt: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.sync.getRepo',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the repo state.',
        parameters: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
          from: {
            type: 'string',
            description: 'A past commit CID.',
          },
        },
        output: {
          encoding: 'application/cbor',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.sync.getRoot',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the current root CID of a repo.',
        parameters: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['root'],
            properties: {
              root: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.sync.updateRepo',
    defs: {
      main: {
        type: 'procedure',
        description: 'Writes commits to a repo.',
        parameters: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
        },
        input: {
          encoding: 'application/cbor',
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.createScene',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create a scene.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle'],
            properties: {
              handle: {
                type: 'string',
              },
              recoveryKey: {
                type: 'string',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle', 'did', 'declaration'],
            properties: {
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
              },
              declaration: 'lex:app.bsky.actor.createScene#declaration',
            },
          },
        },
        errors: [
          {
            name: 'InvalidHandle',
          },
          {
            name: 'HandleNotAvailable',
          },
        ],
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.getProfile',
    defs: {
      main: {
        type: 'query',
        parameters: {
          actor: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'did',
              'declaration',
              'handle',
              'creator',
              'followersCount',
              'followsCount',
              'membersCount',
              'postsCount',
            ],
            properties: {
              did: {
                type: 'string',
              },
              declaration: 'lex:app.bsky.actor.getProfile#declaration',
              handle: {
                type: 'string',
              },
              creator: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
              description: {
                type: 'string',
                maxLength: 256,
              },
              followersCount: {
                type: 'integer',
              },
              followsCount: {
                type: 'integer',
              },
              membersCount: {
                type: 'integer',
              },
              postsCount: {
                type: 'integer',
              },
              myState: 'lex:app.bsky.actor.getProfile#myState',
            },
          },
        },
      },
      myState: {
        type: 'object',
        properties: {
          follow: {
            type: 'string',
          },
          member: {
            type: 'string',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.getSuggestions',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a list of actors suggested for following. Used in discovery UIs.',
        parameters: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          cursor: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              cursor: {
                type: 'string',
              },
              actors: {
                type: 'array',
                items: '#actor',
              },
            },
          },
        },
      },
      actor: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.actor.getSuggestions#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          description: {
            type: 'string',
          },
          indexedAt: {
            type: 'datetime',
          },
          myState: 'lex:app.bsky.actor.getSuggestions#myState',
        },
      },
      myState: {
        type: 'object',
        properties: {
          follow: {
            type: 'string',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['displayName'],
          properties: {
            displayName: {
              type: 'string',
              maxLength: 64,
            },
            description: {
              type: 'string',
              maxLength: 256,
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.search',
    defs: {
      main: {
        type: 'query',
        description: 'Find users matching search criteria.',
        parameters: {
          term: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['users'],
            properties: {
              cursor: {
                type: 'string',
              },
              users: {
                type: 'array',
                items: '#user',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.actor.search#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          description: {
            type: 'string',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.searchTypeahead',
    defs: {
      main: {
        type: 'query',
        description: 'Find user suggestions for a search term.',
        parameters: {
          term: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['users'],
            properties: {
              users: {
                type: 'array',
                items: '#user',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.actor.searchTypeahead#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.actor.updateProfile',
    defs: {
      main: {
        type: 'procedure',
        description: 'Notify server that the user has seen notifications.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              did: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
              description: {
                type: 'string',
                maxLength: 256,
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'cid', 'record'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              record: {
                type: 'unknown',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.getAuthorFeed',
    defs: {
      main: {
        type: 'query',
        description: "A view of a user's feed.",
        parameters: {
          author: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              cursor: {
                type: 'string',
              },
              feed: {
                type: 'array',
                items: '#feedItem',
              },
            },
          },
        },
      },
      feedItem: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'upvoteCount',
          'downvoteCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: 'lex:app.bsky.feed.getAuthorFeed#actor',
          trendedBy: 'lex:app.bsky.feed.getAuthorFeed#actor',
          repostedBy: 'lex:app.bsky.feed.getAuthorFeed#actor',
          record: {
            type: 'unknown',
          },
          embed: ['#recordEmbed', '#externalEmbed', '#unknownEmbed'],
          replyCount: {
            type: 'integer',
          },
          repostCount: {
            type: 'integer',
          },
          upvoteCount: {
            type: 'integer',
          },
          downvoteCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'datetime',
          },
          myState: 'lex:app.bsky.feed.getAuthorFeed#myState',
        },
      },
      myState: {
        type: 'object',
        properties: {
          repost: {
            type: 'string',
          },
          upvote: {
            type: 'string',
          },
          downvote: {
            type: 'string',
          },
        },
      },
      actor: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.feed.getAuthorFeed#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            type: 'string',
            const: 'record',
          },
          author: 'lex:app.bsky.feed.getAuthorFeed#actor',
          record: {
            type: 'unknown',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            type: 'string',
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.getPostThread',
    defs: {
      main: {
        type: 'query',
        parameters: {
          uri: {
            type: 'string',
          },
          depth: {
            type: 'integer',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['thread'],
            properties: {
              thread: ['#post', '#notFoundPost'],
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      post: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'upvoteCount',
          'downvoteCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: 'lex:app.bsky.feed.getPostThread#user',
          record: {
            type: 'unknown',
          },
          embed: ['#recordEmbed', '#externalEmbed', '#unknownEmbed'],
          parent: ['#post', '#notFoundPost'],
          replyCount: {
            type: 'integer',
          },
          replies: {
            type: 'array',
            items: ['#post', '#notFoundPost'],
          },
          repostCount: {
            type: 'integer',
          },
          upvoteCount: {
            type: 'integer',
          },
          downvoteCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'datetime',
          },
          myState: 'lex:app.bsky.feed.getPostThread#myState',
        },
      },
      notFoundPost: {
        type: 'object',
        required: ['uri', 'notFound'],
        properties: {
          uri: {
            type: 'string',
          },
          notFound: {
            type: 'boolean',
          },
        },
      },
      myState: {
        type: 'object',
        properties: {
          repost: {
            type: 'string',
          },
          upvote: {
            type: 'string',
          },
          downvote: {
            type: 'string',
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.feed.getPostThread#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            type: 'string',
            const: 'record',
          },
          author: 'lex:app.bsky.feed.getPostThread#user',
          record: {
            type: 'unknown',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            type: 'string',
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.getRepostedBy',
    defs: {
      main: {
        type: 'query',
        parameters: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'repostedBy'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              cursor: {
                type: 'string',
              },
              repostedBy: {
                type: 'array',
                items: '#repostedBy',
              },
            },
          },
        },
      },
      repostedBy: {
        type: 'object',
        required: ['did', 'declaration', 'handle', 'indexedAt'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.feed.getRepostedBy#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          createdAt: {
            type: 'datetime',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.getTimeline',
    defs: {
      main: {
        type: 'query',
        description: "A view of the user's home timeline.",
        parameters: {
          algorithm: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              cursor: {
                type: 'string',
              },
              feed: {
                type: 'array',
                items: '#feedItem',
              },
            },
          },
        },
      },
      feedItem: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'upvoteCount',
          'downvoteCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: 'lex:app.bsky.feed.getTimeline#actor',
          trendedBy: 'lex:app.bsky.feed.getTimeline#actor',
          repostedBy: 'lex:app.bsky.feed.getTimeline#actor',
          record: {
            type: 'unknown',
          },
          embed: ['#recordEmbed', '#externalEmbed', '#unknownEmbed'],
          replyCount: {
            type: 'integer',
          },
          repostCount: {
            type: 'integer',
          },
          upvoteCount: {
            type: 'integer',
          },
          downvoteCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'datetime',
          },
          myState: 'lex:app.bsky.feed.getTimeline#myState',
        },
      },
      myState: {
        type: 'object',
        properties: {
          repost: {
            type: 'string',
          },
          upvote: {
            type: 'string',
          },
          downvote: {
            type: 'string',
          },
        },
      },
      actor: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.feed.getTimeline#declaration',
          handle: {
            type: 'string',
          },
          actorType: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            type: 'string',
            const: 'record',
          },
          author: 'lex:app.bsky.feed.getTimeline#actor',
          record: {
            type: 'unknown',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            type: 'string',
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.getVotes',
    defs: {
      main: {
        type: 'query',
        parameters: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          direction: {
            type: 'string',
            enum: ['up', 'down'],
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'votes'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              cursor: {
                type: 'string',
              },
              votes: {
                type: 'array',
                items: '#vote',
              },
            },
          },
        },
      },
      vote: {
        type: 'object',
        required: ['direction', 'indexedAt', 'createdAt', 'actor'],
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
          },
          indexedAt: {
            type: 'datetime',
          },
          createdAt: {
            type: 'datetime',
          },
          actor: 'lex:app.bsky.feed.getVotes#actor',
        },
      },
      actor: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.feed.getVotes#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.mediaEmbed',
    defs: {
      main: {
        type: 'object',
        description: 'A list of media embedded in a post or document.',
        required: ['media'],
        properties: {
          media: {
            type: 'array',
            items: '#mediaEmbed',
          },
        },
      },
      mediaEmbed: {
        type: 'object',
        required: ['original'],
        properties: {
          alt: {
            type: 'string',
          },
          thumb: {
            type: 'image',
          },
          original: {
            type: 'blob',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.post',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['text', 'createdAt'],
          properties: {
            text: {
              type: 'string',
              maxLength: 256,
            },
            entities: {
              type: 'array',
              items: '#entity',
            },
            reply: 'lex:app.bsky.feed.post#replyRef',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: 'lex:app.bsky.feed.post#postRef',
          parent: 'lex:app.bsky.feed.post#postRef',
        },
      },
      postRef: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
      entity: {
        type: 'object',
        required: ['index', 'type', 'value'],
        properties: {
          index: 'lex:app.bsky.feed.post#textSlice',
          type: {
            type: 'string',
            description:
              "Expected values are 'mention', 'hashtag', and 'link'.",
          },
          value: {
            type: 'string',
          },
        },
      },
      textSlice: {
        type: 'object',
        required: ['start', 'end'],
        properties: {
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.repost',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: 'lex:app.bsky.feed.repost#subject',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.setVote',
    defs: {
      main: {
        type: 'procedure',
        description: "Upvote, downvote, or clear the user's vote for a post.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'direction'],
            properties: {
              subject: 'lex:app.bsky.feed.setVote#subject',
              direction: {
                type: 'string',
                enum: ['up', 'down', 'none'],
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              upvote: {
                type: 'string',
              },
              downvote: {
                type: 'string',
              },
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.trend',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: 'lex:app.bsky.feed.trend#subject',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.feed.vote',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'direction', 'createdAt'],
          properties: {
            subject: 'lex:app.bsky.feed.vote#subject',
            direction: {
              type: 'string',
              enum: ['up', 'down'],
            },
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.assertCreator',
    defs: {
      main: {
        type: 'token',
        description:
          "Assertion type: Creator. Defined for app.bsky.graph.assertions's assertion.",
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.assertMember',
    defs: {
      main: {
        type: 'token',
        description:
          "Assertion type: Member. Defined for app.bsky.graph.assertions's assertion.",
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.assertion',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['assertion', 'subject', 'createdAt'],
          properties: {
            assertion: {
              type: 'string',
            },
            subject: 'lex:app.bsky.graph.assertion#subject',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declarationCid'],
        properties: {
          did: {
            type: 'string',
          },
          declarationCid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.confirmation',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['originator', 'assertion', 'createdAt'],
          properties: {
            originator: 'lex:app.bsky.graph.confirmation#originator',
            assertion: 'lex:app.bsky.graph.confirmation#assertion',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      originator: {
        type: 'object',
        required: ['did', 'declarationCid'],
        properties: {
          did: {
            type: 'string',
          },
          declarationCid: {
            type: 'string',
          },
        },
      },
      assertion: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.follow',
    defs: {
      main: {
        type: 'record',
        description: 'A social follow.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: 'lex:app.bsky.graph.follow#subject',
            createdAt: {
              type: 'datetime',
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declarationCid'],
        properties: {
          did: {
            type: 'string',
          },
          declarationCid: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.getAssertions',
    defs: {
      main: {
        type: 'query',
        description: 'General-purpose query for assertions.',
        parameters: {
          author: {
            type: 'string',
          },
          subject: {
            type: 'string',
          },
          assertion: {
            type: 'string',
          },
          confirmed: {
            type: 'boolean',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['assertions'],
            properties: {
              cursor: {
                type: 'string',
              },
              assertions: {
                type: 'array',
                items: '#assertion',
              },
            },
          },
        },
      },
      assertion: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'assertion',
          'author',
          'subject',
          'indexedAt',
          'createdAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          assertion: {
            type: 'string',
          },
          confirmation: 'lex:app.bsky.graph.getAssertions#confirmation',
          author: 'lex:app.bsky.graph.getAssertions#actor',
          subject: 'lex:app.bsky.graph.getAssertions#actor',
          indexedAt: {
            type: 'datetime',
          },
          createdAt: {
            type: 'datetime',
          },
        },
      },
      confirmation: {
        type: 'object',
        required: ['uri', 'cid', 'indexedAt', 'createdAt'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          indexedAt: {
            type: 'datetime',
          },
          createdAt: {
            type: 'datetime',
          },
        },
      },
      actor: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getAssertions#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.getFollowers',
    defs: {
      main: {
        type: 'query',
        description: 'Who is following a user?',
        parameters: {
          user: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'followers'],
            properties: {
              subject: 'lex:app.bsky.graph.getFollowers#subject',
              cursor: {
                type: 'string',
              },
              followers: {
                type: 'array',
                items: '#follower',
              },
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getFollowers#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      follower: {
        type: 'object',
        required: ['did', 'declaration', 'handle', 'indexedAt'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getFollowers#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          createdAt: {
            type: 'datetime',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.getFollows',
    defs: {
      main: {
        type: 'query',
        description: 'Who is a user following?',
        parameters: {
          user: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'follows'],
            properties: {
              subject: 'lex:app.bsky.graph.getFollows#subject',
              cursor: {
                type: 'string',
              },
              follows: {
                type: 'array',
                items: '#follow',
              },
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getFollows#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      follow: {
        type: 'object',
        required: ['did', 'declaration', 'handle', 'indexedAt'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getFollows#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          createdAt: {
            type: 'datetime',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.getMembers',
    defs: {
      main: {
        type: 'query',
        description: 'Who is a member of the group?',
        parameters: {
          actor: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'members'],
            properties: {
              subject: 'lex:app.bsky.graph.getMembers#subject',
              cursor: {
                type: 'string',
              },
              members: {
                type: 'array',
                items: '#member',
              },
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getMembers#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      member: {
        type: 'object',
        required: ['did', 'declaration', 'handle', 'indexedAt'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getMembers#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          createdAt: {
            type: 'datetime',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.graph.getMemberships',
    defs: {
      main: {
        type: 'query',
        description: 'Which groups is the actor a member of?',
        parameters: {
          actor: {
            type: 'string',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'memberships'],
            properties: {
              subject: 'lex:app.bsky.graph.getMemberships#subject',
              cursor: {
                type: 'string',
              },
              memberships: {
                type: 'array',
                items: '#membership',
              },
            },
          },
        },
      },
      subject: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getMemberships#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      membership: {
        type: 'object',
        required: ['did', 'declaration', 'handle', 'indexedAt'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.graph.getMemberships#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          createdAt: {
            type: 'datetime',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.notification.getCount',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['count'],
            properties: {
              count: {
                type: 'integer',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.notification.list',
    defs: {
      main: {
        type: 'query',
        parameters: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          before: {
            type: 'string',
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['notifications'],
            properties: {
              cursor: {
                type: 'string',
              },
              notifications: {
                type: 'array',
                items: '#notification',
              },
            },
          },
        },
      },
      notification: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'reason',
          'record',
          'isRead',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: 'lex:app.bsky.notification.list#author',
          reason: {
            type: 'string',
            description:
              "Expected values are 'vote', 'repost', 'trend', 'follow', 'invite', 'mention' and 'reply'.",
          },
          reasonSubject: {
            type: 'string',
          },
          record: {
            type: 'unknown',
          },
          isRead: {
            type: 'boolean',
          },
          indexedAt: {
            type: 'datetime',
          },
        },
      },
      author: {
        type: 'object',
        required: ['did', 'declaration', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
          declaration: 'lex:app.bsky.notification.list#declaration',
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      declaration: {
        type: 'object',
        required: ['cid', 'actorType'],
        properties: {
          cid: {
            type: 'string',
          },
          actorType: {
            type: 'string',
            knownValues: [
              'app.bsky.system.actorUser',
              'app.bsky.system.actorScene',
            ],
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.notification.updateSeen',
    defs: {
      main: {
        type: 'procedure',
        description: 'Notify server that the user has seen notifications.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['seenAt'],
            properties: {
              seenAt: {
                type: 'datetime',
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.system.actorScene',
    defs: {
      main: {
        type: 'token',
        description:
          "Actor type: Scene. Defined for app.bsky.system.declaration's actorType.",
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.system.actorUser',
    defs: {
      main: {
        type: 'token',
        description:
          "Actor type: User. Defined for app.bsky.system.declaration's actorType.",
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.system.declaration',
    defs: {
      main: {
        description:
          'Context for an account that is considered intrinsic to it and alters the fundamental understanding of an account of changed. A declaration should be treated as immutable.',
        type: 'record',
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['actorType'],
          properties: {
            actorType: {
              type: 'string',
              knownValues: [
                'app.bsky.system.actorUser',
                'app.bsky.system.actorScene',
              ],
            },
          },
        },
      },
    },
  },
]
export const ids = {
  ComAtprotoAccountCreate: 'com.atproto.account.create',
  ComAtprotoAccountCreateInviteCode: 'com.atproto.account.createInviteCode',
  ComAtprotoAccountDelete: 'com.atproto.account.delete',
  ComAtprotoAccountGet: 'com.atproto.account.get',
  ComAtprotoAccountRequestPasswordReset:
    'com.atproto.account.requestPasswordReset',
  ComAtprotoAccountResetPassword: 'com.atproto.account.resetPassword',
  ComAtprotoHandleResolve: 'com.atproto.handle.resolve',
  ComAtprotoRepoBatchWrite: 'com.atproto.repo.batchWrite',
  ComAtprotoRepoCreateRecord: 'com.atproto.repo.createRecord',
  ComAtprotoRepoDeleteRecord: 'com.atproto.repo.deleteRecord',
  ComAtprotoRepoDescribe: 'com.atproto.repo.describe',
  ComAtprotoRepoGetRecord: 'com.atproto.repo.getRecord',
  ComAtprotoRepoListRecords: 'com.atproto.repo.listRecords',
  ComAtprotoRepoPutRecord: 'com.atproto.repo.putRecord',
  ComAtprotoServerGetAccountsConfig: 'com.atproto.server.getAccountsConfig',
  ComAtprotoSessionCreate: 'com.atproto.session.create',
  ComAtprotoSessionDelete: 'com.atproto.session.delete',
  ComAtprotoSessionGet: 'com.atproto.session.get',
  ComAtprotoSessionRefresh: 'com.atproto.session.refresh',
  ComAtprotoSyncGetRepo: 'com.atproto.sync.getRepo',
  ComAtprotoSyncGetRoot: 'com.atproto.sync.getRoot',
  ComAtprotoSyncUpdateRepo: 'com.atproto.sync.updateRepo',
  AppBskyActorCreateScene: 'app.bsky.actor.createScene',
  AppBskyActorGetProfile: 'app.bsky.actor.getProfile',
  AppBskyActorGetSuggestions: 'app.bsky.actor.getSuggestions',
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyActorSearch: 'app.bsky.actor.search',
  AppBskyActorSearchTypeahead: 'app.bsky.actor.searchTypeahead',
  AppBskyActorUpdateProfile: 'app.bsky.actor.updateProfile',
  AppBskyFeedGetAuthorFeed: 'app.bsky.feed.getAuthorFeed',
  AppBskyFeedGetPostThread: 'app.bsky.feed.getPostThread',
  AppBskyFeedGetRepostedBy: 'app.bsky.feed.getRepostedBy',
  AppBskyFeedGetTimeline: 'app.bsky.feed.getTimeline',
  AppBskyFeedGetVotes: 'app.bsky.feed.getVotes',
  AppBskyFeedMediaEmbed: 'app.bsky.feed.mediaEmbed',
  AppBskyFeedPost: 'app.bsky.feed.post',
  AppBskyFeedRepost: 'app.bsky.feed.repost',
  AppBskyFeedSetVote: 'app.bsky.feed.setVote',
  AppBskyFeedTrend: 'app.bsky.feed.trend',
  AppBskyFeedVote: 'app.bsky.feed.vote',
  AppBskyGraphAssertCreator: 'app.bsky.graph.assertCreator',
  AppBskyGraphAssertMember: 'app.bsky.graph.assertMember',
  AppBskyGraphAssertion: 'app.bsky.graph.assertion',
  AppBskyGraphConfirmation: 'app.bsky.graph.confirmation',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskyGraphGetAssertions: 'app.bsky.graph.getAssertions',
  AppBskyGraphGetFollowers: 'app.bsky.graph.getFollowers',
  AppBskyGraphGetFollows: 'app.bsky.graph.getFollows',
  AppBskyGraphGetMembers: 'app.bsky.graph.getMembers',
  AppBskyGraphGetMemberships: 'app.bsky.graph.getMemberships',
  AppBskyNotificationGetCount: 'app.bsky.notification.getCount',
  AppBskyNotificationList: 'app.bsky.notification.list',
  AppBskyNotificationUpdateSeen: 'app.bsky.notification.updateSeen',
  AppBskySystemActorScene: 'app.bsky.system.actorScene',
  AppBskySystemActorUser: 'app.bsky.system.actorUser',
  AppBskySystemDeclaration: 'app.bsky.system.declaration',
}
