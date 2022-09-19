/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import { MethodSchema } from '@adxp/xrpc'

export const schemas: MethodSchema[] = [
  {
    xrpc: 1,
    id: 'todo.adx.createAccount',
    type: 'procedure',
    description: 'Create an account.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'did'],
        properties: {
          username: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.createSession',
    type: 'procedure',
    description: 'Create an authentication session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.deleteAccount',
    type: 'procedure',
    description: 'Delete an account.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.deleteSession',
    type: 'procedure',
    description: 'Delete the current session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.getAccount',
    type: 'query',
    description: 'Get information about an account.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.getSession',
    type: 'query',
    description: 'Get information about the current session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoBatchWrite',
    type: 'procedure',
    description: 'Apply a batch transaction of creates, puts, and deletes.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the records?',
        default: true,
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
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'tid', 'value'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'update',
                    },
                    collection: {
                      type: 'string',
                    },
                    tid: {
                      type: 'string',
                    },
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'tid'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'delete',
                    },
                    collection: {
                      type: 'string',
                    },
                    tid: {
                      type: 'string',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
    output: {
      encoding: 'application/json',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoCreateRecord',
    type: 'procedure',
    description: 'Create a new record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the record?',
        default: true,
      },
    },
    input: {
      encoding: 'application/json',
      schema: {},
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoDeleteRecord',
    type: 'procedure',
    description: 'Delete a record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoDescribe',
    type: 'query',
    description:
      'Get information about the repo, including the list of collections.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The username or DID of the repo.',
        required: true,
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoGetRecord',
    type: 'query',
    description: 'Fetch a record.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The name or DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
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
          value: {
            type: 'object',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoListRecords',
    type: 'query',
    description: 'List a range of records in a collection.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The username or DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      limit: {
        type: 'number',
        description: 'The number of records to return. TODO-max number?',
        default: 50,
        minimum: 1,
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
        required: 'records',
        properties: {
          records: {
            type: 'array',
            items: {
              type: 'object',
              required: ['uri', 'value'],
              properties: {
                uri: {
                  type: 'string',
                },
                value: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoPutRecord',
    type: 'procedure',
    description: 'Write a record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the record?',
        default: true,
      },
    },
    input: {
      encoding: 'application/json',
      schema: {},
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.resolveName',
    type: 'query',
    description:
      'Provides the DID of the repo indicated by the Host parameter.',
    parameters: {
      name: {
        type: 'string',
        description: 'The name to resolve.',
        required: true,
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
  {
    xrpc: 1,
    id: 'todo.adx.syncGetRepo',
    type: 'query',
    description: 'Gets the repo state.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
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
  {
    xrpc: 1,
    id: 'todo.adx.syncGetRoot',
    type: 'query',
    description: 'Gets the current root CID of a repo.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
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
  {
    xrpc: 1,
    id: 'todo.adx.syncUpdateRepo',
    type: 'procedure',
    description: 'Writes commits to a repo.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
    },
    input: {
      encoding: 'application/cbor',
    },
  },
]
