/**
* GENERATED CODE - DO NOT MODIFY
*/
import { MethodSchema, RecordSchema } from '@atproto/lexicon'

export const methodSchemaDict: Record<string, MethodSchema> = {
  'com.atproto.account.create': {
    lexicon: 1,
    id: 'com.atproto.account.create',
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
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: [
          'accessJwt',
          'refreshJwt',
          'handle',
          'did',
          'declarationCid',
        ],
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
          declarationCid: {
            type: 'string',
          },
        },
        $defs: {},
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
  'com.atproto.account.createInviteCode': {
    lexicon: 1,
    id: 'com.atproto.account.createInviteCode',
    type: 'procedure',
    description: 'Create an invite code.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['useCount'],
        properties: {
          useCount: {
            type: 'number',
          },
        },
        $defs: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.account.delete': {
    lexicon: 1,
    id: 'com.atproto.account.delete',
    type: 'procedure',
    description: 'Delete an account.',
    input: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
    output: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.account.get': {
    lexicon: 1,
    id: 'com.atproto.account.get',
    type: 'query',
    description: 'Get information about an account.',
    parameters: {},
    output: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.account.requestPasswordReset': {
    lexicon: 1,
    id: 'com.atproto.account.requestPasswordReset',
    type: 'procedure',
    description: 'Initiate a user account password reset via email',
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
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {},
        $defs: {},
      },
    },
  },
  'com.atproto.account.resetPassword': {
    lexicon: 1,
    id: 'com.atproto.account.resetPassword',
    type: 'procedure',
    description: 'Reset a user account password using a token',
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
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {},
        $defs: {},
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
  'com.atproto.handle.resolve': {
    lexicon: 1,
    id: 'com.atproto.handle.resolve',
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
        $defs: {},
      },
    },
  },
  'com.atproto.repo.batchWrite': {
    lexicon: 1,
    id: 'com.atproto.repo.batchWrite',
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
            items: {
              oneOf: [
                {
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
                    value: {},
                  },
                },
                {
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
                    value: {},
                  },
                },
                {
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
              ],
            },
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.repo.createRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.createRecord',
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
            type: 'object',
            description: 'The record to create',
          },
        },
        $defs: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.repo.deleteRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
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
        $defs: {},
      },
    },
  },
  'com.atproto.repo.describe': {
    lexicon: 1,
    id: 'com.atproto.repo.describe',
    type: 'query',
    description:
      'Get information about the repo, including the list of collections.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The handle or DID of the repo.',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle', 'did', 'didDoc', 'collections', 'handleIsCorrect'],
        properties: {
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
          didDoc: {
            type: 'object',
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
        $defs: {},
      },
    },
  },
  'com.atproto.repo.getRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.getRecord',
    type: 'query',
    description: 'Fetch a record.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The handle or DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the collection.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The key of the record.',
      },
      cid: {
        type: 'string',
        required: false,
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
            type: 'object',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.repo.listRecords': {
    lexicon: 1,
    id: 'com.atproto.repo.listRecords',
    type: 'query',
    description: 'List a range of records in a collection.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The handle or DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record type.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        default: 50,
        description: 'The number of records to return. TODO-max number?',
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
        default: false,
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
            items: {
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
                  type: 'object',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.repo.putRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
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
            type: 'object',
            description: 'The record to create',
          },
        },
        $defs: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.server.getAccountsConfig': {
    lexicon: 1,
    id: 'com.atproto.server.getAccountsConfig',
    type: 'query',
    description:
      "Get a document describing the service's accounts configuration.",
    parameters: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.session.create': {
    lexicon: 1,
    id: 'com.atproto.session.create',
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
        $defs: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.session.delete': {
    lexicon: 1,
    id: 'com.atproto.session.delete',
    type: 'procedure',
    description: 'Delete the current session.',
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.session.get': {
    lexicon: 1,
    id: 'com.atproto.session.get',
    type: 'query',
    description: 'Get information about the current session.',
    parameters: {},
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
        $defs: {},
      },
    },
  },
  'com.atproto.session.refresh': {
    lexicon: 1,
    id: 'com.atproto.session.refresh',
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
        $defs: {},
      },
    },
  },
  'com.atproto.sync.getRepo': {
    lexicon: 1,
    id: 'com.atproto.sync.getRepo',
    type: 'query',
    description: 'Gets the repo state.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      from: {
        type: 'string',
        description: 'A past commit CID',
      },
    },
    output: {
      encoding: 'application/cbor',
    },
  },
  'com.atproto.sync.getRoot': {
    lexicon: 1,
    id: 'com.atproto.sync.getRoot',
    type: 'query',
    description: 'Gets the current root CID of a repo.',
    parameters: {
      did: {
        type: 'string',
        required: true,
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
        $defs: {},
      },
    },
  },
  'com.atproto.sync.updateRepo': {
    lexicon: 1,
    id: 'com.atproto.sync.updateRepo',
    type: 'procedure',
    description: 'Writes commits to a repo.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
    },
    input: {
      encoding: 'application/cbor',
    },
  },
  'app.bsky.actor.getProfile': {
    lexicon: 1,
    id: 'app.bsky.actor.getProfile',
    type: 'query',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: [
          'did',
          'handle',
          'followersCount',
          'followsCount',
          'postsCount',
        ],
        properties: {
          did: {
            type: 'string',
          },
          handle: {
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
            type: 'number',
          },
          followsCount: {
            type: 'number',
          },
          postsCount: {
            type: 'number',
          },
          myState: {
            type: 'object',
            properties: {
              follow: {
                type: 'string',
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.actor.search': {
    lexicon: 1,
    id: 'app.bsky.actor.search',
    type: 'query',
    description: 'Find users matching search criteria',
    parameters: {
      term: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              type: 'object',
              required: ['did', 'handle'],
              properties: {
                did: {
                  type: 'string',
                },
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
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.actor.searchTypeahead': {
    lexicon: 1,
    id: 'app.bsky.actor.searchTypeahead',
    type: 'query',
    description: 'Find user suggestions for a search term',
    parameters: {
      term: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              type: 'object',
              required: ['did', 'handle'],
              properties: {
                did: {
                  type: 'string',
                },
                handle: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.actor.updateProfile': {
    lexicon: 1,
    id: 'app.bsky.actor.updateProfile',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: [],
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
        $defs: {},
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
            type: 'object',
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.feed.getAuthorFeed': {
    lexicon: 1,
    id: 'app.bsky.feed.getAuthorFeed',
    type: 'query',
    description: "A view of a user's feed",
    parameters: {
      author: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              $ref: '#/$defs/feedItem',
            },
          },
        },
        $defs: {
          feedItem: {
            type: 'object',
            required: [
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'repostCount',
              'likeCount',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/user',
              },
              repostedBy: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/recordEmbed',
                  },
                  {
                    $ref: '#/$defs/externalEmbed',
                  },
                  {
                    $ref: '#/$defs/unknownEmbed',
                  },
                ],
              },
              replyCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              likeCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          user: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
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
                const: 'record',
              },
              author: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
            },
          },
          externalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
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
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      feedItem: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'likeCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/user',
          },
          repostedBy: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/recordEmbed',
              },
              {
                $ref: '#/$defs/externalEmbed',
              },
              {
                $ref: '#/$defs/unknownEmbed',
              },
            ],
          },
          replyCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          likeCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
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
            const: 'record',
          },
          author: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
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
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  'app.bsky.feed.getLikedBy': {
    lexicon: 1,
    id: 'app.bsky.feed.getLikedBy',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      cid: {
        type: 'string',
        required: false,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'likedBy'],
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
          likedBy: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'handle', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                handle: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.feed.getPostThread': {
    lexicon: 1,
    id: 'app.bsky.feed.getPostThread',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      depth: {
        type: 'number',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['thread'],
        properties: {
          thread: {
            $ref: '#/$defs/post',
          },
        },
        $defs: {
          post: {
            type: 'object',
            required: [
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'likeCount',
              'repostCount',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/recordEmbed',
                  },
                  {
                    $ref: '#/$defs/externalEmbed',
                  },
                  {
                    $ref: '#/$defs/unknownEmbed',
                  },
                ],
              },
              parent: {
                $ref: '#/$defs/post',
              },
              replyCount: {
                type: 'number',
              },
              replies: {
                type: 'array',
                items: {
                  $ref: '#/$defs/post',
                },
              },
              likeCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          user: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
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
                const: 'record',
              },
              author: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
            },
          },
          externalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
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
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      post: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'likeCount',
          'repostCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/recordEmbed',
              },
              {
                $ref: '#/$defs/externalEmbed',
              },
              {
                $ref: '#/$defs/unknownEmbed',
              },
            ],
          },
          parent: {
            $ref: '#/$defs/post',
          },
          replyCount: {
            type: 'number',
          },
          replies: {
            type: 'array',
            items: {
              $ref: '#/$defs/post',
            },
          },
          likeCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
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
            const: 'record',
          },
          author: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
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
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  'app.bsky.feed.getRepostedBy': {
    lexicon: 1,
    id: 'app.bsky.feed.getRepostedBy',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      cid: {
        type: 'string',
        required: false,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              type: 'object',
              required: ['did', 'handle', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                handle: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.feed.getTimeline': {
    lexicon: 1,
    id: 'app.bsky.feed.getTimeline',
    type: 'query',
    description: "A view of the user's home timeline",
    parameters: {
      algorithm: {
        type: 'string',
      },
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              $ref: '#/$defs/feedItem',
            },
          },
        },
        $defs: {
          feedItem: {
            type: 'object',
            required: [
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'repostCount',
              'likeCount',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/user',
              },
              repostedBy: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/recordEmbed',
                  },
                  {
                    $ref: '#/$defs/externalEmbed',
                  },
                  {
                    $ref: '#/$defs/unknownEmbed',
                  },
                ],
              },
              replyCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              likeCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          user: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
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
                const: 'record',
              },
              author: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
            },
          },
          externalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
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
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      feedItem: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'likeCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/user',
          },
          repostedBy: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/recordEmbed',
              },
              {
                $ref: '#/$defs/externalEmbed',
              },
              {
                $ref: '#/$defs/unknownEmbed',
              },
            ],
          },
          replyCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          likeCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
          },
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
            const: 'record',
          },
          author: {
            $ref: '#/$defs/user',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
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
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  'app.bsky.graph.getFollowers': {
    lexicon: 1,
    id: 'app.bsky.graph.getFollowers',
    type: 'query',
    description: 'Who is following a user?',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
          subject: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          cursor: {
            type: 'string',
          },
          followers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'handle', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                handle: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.graph.getFollows': {
    lexicon: 1,
    id: 'app.bsky.graph.getFollows',
    type: 'query',
    description: 'Who is a user following?',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
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
          subject: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          cursor: {
            type: 'string',
          },
          follows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'handle', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                handle: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.notification.getCount': {
    lexicon: 1,
    id: 'app.bsky.notification.getCount',
    type: 'query',
    parameters: {},
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['count'],
        properties: {
          count: {
            type: 'number',
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.notification.list': {
    lexicon: 1,
    id: 'app.bsky.notification.list',
    type: 'query',
    parameters: {
      limit: {
        type: 'number',
        maximum: 100,
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
            items: {
              $ref: '#/$defs/notification',
            },
          },
        },
        $defs: {
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
                format: 'uri',
              },
              cid: {
                type: 'string',
              },
              author: {
                type: 'object',
                required: ['did', 'handle'],
                properties: {
                  did: {
                    type: 'string',
                  },
                  handle: {
                    type: 'string',
                  },
                  displayName: {
                    type: 'string',
                    maxLength: 64,
                  },
                },
              },
              reason: {
                type: 'string',
                $comment:
                  "Expected values are 'like', 'repost', 'follow', 'invite', 'mention' and 'reply'.",
              },
              reasonSubject: {
                type: 'string',
              },
              record: {
                type: 'object',
              },
              isRead: {
                type: 'boolean',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      },
    },
    defs: {
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
            format: 'uri',
          },
          cid: {
            type: 'string',
          },
          author: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
              },
              handle: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          reason: {
            type: 'string',
            $comment:
              "Expected values are 'like', 'repost', 'follow', 'invite', 'mention' and 'reply'.",
          },
          reasonSubject: {
            type: 'string',
          },
          record: {
            type: 'object',
          },
          isRead: {
            type: 'boolean',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  'app.bsky.notification.updateSeen': {
    lexicon: 1,
    id: 'app.bsky.notification.updateSeen',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['seenAt'],
        properties: {
          seenAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
}
export const methodSchemas: MethodSchema[] = Object.values(methodSchemaDict)
export const ids = {
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyFeedLike: 'app.bsky.feed.like',
  AppBskyFeedMediaEmbed: 'app.bsky.feed.mediaEmbed',
  AppBskyFeedPost: 'app.bsky.feed.post',
  AppBskyFeedRepost: 'app.bsky.feed.repost',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskyGraphInvite: 'app.bsky.graph.invite',
  AppBskyGraphInviteAccept: 'app.bsky.graph.inviteAccept',
  AppBskySystemDeclaration: 'app.bsky.system.declaration',
}
export const recordSchemaDict: Record<string, RecordSchema> = {
  'app.bsky.actor.profile': {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
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
      $defs: {},
    },
  },
  'app.bsky.feed.like': {
    lexicon: 1,
    id: 'app.bsky.feed.like',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
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
    defs: {
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
  'app.bsky.feed.mediaEmbed': {
    lexicon: 1,
    id: 'app.bsky.feed.mediaEmbed',
    type: 'record',
    description: 'A list of media embedded in a post or document.',
    key: 'tid',
    record: {
      type: 'object',
      required: ['media'],
      properties: {
        media: {
          type: 'array',
          items: {
            $ref: '#/$defs/mediaEmbed',
          },
        },
      },
      $defs: {
        mediaEmbed: {
          type: 'object',
          required: ['original'],
          properties: {
            alt: {
              type: 'string',
            },
            thumb: {
              $ref: '#/$defs/mediaEmbedBlob',
            },
            original: {
              $ref: '#/$defs/mediaEmbedBlob',
            },
          },
        },
        mediaEmbedBlob: {
          type: 'object',
          required: ['mimeType', 'blobId'],
          properties: {
            mimeType: {
              type: 'string',
            },
            blobId: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      mediaEmbed: {
        type: 'object',
        required: ['original'],
        properties: {
          alt: {
            type: 'string',
          },
          thumb: {
            $ref: '#/$defs/mediaEmbedBlob',
          },
          original: {
            $ref: '#/$defs/mediaEmbedBlob',
          },
        },
      },
      mediaEmbedBlob: {
        type: 'object',
        required: ['mimeType', 'blobId'],
        properties: {
          mimeType: {
            type: 'string',
          },
          blobId: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.feed.post': {
    lexicon: 1,
    id: 'app.bsky.feed.post',
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
          items: {
            $ref: '#/$defs/entity',
          },
        },
        reply: {
          type: 'object',
          required: ['root', 'parent'],
          properties: {
            root: {
              $ref: '#/$defs/postRef',
            },
            parent: {
              $ref: '#/$defs/postRef',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        entity: {
          type: 'object',
          required: ['index', 'type', 'value'],
          properties: {
            index: {
              $ref: '#/$defs/textSlice',
            },
            type: {
              type: 'string',
              $comment: "Expected values are 'mention', 'hashtag', and 'link'.",
            },
            value: {
              type: 'string',
            },
          },
        },
        textSlice: {
          type: 'array',
          items: [
            {
              type: 'number',
            },
            {
              type: 'number',
            },
          ],
          minItems: 2,
          maxItems: 2,
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
      },
    },
    defs: {
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
          index: {
            $ref: '#/$defs/textSlice',
          },
          type: {
            type: 'string',
            $comment: "Expected values are 'mention', 'hashtag', and 'link'.",
          },
          value: {
            type: 'string',
          },
        },
      },
      textSlice: {
        type: 'array',
        items: [
          {
            type: 'number',
          },
          {
            type: 'number',
          },
        ],
        minItems: 2,
        maxItems: 2,
      },
    },
  },
  'app.bsky.feed.repost': {
    lexicon: 1,
    id: 'app.bsky.feed.repost',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
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
    defs: {
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
  'app.bsky.graph.follow': {
    lexicon: 1,
    id: 'app.bsky.graph.follow',
    type: 'record',
    description: 'A social follow',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
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
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.graph.invite': {
    lexicon: 1,
    id: 'app.bsky.graph.invite',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['group', 'subject', 'createdAt'],
      properties: {
        group: {
          type: 'string',
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
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.graph.inviteAccept': {
    lexicon: 1,
    id: 'app.bsky.graph.inviteAccept',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['group', 'invite', 'createdAt'],
      properties: {
        group: {
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
        invite: {
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
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.system.declaration': {
    lexicon: 1,
    id: 'app.bsky.system.declaration',
    description:
      'Context for an account that is considered intrinsic to it and alters the fundamental understanding of an account of changed. A declaration should be treated as immutable.',
    type: 'record',
    key: 'literal:self',
    record: {
      type: 'object',
      required: ['actorType'],
      properties: {
        actorType: {
          oneOf: [
            {
              $ref: '#/$defs/actorKnown',
            },
            {
              $ref: '#/$defs/actorUnknown',
            },
          ],
        },
      },
      $defs: {
        actorKnown: {
          type: 'string',
          enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
        },
        actorUnknown: {
          type: 'string',
          not: {
            enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
          },
        },
      },
    },
    defs: {
      actorKnown: {
        type: 'string',
        enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
      },
      actorUnknown: {
        type: 'string',
        not: {
          enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
        },
      },
    },
  },
}
export const recordSchemas: RecordSchema[] = Object.values(recordSchemaDict)
