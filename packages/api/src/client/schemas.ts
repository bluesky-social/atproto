/**
* GENERATED CODE - DO NOT MODIFY
*/
import { MethodSchema, RecordSchema } from '@atproto/lexicon'

export const methodSchemaDict: Record<string, MethodSchema> = {
  'com.atproto.createAccount': {
    lexicon: 1,
    id: 'com.atproto.createAccount',
    type: 'procedure',
    description: 'Create an account.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          email: {
            type: 'string',
          },
          username: {
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
          'username',
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
          username: {
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
        name: 'InvalidUsername',
      },
      {
        name: 'InvalidPassword',
      },
      {
        name: 'InvalidInviteCode',
      },
      {
        name: 'UsernameNotAvailable',
      },
    ],
  },
  'com.atproto.createInviteCode': {
    lexicon: 1,
    id: 'com.atproto.createInviteCode',
    type: 'procedure',
    description: 'Create an invite code.',
    parameters: {},
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
  'com.atproto.createSession': {
    lexicon: 1,
    id: 'com.atproto.createSession',
    type: 'procedure',
    description: 'Create an authentication session.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
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
        required: ['accessJwt', 'refreshJwt', 'name', 'did'],
        properties: {
          accessJwt: {
            type: 'string',
          },
          refreshJwt: {
            type: 'string',
          },
          name: {
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
  'com.atproto.deleteAccount': {
    lexicon: 1,
    id: 'com.atproto.deleteAccount',
    type: 'procedure',
    description: 'Delete an account.',
    parameters: {},
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
  'com.atproto.deleteSession': {
    lexicon: 1,
    id: 'com.atproto.deleteSession',
    type: 'procedure',
    description: 'Delete the current session.',
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.getAccount': {
    lexicon: 1,
    id: 'com.atproto.getAccount',
    type: 'query',
    description: 'Get information about an account.',
    parameters: {},
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
  'com.atproto.getAccountsConfig': {
    lexicon: 1,
    id: 'com.atproto.getAccountsConfig',
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
  'com.atproto.getSession': {
    lexicon: 1,
    id: 'com.atproto.getSession',
    type: 'query',
    description: 'Get information about the current session.',
    parameters: {},
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'did'],
        properties: {
          name: {
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
  'com.atproto.refreshSession': {
    lexicon: 1,
    id: 'com.atproto.refreshSession',
    type: 'procedure',
    description: 'Refresh an authentication session.',
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['accessJwt', 'refreshJwt', 'name', 'did'],
        properties: {
          accessJwt: {
            type: 'string',
          },
          refreshJwt: {
            type: 'string',
          },
          name: {
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
  'com.atproto.repoBatchWrite': {
    lexicon: 1,
    id: 'com.atproto.repoBatchWrite',
    type: 'procedure',
    description: 'Apply a batch transaction of creates, puts, and deletes.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the records?',
      },
    },
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['writes'],
        properties: {
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
  'com.atproto.repoCreateRecord': {
    lexicon: 1,
    id: 'com.atproto.repoCreateRecord',
    type: 'procedure',
    description: 'Create a new record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record collection.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the record?',
      },
    },
    input: {
      encoding: 'application/json',
      description: 'The record to create',
      schema: {
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
  'com.atproto.repoDeleteRecord': {
    lexicon: 1,
    id: 'com.atproto.repoDeleteRecord',
    type: 'procedure',
    description: 'Delete a record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record collection.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The key of the record.',
      },
    },
  },
  'com.atproto.repoDescribe': {
    lexicon: 1,
    id: 'com.atproto.repoDescribe',
    type: 'query',
    description:
      'Get information about the repo, including the list of collections.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'did', 'didDoc', 'collections', 'nameIsCorrect'],
        properties: {
          name: {
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
          nameIsCorrect: {
            type: 'boolean',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.repoGetRecord': {
    lexicon: 1,
    id: 'com.atproto.repoGetRecord',
    type: 'query',
    description: 'Fetch a record.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
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
  'com.atproto.repoListRecords': {
    lexicon: 1,
    id: 'com.atproto.repoListRecords',
    type: 'query',
    description: 'List a range of records in a collection.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
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
  'com.atproto.repoPutRecord': {
    lexicon: 1,
    id: 'com.atproto.repoPutRecord',
    type: 'procedure',
    description: 'Write a record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record type.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The TID of the record.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the record?',
      },
    },
    input: {
      encoding: 'application/json',
      schema: {
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
  'com.atproto.requestAccountPasswordReset': {
    lexicon: 1,
    id: 'com.atproto.requestAccountPasswordReset',
    type: 'procedure',
    description: 'Initiate a user account password reset via email',
    parameters: {},
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
  'com.atproto.resetAccountPassword': {
    lexicon: 1,
    id: 'com.atproto.resetAccountPassword',
    type: 'procedure',
    description: 'Reset a user account password using a token',
    parameters: {},
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
  'com.atproto.resolveName': {
    lexicon: 1,
    id: 'com.atproto.resolveName',
    type: 'query',
    description: 'Provides the DID of a repo.',
    parameters: {
      name: {
        type: 'string',
        description:
          "The name to resolve. If not supplied, will resolve the host's own name.",
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
  'com.atproto.syncGetRepo': {
    lexicon: 1,
    id: 'com.atproto.syncGetRepo',
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
  'com.atproto.syncGetRoot': {
    lexicon: 1,
    id: 'com.atproto.syncGetRoot',
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
  'com.atproto.syncUpdateRepo': {
    lexicon: 1,
    id: 'com.atproto.syncUpdateRepo',
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
  'app.bsky.getAuthorFeed': {
    lexicon: 1,
    id: 'app.bsky.getAuthorFeed',
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
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
  'app.bsky.getBadgeMembers': {
    lexicon: 1,
    id: 'app.bsky.getBadgeMembers',
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
        required: ['uri', 'members'],
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
          members: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'acceptedAt', 'offeredAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                offeredAt: {
                  type: 'string',
                  format: 'date-time',
                },
                acceptedAt: {
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
  'app.bsky.getHomeFeed': {
    lexicon: 1,
    id: 'app.bsky.getHomeFeed',
    type: 'query',
    description: "A view of the user's home feed",
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
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
  'app.bsky.getLikedBy': {
    lexicon: 1,
    id: 'app.bsky.getLikedBy',
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
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.getNotificationCount': {
    lexicon: 1,
    id: 'app.bsky.getNotificationCount',
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
  'app.bsky.getNotifications': {
    lexicon: 1,
    id: 'app.bsky.getNotifications',
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
                required: ['did', 'name'],
                properties: {
                  did: {
                    type: 'string',
                  },
                  name: {
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
                  "Expected values are 'like', 'repost', 'follow', 'badge', 'invite', 'mention' and 'reply'.",
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
              "Expected values are 'like', 'repost', 'follow', 'badge', 'invite', 'mention' and 'reply'.",
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
  'app.bsky.getPostThread': {
    lexicon: 1,
    id: 'app.bsky.getPostThread',
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
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
  'app.bsky.getProfile': {
    lexicon: 1,
    id: 'app.bsky.getProfile',
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
          'name',
          'followersCount',
          'followsCount',
          'postsCount',
          'pinnedBadges',
        ],
        properties: {
          did: {
            type: 'string',
          },
          name: {
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
          pinnedBadges: {
            type: 'array',
            items: {
              $ref: '#/$defs/badge',
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
        },
        $defs: {
          badge: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              error: {
                type: 'string',
              },
              issuer: {
                type: 'object',
                required: ['did', 'name'],
                properties: {
                  did: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  displayName: {
                    type: 'string',
                    maxLength: 64,
                  },
                },
              },
              assertion: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                  },
                  tag: {
                    type: 'string',
                    maxLength: 64,
                  },
                },
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      },
    },
    defs: {
      badge: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          error: {
            type: 'string',
          },
          issuer: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          assertion: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
              },
              tag: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  'app.bsky.getRepostedBy': {
    lexicon: 1,
    id: 'app.bsky.getRepostedBy',
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
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.getUserFollowers': {
    lexicon: 1,
    id: 'app.bsky.getUserFollowers',
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.getUserFollows': {
    lexicon: 1,
    id: 'app.bsky.getUserFollows',
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
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
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
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.getUsersSearch': {
    lexicon: 1,
    id: 'app.bsky.getUsersSearch',
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
              required: ['did', 'name'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.getUsersTypeahead': {
    lexicon: 1,
    id: 'app.bsky.getUsersTypeahead',
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
              required: ['did', 'name'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
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
  'app.bsky.postNotificationsSeen': {
    lexicon: 1,
    id: 'app.bsky.postNotificationsSeen',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications',
    parameters: {},
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
  'app.bsky.updateProfile': {
    lexicon: 1,
    id: 'app.bsky.updateProfile',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications',
    parameters: {},
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
          pinnedBadges: {
            type: 'array',
            items: {
              $ref: '#/$defs/badgeRef',
            },
          },
        },
        $defs: {
          badgeRef: {
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
}
export const methodSchemas: MethodSchema[] = Object.values(methodSchemaDict)
export const ids = {
  AppBskyBadge: 'app.bsky.badge',
  AppBskyBadgeAccept: 'app.bsky.badgeAccept',
  AppBskyBadgeOffer: 'app.bsky.badgeOffer',
  AppBskyDeclaration: 'app.bsky.declaration',
  AppBskyFollow: 'app.bsky.follow',
  AppBskyInvite: 'app.bsky.invite',
  AppBskyInviteAccept: 'app.bsky.inviteAccept',
  AppBskyLike: 'app.bsky.like',
  AppBskyMediaEmbed: 'app.bsky.mediaEmbed',
  AppBskyPost: 'app.bsky.post',
  AppBskyProfile: 'app.bsky.profile',
  AppBskyRepost: 'app.bsky.repost',
}
export const recordSchemaDict: Record<string, RecordSchema> = {
  'app.bsky.badge': {
    lexicon: 1,
    id: 'app.bsky.badge',
    type: 'record',
    description: 'An assertion about the subject by this user.',
    key: 'tid',
    record: {
      type: 'object',
      required: ['assertion', 'createdAt'],
      properties: {
        assertion: {
          oneOf: [
            {
              $ref: '#/$defs/inviteAssertion',
            },
            {
              $ref: '#/$defs/employeeAssertion',
            },
            {
              $ref: '#/$defs/tagAssertion',
            },
            {
              $ref: '#/$defs/unknownAssertion',
            },
          ],
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        inviteAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              const: 'invite',
            },
          },
        },
        employeeAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              const: 'employee',
            },
          },
        },
        tagAssertion: {
          type: 'object',
          required: ['type', 'tag'],
          properties: {
            type: {
              const: 'tag',
            },
            tag: {
              type: 'string',
              maxLength: 64,
            },
          },
        },
        unknownAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              not: {
                enum: ['invite', 'employee', 'tag'],
              },
            },
          },
        },
      },
    },
    defs: {
      inviteAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            const: 'invite',
          },
        },
      },
      employeeAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            const: 'employee',
          },
        },
      },
      tagAssertion: {
        type: 'object',
        required: ['type', 'tag'],
        properties: {
          type: {
            const: 'tag',
          },
          tag: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      unknownAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            not: {
              enum: ['invite', 'employee', 'tag'],
            },
          },
        },
      },
    },
  },
  'app.bsky.badgeAccept': {
    lexicon: 1,
    id: 'app.bsky.badgeAccept',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['badge', 'offer', 'createdAt'],
      properties: {
        badge: {
          $ref: '#/$defs/subject',
        },
        offer: {
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
  'app.bsky.badgeOffer': {
    lexicon: 1,
    id: 'app.bsky.badgeOffer',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['badge', 'subject', 'createdAt'],
      properties: {
        badge: {
          $ref: '#/$defs/badge',
        },
        subject: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        badge: {
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
      badge: {
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
  'app.bsky.declaration': {
    lexicon: 1,
    id: 'app.bsky.declaration',
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
          enum: ['app.bsky.actorUser', 'app.bsky.actorScene'],
        },
        actorUnknown: {
          type: 'string',
          not: {
            enum: ['app.bsky.actorUser', 'app.bsky.actorScene'],
          },
        },
      },
    },
    defs: {
      actorKnown: {
        type: 'string',
        enum: ['app.bsky.actorUser', 'app.bsky.actorScene'],
      },
      actorUnknown: {
        type: 'string',
        not: {
          enum: ['app.bsky.actorUser', 'app.bsky.actorScene'],
        },
      },
    },
  },
  'app.bsky.follow': {
    lexicon: 1,
    id: 'app.bsky.follow',
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
  'app.bsky.invite': {
    lexicon: 1,
    id: 'app.bsky.invite',
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
  'app.bsky.inviteAccept': {
    lexicon: 1,
    id: 'app.bsky.inviteAccept',
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
  'app.bsky.like': {
    lexicon: 1,
    id: 'app.bsky.like',
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
  'app.bsky.mediaEmbed': {
    lexicon: 1,
    id: 'app.bsky.mediaEmbed',
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
  'app.bsky.post': {
    lexicon: 1,
    id: 'app.bsky.post',
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
          $ref: '#/$defs/entity',
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
          type: 'array',
          items: {
            type: 'object',
            required: ['index', 'type', 'value'],
            properties: {
              index: {
                $ref: '#/$defs/textSlice',
              },
              type: {
                type: 'string',
                $comment:
                  "Expected values are 'mention', 'hashtag', and 'link'.",
              },
              value: {
                type: 'string',
              },
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
        type: 'array',
        items: {
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
  'app.bsky.profile': {
    lexicon: 1,
    id: 'app.bsky.profile',
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
        pinnedBadges: {
          type: 'array',
          items: {
            $ref: '#/$defs/badgeRef',
          },
        },
      },
      $defs: {
        badgeRef: {
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
      badgeRef: {
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
  'app.bsky.repost': {
    lexicon: 1,
    id: 'app.bsky.repost',
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
}
export const recordSchemas: RecordSchema[] = Object.values(recordSchemaDict)
