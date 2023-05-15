/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from '@atproto/lexicon'

export const schemaDict = {
  ComAtprotoAdminDefs: {
    lexicon: 1,
    id: 'com.atproto.admin.defs',
    defs: {
      actionView: {
        type: 'object',
        required: [
          'id',
          'action',
          'subject',
          'subjectBlobCids',
          'reason',
          'createdBy',
          'createdAt',
          'resolvedReportIds',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionType',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.defs#repoRef',
              'lex:com.atproto.repo.strongRef',
            ],
          },
          subjectBlobCids: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          createLabelVals: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          negateLabelVals: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          reversal: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionReversal',
          },
          resolvedReportIds: {
            type: 'array',
            items: {
              type: 'integer',
            },
          },
        },
      },
      actionViewDetail: {
        type: 'object',
        required: [
          'id',
          'action',
          'subject',
          'subjectBlobs',
          'reason',
          'createdBy',
          'createdAt',
          'resolvedReports',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionType',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.defs#repoView',
              'lex:com.atproto.admin.defs#recordView',
            ],
          },
          subjectBlobs: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#blobView',
            },
          },
          createLabelVals: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          negateLabelVals: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          reversal: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionReversal',
          },
          resolvedReports: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#reportView',
            },
          },
        },
      },
      actionViewCurrent: {
        type: 'object',
        required: ['id', 'action'],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionType',
          },
        },
      },
      actionReversal: {
        type: 'object',
        required: ['reason', 'createdBy', 'createdAt'],
        properties: {
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      actionType: {
        type: 'string',
        knownValues: [
          'lex:com.atproto.admin.defs#takedown',
          'lex:com.atproto.admin.defs#flag',
          'lex:com.atproto.admin.defs#acknowledge',
          'lex:com.atproto.admin.defs#escalate',
        ],
      },
      takedown: {
        type: 'token',
        description:
          'Moderation action type: Takedown. Indicates that content should not be served by the PDS.',
      },
      flag: {
        type: 'token',
        description:
          'Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served.',
      },
      acknowledge: {
        type: 'token',
        description:
          'Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules.',
      },
      escalate: {
        type: 'token',
        description:
          'Moderation action type: Escalate. Indicates that the content has been flagged for additional review.',
      },
      reportView: {
        type: 'object',
        required: [
          'id',
          'reasonType',
          'subject',
          'reportedBy',
          'createdAt',
          'resolvedByActionIds',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          reasonType: {
            type: 'ref',
            ref: 'lex:com.atproto.moderation.defs#reasonType',
          },
          reason: {
            type: 'string',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.defs#repoRef',
              'lex:com.atproto.repo.strongRef',
            ],
          },
          reportedBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          resolvedByActionIds: {
            type: 'array',
            items: {
              type: 'integer',
            },
          },
        },
      },
      reportViewDetail: {
        type: 'object',
        required: [
          'id',
          'reasonType',
          'subject',
          'reportedBy',
          'createdAt',
          'resolvedByActions',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          reasonType: {
            type: 'ref',
            ref: 'lex:com.atproto.moderation.defs#reasonType',
          },
          reason: {
            type: 'string',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.defs#repoView',
              'lex:com.atproto.admin.defs#recordView',
            ],
          },
          reportedBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          resolvedByActions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#actionView',
            },
          },
        },
      },
      repoView: {
        type: 'object',
        required: [
          'did',
          'handle',
          'relatedRecords',
          'indexedAt',
          'moderation',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          email: {
            type: 'string',
          },
          relatedRecords: {
            type: 'array',
            items: {
              type: 'unknown',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#moderation',
          },
          invitedBy: {
            type: 'ref',
            ref: 'lex:com.atproto.server.defs#inviteCode',
          },
          invitesDisabled: {
            type: 'boolean',
          },
        },
      },
      repoViewDetail: {
        type: 'object',
        required: [
          'did',
          'handle',
          'relatedRecords',
          'indexedAt',
          'moderation',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          email: {
            type: 'string',
          },
          relatedRecords: {
            type: 'array',
            items: {
              type: 'unknown',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#moderationDetail',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
          invitedBy: {
            type: 'ref',
            ref: 'lex:com.atproto.server.defs#inviteCode',
          },
          invites: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.server.defs#inviteCode',
            },
          },
          invitesDisabled: {
            type: 'boolean',
          },
        },
      },
      repoRef: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      recordView: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'value',
          'blobCids',
          'indexedAt',
          'moderation',
          'repo',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
          blobCids: {
            type: 'array',
            items: {
              type: 'string',
              format: 'cid',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#moderation',
          },
          repo: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#repoView',
          },
        },
      },
      recordViewDetail: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'value',
          'blobs',
          'indexedAt',
          'moderation',
          'repo',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
          blobs: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#blobView',
            },
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#moderationDetail',
          },
          repo: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#repoView',
          },
        },
      },
      moderation: {
        type: 'object',
        required: [],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionViewCurrent',
          },
        },
      },
      moderationDetail: {
        type: 'object',
        required: ['actions', 'reports'],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionViewCurrent',
          },
          actions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#actionView',
            },
          },
          reports: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.defs#reportView',
            },
          },
        },
      },
      blobView: {
        type: 'object',
        required: ['cid', 'mimeType', 'size', 'createdAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          mimeType: {
            type: 'string',
          },
          size: {
            type: 'integer',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          details: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.defs#imageDetails',
              'lex:com.atproto.admin.defs#videoDetails',
            ],
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#moderation',
          },
        },
      },
      imageDetails: {
        type: 'object',
        required: ['width', 'height'],
        properties: {
          width: {
            type: 'integer',
          },
          height: {
            type: 'integer',
          },
        },
      },
      videoDetails: {
        type: 'object',
        required: ['width', 'height', 'length'],
        properties: {
          width: {
            type: 'integer',
          },
          height: {
            type: 'integer',
          },
          length: {
            type: 'integer',
          },
        },
      },
    },
  },
  ComAtprotoAdminDisableAccountInvites: {
    lexicon: 1,
    id: 'com.atproto.admin.disableAccountInvites',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Disable an account from receiving new invite codes, but does not invalidate existing codes',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['account'],
            properties: {
              account: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminDisableInviteCodes: {
    lexicon: 1,
    id: 'com.atproto.admin.disableInviteCodes',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Disable some set of codes and/or all codes associated with a set of users',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              codes: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              accounts: {
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
  ComAtprotoAdminEnableAccountInvites: {
    lexicon: 1,
    id: 'com.atproto.admin.enableAccountInvites',
    defs: {
      main: {
        type: 'procedure',
        description: 'Re-enable an accounts ability to receive invite codes',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['account'],
            properties: {
              account: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetInviteCodes: {
    lexicon: 1,
    id: 'com.atproto.admin.getInviteCodes',
    defs: {
      main: {
        type: 'query',
        description: 'Admin view of invite codes',
        parameters: {
          type: 'params',
          properties: {
            sort: {
              type: 'string',
              knownValues: ['recent', 'usage'],
              default: 'recent',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 500,
              default: 100,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['codes'],
            properties: {
              cursor: {
                type: 'string',
              },
              codes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.server.defs#inviteCode',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationAction',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a moderation action.',
        parameters: {
          type: 'params',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionViewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationActions: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationActions',
    defs: {
      main: {
        type: 'query',
        description: 'List moderation actions related to a subject.',
        parameters: {
          type: 'params',
          properties: {
            subject: {
              type: 'string',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actions'],
            properties: {
              cursor: {
                type: 'string',
              },
              actions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.defs#actionView',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationReport: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationReport',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a moderation report.',
        parameters: {
          type: 'params',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#reportViewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationReports: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationReports',
    defs: {
      main: {
        type: 'query',
        description: 'List moderation reports related to a subject.',
        parameters: {
          type: 'params',
          properties: {
            subject: {
              type: 'string',
            },
            resolved: {
              type: 'boolean',
            },
            actionType: {
              type: 'string',
              knownValues: [
                'com.atproto.admin.defs#takedown',
                'com.atproto.admin.defs#flag',
                'com.atproto.admin.defs#acknowledge',
                'com.atproto.admin.defs#escalate',
              ],
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['reports'],
            properties: {
              cursor: {
                type: 'string',
              },
              reports: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.defs#reportView',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetRecord: {
    lexicon: 1,
    id: 'com.atproto.admin.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a record.',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#recordViewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetRepo: {
    lexicon: 1,
    id: 'com.atproto.admin.getRepo',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a repository.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#repoViewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminResolveModerationReports: {
    lexicon: 1,
    id: 'com.atproto.admin.resolveModerationReports',
    defs: {
      main: {
        type: 'procedure',
        description: 'Resolve moderation reports by an action.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actionId', 'reportIds', 'createdBy'],
            properties: {
              actionId: {
                type: 'integer',
              },
              reportIds: {
                type: 'array',
                items: {
                  type: 'integer',
                },
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionView',
          },
        },
      },
    },
  },
  ComAtprotoAdminReverseModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.reverseModerationAction',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reverse a moderation action.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['id', 'reason', 'createdBy'],
            properties: {
              id: {
                type: 'integer',
              },
              reason: {
                type: 'string',
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionView',
          },
        },
      },
    },
  },
  ComAtprotoAdminSearchRepos: {
    lexicon: 1,
    id: 'com.atproto.admin.searchRepos',
    defs: {
      main: {
        type: 'query',
        description: 'Find repositories based on a search term.',
        parameters: {
          type: 'params',
          properties: {
            term: {
              type: 'string',
            },
            invitedBy: {
              type: 'string',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repos'],
            properties: {
              cursor: {
                type: 'string',
              },
              repos: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.defs#repoView',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminTakeModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.takeModerationAction',
    defs: {
      main: {
        type: 'procedure',
        description: 'Take a moderation action on a repo.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['action', 'subject', 'reason', 'createdBy'],
            properties: {
              action: {
                type: 'string',
                knownValues: [
                  'com.atproto.admin.defs#takedown',
                  'com.atproto.admin.defs#flag',
                  'com.atproto.admin.defs#acknowledge',
                ],
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.admin.defs#repoRef',
                  'lex:com.atproto.repo.strongRef',
                ],
              },
              subjectBlobCids: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
              createLabelVals: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              negateLabelVals: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              reason: {
                type: 'string',
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.defs#actionView',
          },
        },
        errors: [
          {
            name: 'SubjectHasAction',
          },
        ],
      },
    },
  },
  ComAtprotoAdminUpdateAccountEmail: {
    lexicon: 1,
    id: 'com.atproto.admin.updateAccountEmail',
    defs: {
      main: {
        type: 'procedure',
        description: "Administrative action to update an account's email",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['account', 'email'],
            properties: {
              account: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              email: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminUpdateAccountHandle: {
    lexicon: 1,
    id: 'com.atproto.admin.updateAccountHandle',
    defs: {
      main: {
        type: 'procedure',
        description: "Administrative action to update an account's handle",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'handle'],
            properties: {
              did: {
                type: 'string',
                format: 'did',
              },
              handle: {
                type: 'string',
                format: 'handle',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoIdentityResolveHandle: {
    lexicon: 1,
    id: 'com.atproto.identity.resolveHandle',
    defs: {
      main: {
        type: 'query',
        description: 'Provides the DID of a repo.',
        parameters: {
          type: 'params',
          properties: {
            handle: {
              type: 'string',
              format: 'handle',
              description:
                "The handle to resolve. If not supplied, will resolve the host's own handle.",
            },
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
                format: 'did',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoIdentityUpdateHandle: {
    lexicon: 1,
    id: 'com.atproto.identity.updateHandle',
    defs: {
      main: {
        type: 'procedure',
        description: 'Updates the handle of the account',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle'],
            properties: {
              handle: {
                type: 'string',
                format: 'handle',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoLabelDefs: {
    lexicon: 1,
    id: 'com.atproto.label.defs',
    defs: {
      label: {
        type: 'object',
        description: 'Metadata tag on an atproto resource (eg, repo or record)',
        required: ['src', 'uri', 'val', 'cts'],
        properties: {
          src: {
            type: 'string',
            format: 'did',
            description: 'DID of the actor who created this label',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description:
              'AT URI of the record, repository (account), or other resource which this label applies to',
          },
          cid: {
            type: 'string',
            format: 'cid',
            description:
              "optionally, CID specifying the specific version of 'uri' resource this label applies to",
          },
          val: {
            type: 'string',
            maxLength: 128,
            description:
              'the short string name of the value or type of this label',
          },
          neg: {
            type: 'boolean',
            description:
              'if true, this is a negation label, overwriting a previous label',
          },
          cts: {
            type: 'string',
            format: 'datetime',
            description: 'timestamp when this label was created',
          },
        },
      },
    },
  },
  ComAtprotoLabelQueryLabels: {
    lexicon: 1,
    id: 'com.atproto.label.queryLabels',
    defs: {
      main: {
        type: 'query',
        description: 'Find labels relevant to the provided URI patterns.',
        parameters: {
          type: 'params',
          required: ['uriPatterns'],
          properties: {
            uriPatterns: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "List of AT URI patterns to match (boolean 'OR'). Each may be a prefix (ending with '*'; will match inclusive of the string leading to '*'), or a full URI",
            },
            sources: {
              type: 'array',
              items: {
                type: 'string',
                format: 'did',
              },
              description: 'Optional list of label sources (DIDs) to filter on',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 250,
              default: 50,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['labels'],
            properties: {
              cursor: {
                type: 'string',
              },
              labels: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.label.defs#label',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoLabelSubscribeLabels: {
    lexicon: 1,
    id: 'com.atproto.label.subscribeLabels',
    defs: {
      main: {
        type: 'subscription',
        description: 'Subscribe to label updates',
        parameters: {
          type: 'params',
          properties: {
            cursor: {
              type: 'integer',
              description: 'The last known event to backfill from.',
            },
          },
        },
        message: {
          schema: {
            type: 'union',
            refs: [
              'lex:com.atproto.label.subscribeLabels#labels',
              'lex:com.atproto.label.subscribeLabels#info',
            ],
          },
        },
        errors: [
          {
            name: 'FutureCursor',
          },
        ],
      },
      labels: {
        type: 'object',
        required: ['seq', 'labels'],
        properties: {
          seq: {
            type: 'integer',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
      info: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            knownValues: ['OutdatedCursor'],
          },
          message: {
            type: 'string',
          },
        },
      },
    },
  },
  ComAtprotoModerationCreateReport: {
    lexicon: 1,
    id: 'com.atproto.moderation.createReport',
    defs: {
      main: {
        type: 'procedure',
        description: 'Report a repo or a record.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['reasonType', 'subject'],
            properties: {
              reasonType: {
                type: 'ref',
                ref: 'lex:com.atproto.moderation.defs#reasonType',
              },
              reason: {
                type: 'string',
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.admin.defs#repoRef',
                  'lex:com.atproto.repo.strongRef',
                ],
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'id',
              'reasonType',
              'subject',
              'reportedBy',
              'createdAt',
            ],
            properties: {
              id: {
                type: 'integer',
              },
              reasonType: {
                type: 'ref',
                ref: 'lex:com.atproto.moderation.defs#reasonType',
              },
              reason: {
                type: 'string',
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.admin.defs#repoRef',
                  'lex:com.atproto.repo.strongRef',
                ],
              },
              reportedBy: {
                type: 'string',
                format: 'did',
              },
              createdAt: {
                type: 'string',
                format: 'datetime',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoModerationDefs: {
    lexicon: 1,
    id: 'com.atproto.moderation.defs',
    defs: {
      reasonType: {
        type: 'string',
        knownValues: [
          'com.atproto.moderation.defs#reasonSpam',
          'com.atproto.moderation.defs#reasonViolation',
          'com.atproto.moderation.defs#reasonMisleading',
          'com.atproto.moderation.defs#reasonSexual',
          'com.atproto.moderation.defs#reasonRude',
          'com.atproto.moderation.defs#reasonOther',
        ],
      },
      reasonSpam: {
        type: 'token',
        description: 'Spam: frequent unwanted promotion, replies, mentions',
      },
      reasonViolation: {
        type: 'token',
        description: 'Direct violation of server rules, laws, terms of service',
      },
      reasonMisleading: {
        type: 'token',
        description: 'Misleading identity, affiliation, or content',
      },
      reasonSexual: {
        type: 'token',
        description: 'Unwanted or mis-labeled sexual content',
      },
      reasonRude: {
        type: 'token',
        description:
          'Rude, harassing, explicit, or otherwise unwelcoming behavior',
      },
      reasonOther: {
        type: 'token',
        description: 'Other: reports not falling under another report category',
      },
    },
  },
  ComAtprotoRepoApplyWrites: {
    lexicon: 1,
    id: 'com.atproto.repo.applyWrites',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Apply a batch transaction of creates, updates, and deletes.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'writes'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              validate: {
                type: 'boolean',
                default: true,
                description: 'Validate the records?',
              },
              writes: {
                type: 'array',
                items: {
                  type: 'union',
                  refs: [
                    'lex:com.atproto.repo.applyWrites#create',
                    'lex:com.atproto.repo.applyWrites#update',
                    'lex:com.atproto.repo.applyWrites#delete',
                  ],
                  closed: true,
                },
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
      create: {
        type: 'object',
        description: 'Create a new record.',
        required: ['action', 'collection', 'value'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
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
        description: 'Update an existing record.',
        required: ['action', 'collection', 'rkey', 'value'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
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
        description: 'Delete an existing record.',
        required: ['action', 'collection', 'rkey'],
        properties: {
          collection: {
            type: 'string',
            format: 'nsid',
          },
          rkey: {
            type: 'string',
          },
        },
      },
    },
  },
  ComAtprotoRepoCreateRecord: {
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
            required: ['repo', 'collection', 'record'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                description: 'The key of the record.',
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
              swapCommit: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous commit by cid.',
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoDeleteRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
    defs: {
      main: {
        type: 'procedure',
        description: "Delete a record, or ensure it doesn't exist.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'collection', 'rkey'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                description: 'The key of the record.',
              },
              swapRecord: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous record by cid.',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous commit by cid.',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoDescribeRepo: {
    lexicon: 1,
    id: 'com.atproto.repo.describeRepo',
    defs: {
      main: {
        type: 'query',
        description:
          'Get information about the repo, including the list of collections.',
        parameters: {
          type: 'params',
          required: ['repo'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
              },
              didDoc: {
                type: 'unknown',
              },
              collections: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'nsid',
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
  ComAtprotoRepoGetRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'Get a record.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection', 'rkey'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              format: 'nsid',
              description: 'The NSID of the record collection.',
            },
            rkey: {
              type: 'string',
              description: 'The key of the record.',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description:
                'The CID of the version of the record. If not specified, then return the most recent version.',
            },
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
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
  ComAtprotoRepoListRecords: {
    lexicon: 1,
    id: 'com.atproto.repo.listRecords',
    defs: {
      main: {
        type: 'query',
        description: 'List a range of records in a collection.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection'],
          properties: {
            repo: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              format: 'nsid',
              description: 'The NSID of the record type.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'The number of records to return.',
            },
            cursor: {
              type: 'string',
            },
            rkeyStart: {
              type: 'string',
              description:
                'DEPRECATED: The lowest sort-ordered rkey to start from (exclusive)',
            },
            rkeyEnd: {
              type: 'string',
              description:
                'DEPRECATED: The highest sort-ordered rkey to stop at (exclusive)',
            },
            reverse: {
              type: 'boolean',
              description: 'Reverse the order of the returned records?',
            },
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
                  type: 'ref',
                  ref: 'lex:com.atproto.repo.listRecords#record',
                },
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
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
        },
      },
    },
  },
  ComAtprotoRepoPutRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
    defs: {
      main: {
        type: 'procedure',
        description: 'Write a record, creating or updating it as needed.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo', 'collection', 'rkey', 'record'],
            nullable: ['swapRecord'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              collection: {
                type: 'string',
                format: 'nsid',
                description: 'The NSID of the record collection.',
              },
              rkey: {
                type: 'string',
                description: 'The key of the record.',
              },
              validate: {
                type: 'boolean',
                default: true,
                description: 'Validate the record?',
              },
              record: {
                type: 'unknown',
                description: 'The record to write.',
              },
              swapRecord: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous record by cid.',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous commit by cid.',
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoRebaseRepo: {
    lexicon: 1,
    id: 'com.atproto.repo.rebaseRepo',
    defs: {
      main: {
        type: 'procedure',
        description: 'Simple rebase of repo that deletes history',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repo'],
            properties: {
              repo: {
                type: 'string',
                format: 'at-identifier',
                description: 'The handle or DID of the repo.',
              },
              swapCommit: {
                type: 'string',
                format: 'cid',
                description:
                  'Compare and swap with the previous commit by cid.',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidSwap',
          },
        ],
      },
    },
  },
  ComAtprotoRepoStrongRef: {
    lexicon: 1,
    id: 'com.atproto.repo.strongRef',
    description: 'A URI with a content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  ComAtprotoRepoUploadBlob: {
    lexicon: 1,
    id: 'com.atproto.repo.uploadBlob',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Upload a new blob to be added to repo in a later request.',
        input: {
          encoding: '*/*',
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['blob'],
            properties: {
              blob: {
                type: 'blob',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoServerCreateAccount: {
    lexicon: 1,
    id: 'com.atproto.server.createAccount',
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
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
          {
            name: 'UnsupportedDomain',
          },
          {
            name: 'UnresolvableDid',
          },
          {
            name: 'IncompatibleDidDoc',
          },
        ],
      },
    },
  },
  ComAtprotoServerCreateAppPassword: {
    lexicon: 1,
    id: 'com.atproto.server.createAppPassword',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an app-specific password.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.server.createAppPassword#appPassword',
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
      appPassword: {
        type: 'object',
        required: ['name', 'password', 'createdAt'],
        properties: {
          name: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  ComAtprotoServerCreateInviteCode: {
    lexicon: 1,
    id: 'com.atproto.server.createInviteCode',
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
              forAccount: {
                type: 'string',
                format: 'did',
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
  ComAtprotoServerCreateInviteCodes: {
    lexicon: 1,
    id: 'com.atproto.server.createInviteCodes',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an invite code.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['codeCount', 'useCount'],
            properties: {
              codeCount: {
                type: 'integer',
                default: 1,
              },
              useCount: {
                type: 'integer',
              },
              forAccounts: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'did',
                },
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['codes'],
            properties: {
              codes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.server.createInviteCodes#accountCodes',
                },
              },
            },
          },
        },
      },
      accountCodes: {
        type: 'object',
        required: ['account', 'codes'],
        properties: {
          account: {
            type: 'string',
          },
          codes: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
  },
  ComAtprotoServerCreateSession: {
    lexicon: 1,
    id: 'com.atproto.server.createSession',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an authentication session.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['identifier', 'password'],
            properties: {
              identifier: {
                type: 'string',
                description:
                  'Handle or other identifier supported by the server for the authenticating user.',
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
              },
              email: {
                type: 'string',
              },
            },
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
    },
  },
  ComAtprotoServerDefs: {
    lexicon: 1,
    id: 'com.atproto.server.defs',
    defs: {
      inviteCode: {
        type: 'object',
        required: [
          'code',
          'available',
          'disabled',
          'forAccount',
          'createdBy',
          'createdAt',
          'uses',
        ],
        properties: {
          code: {
            type: 'string',
          },
          available: {
            type: 'integer',
          },
          disabled: {
            type: 'boolean',
          },
          forAccount: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          uses: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.server.defs#inviteCodeUse',
            },
          },
        },
      },
      inviteCodeUse: {
        type: 'object',
        required: ['usedBy', 'usedAt'],
        properties: {
          usedBy: {
            type: 'string',
            format: 'did',
          },
          usedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  ComAtprotoServerDeleteAccount: {
    lexicon: 1,
    id: 'com.atproto.server.deleteAccount',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete a user account with a token and password.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'password', 'token'],
            properties: {
              did: {
                type: 'string',
                format: 'did',
              },
              password: {
                type: 'string',
              },
              token: {
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
  ComAtprotoServerDeleteSession: {
    lexicon: 1,
    id: 'com.atproto.server.deleteSession',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete the current session.',
      },
    },
  },
  ComAtprotoServerDescribeServer: {
    lexicon: 1,
    id: 'com.atproto.server.describeServer',
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
              links: {
                type: 'ref',
                ref: 'lex:com.atproto.server.describeServer#links',
              },
            },
          },
        },
      },
      links: {
        type: 'object',
        properties: {
          privacyPolicy: {
            type: 'string',
          },
          termsOfService: {
            type: 'string',
          },
        },
      },
    },
  },
  ComAtprotoServerGetAccountInviteCodes: {
    lexicon: 1,
    id: 'com.atproto.server.getAccountInviteCodes',
    defs: {
      main: {
        type: 'query',
        description: 'Get all invite codes for a given account',
        parameters: {
          type: 'params',
          properties: {
            includeUsed: {
              type: 'boolean',
              default: true,
            },
            createAvailable: {
              type: 'boolean',
              default: true,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['codes'],
            properties: {
              codes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.server.defs#inviteCode',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'DuplicateCreate',
          },
        ],
      },
    },
  },
  ComAtprotoServerGetSession: {
    lexicon: 1,
    id: 'com.atproto.server.getSession',
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
              },
              email: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoServerListAppPasswords: {
    lexicon: 1,
    id: 'com.atproto.server.listAppPasswords',
    defs: {
      main: {
        type: 'query',
        description: 'List all app-specific passwords.',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['passwords'],
            properties: {
              passwords: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.server.listAppPasswords#appPassword',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
      appPassword: {
        type: 'object',
        required: ['name', 'createdAt'],
        properties: {
          name: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  ComAtprotoServerRefreshSession: {
    lexicon: 1,
    id: 'com.atproto.server.refreshSession',
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
                format: 'handle',
              },
              did: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
    },
  },
  ComAtprotoServerRequestAccountDelete: {
    lexicon: 1,
    id: 'com.atproto.server.requestAccountDelete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Initiate a user account deletion via email.',
      },
    },
  },
  ComAtprotoServerRequestPasswordReset: {
    lexicon: 1,
    id: 'com.atproto.server.requestPasswordReset',
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
  ComAtprotoServerResetPassword: {
    lexicon: 1,
    id: 'com.atproto.server.resetPassword',
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
  ComAtprotoServerRevokeAppPassword: {
    lexicon: 1,
    id: 'com.atproto.server.revokeAppPassword',
    defs: {
      main: {
        type: 'procedure',
        description: 'Revoke an app-specific password by name.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncGetBlob: {
    lexicon: 1,
    id: 'com.atproto.sync.getBlob',
    defs: {
      main: {
        type: 'query',
        description: 'Get a blob associated with a given repo.',
        parameters: {
          type: 'params',
          required: ['did', 'cid'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description: 'The CID of the blob to fetch',
            },
          },
        },
        output: {
          encoding: '*/*',
        },
      },
    },
  },
  ComAtprotoSyncGetBlocks: {
    lexicon: 1,
    id: 'com.atproto.sync.getBlocks',
    defs: {
      main: {
        type: 'query',
        description: 'Gets blocks from a given repo.',
        parameters: {
          type: 'params',
          required: ['did', 'cids'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            cids: {
              type: 'array',
              items: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetCheckout: {
    lexicon: 1,
    id: 'com.atproto.sync.getCheckout',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the repo state.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            commit: {
              type: 'string',
              format: 'cid',
              description:
                'The commit to get the checkout from. Defaults to current HEAD.',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetCommitPath: {
    lexicon: 1,
    id: 'com.atproto.sync.getCommitPath',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the path of repo commits',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            latest: {
              type: 'string',
              format: 'cid',
              description: 'The most recent commit',
            },
            earliest: {
              type: 'string',
              format: 'cid',
              description: 'The earliest commit to start from',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['commits'],
            properties: {
              commits: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncGetHead: {
    lexicon: 1,
    id: 'com.atproto.sync.getHead',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the current HEAD CID of a repo.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
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
                format: 'cid',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncGetRecord: {
    lexicon: 1,
    id: 'com.atproto.sync.getRecord',
    defs: {
      main: {
        type: 'query',
        description:
          'Gets blocks needed for existence or non-existence of record.',
        parameters: {
          type: 'params',
          required: ['did', 'collection', 'rkey'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            collection: {
              type: 'string',
              format: 'nsid',
            },
            rkey: {
              type: 'string',
            },
            commit: {
              type: 'string',
              format: 'cid',
              description: 'An optional past commit CID.',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetRepo: {
    lexicon: 1,
    id: 'com.atproto.sync.getRepo',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the repo state.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            earliest: {
              type: 'string',
              format: 'cid',
              description:
                'The earliest commit in the commit range (not inclusive)',
            },
            latest: {
              type: 'string',
              format: 'cid',
              description: 'The latest commit in the commit range (inclusive)',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncListBlobs: {
    lexicon: 1,
    id: 'com.atproto.sync.listBlobs',
    defs: {
      main: {
        type: 'query',
        description: 'List blob cids for some range of commits',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            latest: {
              type: 'string',
              format: 'cid',
              description: 'The most recent commit',
            },
            earliest: {
              type: 'string',
              format: 'cid',
              description: 'The earliest commit to start from',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['cids'],
            properties: {
              cids: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncListRepos: {
    lexicon: 1,
    id: 'com.atproto.sync.listRepos',
    defs: {
      main: {
        type: 'query',
        description: 'List dids and root cids of hosted repos',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              default: 500,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['repos'],
            properties: {
              cursor: {
                type: 'string',
              },
              repos: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.sync.listRepos#repo',
                },
              },
            },
          },
        },
      },
      repo: {
        type: 'object',
        required: ['did', 'head'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          head: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  ComAtprotoSyncNotifyOfUpdate: {
    lexicon: 1,
    id: 'com.atproto.sync.notifyOfUpdate',
    defs: {
      main: {
        type: 'query',
        description:
          'Notify a crawling service of a recent update. Often when a long break between updates causes the connection with the crawling service to break.',
        parameters: {
          type: 'params',
          required: ['hostname'],
          properties: {
            hostname: {
              type: 'string',
              description:
                'Hostname of the service that is notifying of update.',
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncRequestCrawl: {
    lexicon: 1,
    id: 'com.atproto.sync.requestCrawl',
    defs: {
      main: {
        type: 'query',
        description: 'Request a service to persistently crawl hosted repos.',
        parameters: {
          type: 'params',
          required: ['hostname'],
          properties: {
            hostname: {
              type: 'string',
              description:
                'Hostname of the service that is requesting to be crawled.',
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncSubscribeRepos: {
    lexicon: 1,
    id: 'com.atproto.sync.subscribeRepos',
    defs: {
      main: {
        type: 'subscription',
        description: 'Subscribe to repo updates',
        parameters: {
          type: 'params',
          properties: {
            cursor: {
              type: 'integer',
              description: 'The last known event to backfill from.',
            },
          },
        },
        message: {
          schema: {
            type: 'union',
            refs: [
              'lex:com.atproto.sync.subscribeRepos#commit',
              'lex:com.atproto.sync.subscribeRepos#handle',
              'lex:com.atproto.sync.subscribeRepos#migrate',
              'lex:com.atproto.sync.subscribeRepos#tombstone',
              'lex:com.atproto.sync.subscribeRepos#info',
            ],
          },
        },
        errors: [
          {
            name: 'FutureCursor',
          },
        ],
      },
      commit: {
        type: 'object',
        required: [
          'seq',
          'rebase',
          'tooBig',
          'repo',
          'commit',
          'prev',
          'blocks',
          'ops',
          'blobs',
          'time',
        ],
        nullable: ['prev'],
        properties: {
          seq: {
            type: 'integer',
          },
          rebase: {
            type: 'boolean',
          },
          tooBig: {
            type: 'boolean',
          },
          repo: {
            type: 'string',
            format: 'did',
          },
          commit: {
            type: 'cid-link',
          },
          prev: {
            type: 'cid-link',
          },
          blocks: {
            type: 'bytes',
            description: 'CAR file containing relevant blocks',
            maxLength: 1000000,
          },
          ops: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.sync.subscribeRepos#repoOp',
            },
            maxLength: 200,
          },
          blobs: {
            type: 'array',
            items: {
              type: 'cid-link',
            },
          },
          time: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      handle: {
        type: 'object',
        required: ['seq', 'did', 'handle', 'time'],
        properties: {
          seq: {
            type: 'integer',
          },
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          time: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      migrate: {
        type: 'object',
        required: ['seq', 'did', 'migrateTo', 'time'],
        nullable: ['migrateTo'],
        properties: {
          seq: {
            type: 'integer',
          },
          did: {
            type: 'string',
            format: 'did',
          },
          migrateTo: {
            type: 'string',
          },
          time: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      tombstone: {
        type: 'object',
        required: ['seq', 'did', 'time'],
        properties: {
          seq: {
            type: 'integer',
          },
          did: {
            type: 'string',
            format: 'did',
          },
          time: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      info: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            knownValues: ['OutdatedCursor'],
          },
          message: {
            type: 'string',
          },
        },
      },
      repoOp: {
        type: 'object',
        required: ['action', 'path', 'cid'],
        nullable: ['cid'],
        properties: {
          action: {
            type: 'string',
            knownValues: ['create', 'update', 'delete'],
          },
          path: {
            type: 'string',
          },
          cid: {
            type: 'cid-link',
          },
        },
      },
    },
  },
  AppBskyActorDefs: {
    lexicon: 1,
    id: 'app.bsky.actor.defs',
    description: 'A reference to an actor in the network.',
    defs: {
      profileViewBasic: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          avatar: {
            type: 'string',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#viewerState',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
      profileView: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          description: {
            type: 'string',
            maxGraphemes: 256,
            maxLength: 2560,
          },
          avatar: {
            type: 'string',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#viewerState',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
      profileViewDetailed: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          description: {
            type: 'string',
            maxGraphemes: 256,
            maxLength: 2560,
          },
          avatar: {
            type: 'string',
          },
          banner: {
            type: 'string',
          },
          followersCount: {
            type: 'integer',
          },
          followsCount: {
            type: 'integer',
          },
          postsCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#viewerState',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
          mutedByList: {
            type: 'ref',
            ref: 'lex:app.bsky.graph.defs#listViewBasic',
          },
          blockedBy: {
            type: 'boolean',
          },
          blocking: {
            type: 'string',
            format: 'at-uri',
          },
          following: {
            type: 'string',
            format: 'at-uri',
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      preferences: {
        type: 'array',
        items: {
          type: 'union',
          refs: [
            'lex:app.bsky.actor.defs#adultContentPref',
            'lex:app.bsky.actor.defs#contentLabelPref',
          ],
        },
      },
      adultContentPref: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: {
            type: 'boolean',
            default: false,
          },
        },
      },
      contentLabelPref: {
        type: 'object',
        required: ['label', 'visibility'],
        properties: {
          label: {
            type: 'string',
          },
          visibility: {
            type: 'string',
            knownValues: ['show', 'warn', 'hide'],
          },
        },
      },
    },
  },
  AppBskyActorGetPreferences: {
    lexicon: 1,
    id: 'app.bsky.actor.getPreferences',
    defs: {
      main: {
        type: 'query',
        description: 'Get private preferences attached to the account.',
        parameters: {
          type: 'params',
          properties: {},
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['preferences'],
            properties: {
              preferences: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.defs#preferences',
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorGetProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.getProfile',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileViewDetailed',
          },
        },
      },
    },
  },
  AppBskyActorGetProfiles: {
    lexicon: 1,
    id: 'app.bsky.actor.getProfiles',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actors'],
          properties: {
            actors: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-identifier',
              },
              maxLength: 25,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['profiles'],
            properties: {
              profiles: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileViewDetailed',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorGetSuggestions: {
    lexicon: 1,
    id: 'app.bsky.actor.getSuggestions',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a list of actors suggested for following. Used in discovery UIs.',
        parameters: {
          type: 'params',
          properties: {
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
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: 'literal:self',
        record: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: 'string',
              maxGraphemes: 256,
              maxLength: 2560,
            },
            avatar: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            banner: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
          },
        },
      },
    },
  },
  AppBskyActorPutPreferences: {
    lexicon: 1,
    id: 'app.bsky.actor.putPreferences',
    defs: {
      main: {
        type: 'procedure',
        description: 'Sets the private preferences attached to the account.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['preferences'],
            properties: {
              preferences: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.defs#preferences',
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorSearchActors: {
    lexicon: 1,
    id: 'app.bsky.actor.searchActors',
    defs: {
      main: {
        type: 'query',
        description: 'Find actors matching search criteria.',
        parameters: {
          type: 'params',
          properties: {
            term: {
              type: 'string',
            },
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
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorSearchActorsTypeahead: {
    lexicon: 1,
    id: 'app.bsky.actor.searchActorsTypeahead',
    defs: {
      main: {
        type: 'query',
        description: 'Find actor suggestions for a search term.',
        parameters: {
          type: 'params',
          properties: {
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileViewBasic',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyEmbedExternal: {
    lexicon: 1,
    id: 'app.bsky.embed.external',
    description:
      'A representation of some externally linked content, embedded in another form of content',
    defs: {
      main: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.external#external',
          },
        },
      },
      external: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          thumb: {
            type: 'blob',
            accept: ['image/*'],
            maxSize: 1000000,
          },
        },
      },
      view: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.external#viewExternal',
          },
        },
      },
      viewExternal: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          thumb: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyEmbedImages: {
    lexicon: 1,
    id: 'app.bsky.embed.images',
    description: 'A set of images embedded in some other form of content',
    defs: {
      main: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.embed.images#image',
            },
            maxLength: 4,
          },
        },
      },
      image: {
        type: 'object',
        required: ['image', 'alt'],
        properties: {
          image: {
            type: 'blob',
            accept: ['image/*'],
            maxSize: 1000000,
          },
          alt: {
            type: 'string',
          },
        },
      },
      view: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.embed.images#viewImage',
            },
            maxLength: 4,
          },
        },
      },
      viewImage: {
        type: 'object',
        required: ['thumb', 'fullsize', 'alt'],
        properties: {
          thumb: {
            type: 'string',
          },
          fullsize: {
            type: 'string',
          },
          alt: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyEmbedRecord: {
    lexicon: 1,
    id: 'app.bsky.embed.record',
    description:
      'A representation of a record embedded in another form of content',
    defs: {
      main: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
        },
      },
      view: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            type: 'union',
            refs: [
              'lex:app.bsky.embed.record#viewRecord',
              'lex:app.bsky.embed.record#viewNotFound',
              'lex:app.bsky.embed.record#viewBlocked',
              'lex:app.bsky.feed.defs#generatorView',
            ],
          },
        },
      },
      viewRecord: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'value', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
          },
          value: {
            type: 'unknown',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
          embeds: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.embed.images#view',
                'lex:app.bsky.embed.external#view',
                'lex:app.bsky.embed.record#view',
                'lex:app.bsky.embed.recordWithMedia#view',
              ],
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      viewNotFound: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      viewBlocked: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
    },
  },
  AppBskyEmbedRecordWithMedia: {
    lexicon: 1,
    id: 'app.bsky.embed.recordWithMedia',
    description:
      'A representation of a record embedded in another form of content, alongside other compatible embeds',
    defs: {
      main: {
        type: 'object',
        required: ['record', 'media'],
        properties: {
          record: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.record',
          },
          media: {
            type: 'union',
            refs: ['lex:app.bsky.embed.images', 'lex:app.bsky.embed.external'],
          },
        },
      },
      view: {
        type: 'object',
        required: ['record', 'media'],
        properties: {
          record: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.record#view',
          },
          media: {
            type: 'union',
            refs: [
              'lex:app.bsky.embed.images#view',
              'lex:app.bsky.embed.external#view',
            ],
          },
        },
      },
    },
  },
  AppBskyFeedDefs: {
    lexicon: 1,
    id: 'app.bsky.feed.defs',
    defs: {
      postView: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'record', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
          },
          record: {
            type: 'unknown',
          },
          embed: {
            type: 'union',
            refs: [
              'lex:app.bsky.embed.images#view',
              'lex:app.bsky.embed.external#view',
              'lex:app.bsky.embed.record#view',
              'lex:app.bsky.embed.recordWithMedia#view',
            ],
          },
          replyCount: {
            type: 'integer',
          },
          repostCount: {
            type: 'integer',
          },
          likeCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.defs#viewerState',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          repost: {
            type: 'string',
            format: 'at-uri',
          },
          like: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      feedViewPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.defs#postView',
          },
          reply: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.defs#replyRef',
          },
          reason: {
            type: 'union',
            refs: ['lex:app.bsky.feed.defs#reasonRepost'],
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            type: 'union',
            refs: [
              'lex:app.bsky.feed.defs#postView',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
          },
          parent: {
            type: 'union',
            refs: [
              'lex:app.bsky.feed.defs#postView',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
          },
        },
      },
      reasonRepost: {
        type: 'object',
        required: ['by', 'indexedAt'],
        properties: {
          by: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileViewBasic',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      threadViewPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.defs#postView',
          },
          parent: {
            type: 'union',
            refs: [
              'lex:app.bsky.feed.defs#threadViewPost',
              'lex:app.bsky.feed.defs#notFoundPost',
              'lex:app.bsky.feed.defs#blockedPost',
            ],
          },
          replies: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.feed.defs#threadViewPost',
                'lex:app.bsky.feed.defs#notFoundPost',
                'lex:app.bsky.feed.defs#blockedPost',
              ],
            },
          },
        },
      },
      notFoundPost: {
        type: 'object',
        required: ['uri', 'notFound'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          notFound: {
            type: 'boolean',
            const: true,
          },
        },
      },
      blockedPost: {
        type: 'object',
        required: ['uri', 'blocked'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          blocked: {
            type: 'boolean',
            const: true,
          },
        },
      },
      generatorView: {
        type: 'object',
        required: ['uri', 'cid', 'creator', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          did: {
            type: 'string',
            format: 'did',
          },
          creator: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileView',
          },
          displayName: {
            type: 'string',
          },
          description: {
            type: 'string',
            maxGraphemes: 300,
            maxLength: 3000,
          },
          descriptionFacets: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.richtext.facet',
            },
          },
          avatar: {
            type: 'string',
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.defs#generatorViewerState',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      generatorViewerState: {
        type: 'object',
        properties: {
          saved: {
            type: 'boolean',
          },
          like: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      skeletonFeedPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'string',
            format: 'at-uri',
          },
          reason: {
            type: 'union',
            refs: ['lex:app.bsky.feed.defs#skeletonReasonRepost'],
          },
        },
      },
      skeletonReasonRepost: {
        type: 'object',
        required: ['repost'],
        properties: {
          repost: {
            type: 'string',
            ref: 'at-uri',
          },
        },
      },
    },
  },
  AppBskyFeedDescribeFeedGenerator: {
    lexicon: 1,
    id: 'app.bsky.feed.describeFeedGenerator',
    defs: {
      main: {
        type: 'query',
        description:
          'Returns information about a given feed generator including TOS & offered feed URIs',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'feeds'],
            properties: {
              did: {
                type: 'string',
                format: 'did',
              },
              feeds: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.describeFeedGenerator#feed',
                },
              },
              links: {
                type: 'ref',
                ref: 'lex:app.bsky.feed.describeFeedGenerator#links',
              },
            },
          },
        },
      },
      feed: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      links: {
        type: 'object',
        properties: {
          privacyPolicy: {
            type: 'string',
          },
          termsOfService: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyFeedGenerator: {
    lexicon: 1,
    id: 'app.bsky.feed.generator',
    defs: {
      main: {
        type: 'record',
        description: 'A declaration of the existence of a feed generator',
        key: 'any',
        record: {
          type: 'object',
          required: ['did', 'createdAt'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
            },
            displayName: {
              type: 'string',
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: 'string',
              maxGraphemes: 300,
              maxLength: 3000,
            },
            descriptionFacets: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.richtext.facet',
              },
            },
            avatar: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetActorFeeds: {
    lexicon: 1,
    id: 'app.bsky.feed.getActorFeeds',
    defs: {
      main: {
        type: 'query',
        description: 'Retrieve a list of feeds created by a given actor',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feeds'],
            properties: {
              cursor: {
                type: 'string',
              },
              feeds: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#generatorView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetAuthorFeed: {
    lexicon: 1,
    id: 'app.bsky.feed.getAuthorFeed',
    defs: {
      main: {
        type: 'query',
        description: "A view of an actor's feed.",
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'BlockedActor',
          },
          {
            name: 'BlockedByActor',
          },
        ],
      },
    },
  },
  AppBskyFeedGetFeed: {
    lexicon: 1,
    id: 'app.bsky.feed.getFeed',
    defs: {
      main: {
        type: 'query',
        description:
          "Compose and hydrate a feed from a user's selected feed generator",
        parameters: {
          type: 'params',
          required: ['feed'],
          properties: {
            feed: {
              type: 'string',
              format: 'at-uri',
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'UnknownFeed',
          },
        ],
      },
    },
  },
  AppBskyFeedGetFeedGenerator: {
    lexicon: 1,
    id: 'app.bsky.feed.getFeedGenerator',
    defs: {
      main: {
        type: 'query',
        description:
          'Get information about a specific feed offered by a feed generator, such as its online status',
        parameters: {
          type: 'params',
          required: ['feed'],
          properties: {
            feed: {
              type: 'string',
              format: 'at-uri',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['view', 'isOnline', 'isValid'],
            properties: {
              view: {
                type: 'ref',
                ref: 'lex:app.bsky.feed.defs#generatorView',
              },
              isOnline: {
                type: 'boolean',
              },
              isValid: {
                type: 'boolean',
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetFeedSkeleton: {
    lexicon: 1,
    id: 'app.bsky.feed.getFeedSkeleton',
    defs: {
      main: {
        type: 'query',
        description: 'A skeleton of a feed provided by a feed generator',
        parameters: {
          type: 'params',
          required: ['feed'],
          properties: {
            feed: {
              type: 'string',
              format: 'at-uri',
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#skeletonFeedPost',
                },
              },
            },
          },
        },
        errors: [
          {
            name: 'UnknownFeed',
          },
        ],
      },
    },
  },
  AppBskyFeedGetLikes: {
    lexicon: 1,
    id: 'app.bsky.feed.getLikes',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'likes'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              cursor: {
                type: 'string',
              },
              likes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.getLikes#like',
                },
              },
            },
          },
        },
      },
      like: {
        type: 'object',
        required: ['indexedAt', 'createdAt', 'actor'],
        properties: {
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          actor: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileView',
          },
        },
      },
    },
  },
  AppBskyFeedGetPostThread: {
    lexicon: 1,
    id: 'app.bsky.feed.getPostThread',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            depth: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['thread'],
            properties: {
              thread: {
                type: 'union',
                refs: [
                  'lex:app.bsky.feed.defs#threadViewPost',
                  'lex:app.bsky.feed.defs#notFoundPost',
                  'lex:app.bsky.feed.defs#blockedPost',
                ],
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
    },
  },
  AppBskyFeedGetPosts: {
    lexicon: 1,
    id: 'app.bsky.feed.getPosts',
    defs: {
      main: {
        type: 'query',
        description: "A view of an actor's feed.",
        parameters: {
          type: 'params',
          required: ['uris'],
          properties: {
            uris: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              maxLength: 25,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['posts'],
            properties: {
              posts: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#postView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetRepostedBy: {
    lexicon: 1,
    id: 'app.bsky.feed.getRepostedBy',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['uri', 'repostedBy'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              cursor: {
                type: 'string',
              },
              repostedBy: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetSavedFeeds: {
    lexicon: 1,
    id: 'app.bsky.feed.getSavedFeeds',
    defs: {
      main: {
        type: 'query',
        description: "Retrieve a list of the authenticated user's saved feeds",
        parameters: {
          type: 'params',
          properties: {
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feeds'],
            properties: {
              cursor: {
                type: 'string',
              },
              feeds: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#generatorView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetTimeline: {
    lexicon: 1,
    id: 'app.bsky.feed.getTimeline',
    defs: {
      main: {
        type: 'query',
        description: "A view of the user's home timeline.",
        parameters: {
          type: 'params',
          properties: {
            algorithm: {
              type: 'string',
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedLike: {
    lexicon: 1,
    id: 'app.bsky.feed.like',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyFeedPost: {
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
              maxLength: 3000,
              maxGraphemes: 300,
            },
            entities: {
              type: 'array',
              description: 'Deprecated: replaced by app.bsky.richtext.facet.',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.feed.post#entity',
              },
            },
            facets: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.richtext.facet',
              },
            },
            reply: {
              type: 'ref',
              ref: 'lex:app.bsky.feed.post#replyRef',
            },
            embed: {
              type: 'union',
              refs: [
                'lex:app.bsky.embed.images',
                'lex:app.bsky.embed.external',
                'lex:app.bsky.embed.record',
                'lex:app.bsky.embed.recordWithMedia',
              ],
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
          parent: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
        },
      },
      entity: {
        type: 'object',
        description: 'Deprecated: use facets instead.',
        required: ['index', 'type', 'value'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#textSlice',
          },
          type: {
            type: 'string',
            description: "Expected values are 'mention' and 'link'.",
          },
          value: {
            type: 'string',
          },
        },
      },
      textSlice: {
        type: 'object',
        description:
          'Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings.',
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
  AppBskyFeedRepost: {
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
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyFeedSaveFeed: {
    lexicon: 1,
    id: 'app.bsky.feed.saveFeed',
    defs: {
      main: {
        type: 'procedure',
        description: 'Save a 3rd party feed for use across clients',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              feed: {
                type: 'string',
                format: 'at-uri',
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedUnsaveFeed: {
    lexicon: 1,
    id: 'app.bsky.feed.unsaveFeed',
    defs: {
      main: {
        type: 'procedure',
        description: 'Unsave a 3rd party feed',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              feed: {
                type: 'string',
                format: 'at-uri',
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphBlock: {
    lexicon: 1,
    id: 'app.bsky.graph.block',
    defs: {
      main: {
        type: 'record',
        description: 'A block.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyGraphDefs: {
    lexicon: 1,
    id: 'app.bsky.graph.defs',
    defs: {
      listViewBasic: {
        type: 'object',
        required: ['uri', 'creator', 'name', 'purpose'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          name: {
            type: 'string',
            maxLength: 64,
            minLength: 1,
          },
          purpose: {
            type: 'ref',
            ref: 'lex:app.bsky.graph.defs#listPurpose',
          },
          avatar: {
            type: 'string',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.graph.defs#listViewerState',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      listView: {
        type: 'object',
        required: ['uri', 'creator', 'name', 'purpose', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          creator: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileView',
          },
          name: {
            type: 'string',
            maxLength: 64,
            minLength: 1,
          },
          purpose: {
            type: 'ref',
            ref: 'lex:app.bsky.graph.defs#listPurpose',
          },
          description: {
            type: 'string',
            maxGraphemes: 300,
            maxLength: 3000,
          },
          descriptionFacets: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.richtext.facet',
            },
          },
          avatar: {
            type: 'string',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.graph.defs#listViewerState',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      listItemView: {
        type: 'object',
        required: ['subject'],
        properties: {
          subject: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileView',
          },
        },
      },
      listPurpose: {
        type: 'string',
        knownValues: ['app.bsky.graph.defs#modlist'],
      },
      modlist: {
        type: 'token',
        description:
          'A list of actors to apply an aggregate moderation action (mute/block) on',
      },
      listViewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
        },
      },
    },
  },
  AppBskyGraphFollow: {
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
            subject: {
              type: 'string',
              format: 'did',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetBlocks: {
    lexicon: 1,
    id: 'app.bsky.graph.getBlocks',
    defs: {
      main: {
        type: 'query',
        description: "Who is the requester's account blocking?",
        parameters: {
          type: 'params',
          properties: {
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['blocks'],
            properties: {
              cursor: {
                type: 'string',
              },
              blocks: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetFollowers: {
    lexicon: 1,
    id: 'app.bsky.graph.getFollowers',
    defs: {
      main: {
        type: 'query',
        description: 'Who is following an actor?',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'followers'],
            properties: {
              subject: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.defs#profileView',
              },
              cursor: {
                type: 'string',
              },
              followers: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetFollows: {
    lexicon: 1,
    id: 'app.bsky.graph.getFollows',
    defs: {
      main: {
        type: 'query',
        description: 'Who is an actor following?',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'follows'],
            properties: {
              subject: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.defs#profileView',
              },
              cursor: {
                type: 'string',
              },
              follows: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetList: {
    lexicon: 1,
    id: 'app.bsky.graph.getList',
    defs: {
      main: {
        type: 'query',
        description: 'Fetch a list of actors',
        parameters: {
          type: 'params',
          required: ['list'],
          properties: {
            list: {
              type: 'string',
              format: 'at-uri',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['list', 'items'],
            properties: {
              cursor: {
                type: 'string',
              },
              list: {
                type: 'ref',
                ref: 'lex:app.bsky.graph.defs#listView',
              },
              items: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.graph.defs#listItemView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetListMutes: {
    lexicon: 1,
    id: 'app.bsky.graph.getListMutes',
    defs: {
      main: {
        type: 'query',
        description: "Which lists is the requester's account muting?",
        parameters: {
          type: 'params',
          properties: {
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['lists'],
            properties: {
              cursor: {
                type: 'string',
              },
              lists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.graph.defs#listView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetLists: {
    lexicon: 1,
    id: 'app.bsky.graph.getLists',
    defs: {
      main: {
        type: 'query',
        description: 'Fetch a list of lists that belong to an actor',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
            },
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['lists'],
            properties: {
              cursor: {
                type: 'string',
              },
              lists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.graph.defs#listView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetMutes: {
    lexicon: 1,
    id: 'app.bsky.graph.getMutes',
    defs: {
      main: {
        type: 'query',
        description: 'Who does the viewer mute?',
        parameters: {
          type: 'params',
          properties: {
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
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['mutes'],
            properties: {
              cursor: {
                type: 'string',
              },
              mutes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.defs#profileView',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphList: {
    lexicon: 1,
    id: 'app.bsky.graph.list',
    defs: {
      main: {
        type: 'record',
        description: 'A declaration of a list of actors.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'purpose', 'createdAt'],
          properties: {
            purpose: {
              type: 'ref',
              ref: 'lex:app.bsky.graph.defs#listPurpose',
            },
            name: {
              type: 'string',
              maxLength: 64,
              minLength: 1,
            },
            description: {
              type: 'string',
              maxGraphemes: 300,
              maxLength: 3000,
            },
            descriptionFacets: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.richtext.facet',
              },
            },
            avatar: {
              type: 'blob',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyGraphListitem: {
    lexicon: 1,
    id: 'app.bsky.graph.listitem',
    defs: {
      main: {
        type: 'record',
        description: 'An item under a declared list of actors',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'list', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
            },
            list: {
              type: 'string',
              format: 'at-uri',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppBskyGraphMuteActor: {
    lexicon: 1,
    id: 'app.bsky.graph.muteActor',
    defs: {
      main: {
        type: 'procedure',
        description: 'Mute an actor by did or handle.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actor'],
            properties: {
              actor: {
                type: 'string',
                format: 'at-identifier',
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphMuteActorList: {
    lexicon: 1,
    id: 'app.bsky.graph.muteActorList',
    defs: {
      main: {
        type: 'procedure',
        description: 'Mute a list of actors.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['list'],
            properties: {
              list: {
                type: 'string',
                format: 'at-uri',
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphUnmuteActor: {
    lexicon: 1,
    id: 'app.bsky.graph.unmuteActor',
    defs: {
      main: {
        type: 'procedure',
        description: 'Unmute an actor by did or handle.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actor'],
            properties: {
              actor: {
                type: 'string',
                format: 'at-identifier',
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphUnmuteActorList: {
    lexicon: 1,
    id: 'app.bsky.graph.unmuteActorList',
    defs: {
      main: {
        type: 'procedure',
        description: 'Unmute a list of actors.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['list'],
            properties: {
              list: {
                type: 'string',
                format: 'at-uri',
              },
            },
          },
        },
      },
    },
  },
  AppBskyNotificationGetUnreadCount: {
    lexicon: 1,
    id: 'app.bsky.notification.getUnreadCount',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            seenAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
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
  AppBskyNotificationListNotifications: {
    lexicon: 1,
    id: 'app.bsky.notification.listNotifications',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            cursor: {
              type: 'string',
            },
            seenAt: {
              type: 'string',
              format: 'datetime',
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.notification.listNotifications#notification',
                },
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
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.defs#profileView',
          },
          reason: {
            type: 'string',
            description:
              "Expected values are 'like', 'repost', 'follow', 'mention', 'reply', and 'quote'.",
            knownValues: [
              'like',
              'repost',
              'follow',
              'mention',
              'reply',
              'quote',
            ],
          },
          reasonSubject: {
            type: 'string',
            format: 'at-uri',
          },
          record: {
            type: 'unknown',
          },
          isRead: {
            type: 'boolean',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          labels: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.label.defs#label',
            },
          },
        },
      },
    },
  },
  AppBskyNotificationUpdateSeen: {
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
                type: 'string',
                format: 'datetime',
              },
            },
          },
        },
      },
    },
  },
  AppBskyRichtextFacet: {
    lexicon: 1,
    id: 'app.bsky.richtext.facet',
    defs: {
      main: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:app.bsky.richtext.facet#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.richtext.facet#mention',
                'lex:app.bsky.richtext.facet#link',
              ],
            },
          },
        },
      },
      mention: {
        type: 'object',
        description: 'A facet feature for actor mentions.',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      link: {
        type: 'object',
        description: 'A facet feature for links.',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      byteSlice: {
        type: 'object',
        description:
          'A text segment. Start is inclusive, end is exclusive. Indices are for utf8-encoded strings.',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
  AppBskyUnspeccedGetPopular: {
    lexicon: 1,
    id: 'app.bsky.unspecced.getPopular',
    defs: {
      main: {
        type: 'query',
        description: 'An unspecced view of globally popular items',
        parameters: {
          type: 'params',
          properties: {
            includeNsfw: {
              type: 'boolean',
              default: false,
            },
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
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
}
export const schemas: LexiconDoc[] = Object.values(schemaDict) as LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)
export const ids = {
  ComAtprotoAdminDefs: 'com.atproto.admin.defs',
  ComAtprotoAdminDisableAccountInvites:
    'com.atproto.admin.disableAccountInvites',
  ComAtprotoAdminDisableInviteCodes: 'com.atproto.admin.disableInviteCodes',
  ComAtprotoAdminEnableAccountInvites: 'com.atproto.admin.enableAccountInvites',
  ComAtprotoAdminGetInviteCodes: 'com.atproto.admin.getInviteCodes',
  ComAtprotoAdminGetModerationAction: 'com.atproto.admin.getModerationAction',
  ComAtprotoAdminGetModerationActions: 'com.atproto.admin.getModerationActions',
  ComAtprotoAdminGetModerationReport: 'com.atproto.admin.getModerationReport',
  ComAtprotoAdminGetModerationReports: 'com.atproto.admin.getModerationReports',
  ComAtprotoAdminGetRecord: 'com.atproto.admin.getRecord',
  ComAtprotoAdminGetRepo: 'com.atproto.admin.getRepo',
  ComAtprotoAdminResolveModerationReports:
    'com.atproto.admin.resolveModerationReports',
  ComAtprotoAdminReverseModerationAction:
    'com.atproto.admin.reverseModerationAction',
  ComAtprotoAdminSearchRepos: 'com.atproto.admin.searchRepos',
  ComAtprotoAdminTakeModerationAction: 'com.atproto.admin.takeModerationAction',
  ComAtprotoAdminUpdateAccountEmail: 'com.atproto.admin.updateAccountEmail',
  ComAtprotoAdminUpdateAccountHandle: 'com.atproto.admin.updateAccountHandle',
  ComAtprotoIdentityResolveHandle: 'com.atproto.identity.resolveHandle',
  ComAtprotoIdentityUpdateHandle: 'com.atproto.identity.updateHandle',
  ComAtprotoLabelDefs: 'com.atproto.label.defs',
  ComAtprotoLabelQueryLabels: 'com.atproto.label.queryLabels',
  ComAtprotoLabelSubscribeLabels: 'com.atproto.label.subscribeLabels',
  ComAtprotoModerationCreateReport: 'com.atproto.moderation.createReport',
  ComAtprotoModerationDefs: 'com.atproto.moderation.defs',
  ComAtprotoRepoApplyWrites: 'com.atproto.repo.applyWrites',
  ComAtprotoRepoCreateRecord: 'com.atproto.repo.createRecord',
  ComAtprotoRepoDeleteRecord: 'com.atproto.repo.deleteRecord',
  ComAtprotoRepoDescribeRepo: 'com.atproto.repo.describeRepo',
  ComAtprotoRepoGetRecord: 'com.atproto.repo.getRecord',
  ComAtprotoRepoListRecords: 'com.atproto.repo.listRecords',
  ComAtprotoRepoPutRecord: 'com.atproto.repo.putRecord',
  ComAtprotoRepoRebaseRepo: 'com.atproto.repo.rebaseRepo',
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
  ComAtprotoRepoUploadBlob: 'com.atproto.repo.uploadBlob',
  ComAtprotoServerCreateAccount: 'com.atproto.server.createAccount',
  ComAtprotoServerCreateAppPassword: 'com.atproto.server.createAppPassword',
  ComAtprotoServerCreateInviteCode: 'com.atproto.server.createInviteCode',
  ComAtprotoServerCreateInviteCodes: 'com.atproto.server.createInviteCodes',
  ComAtprotoServerCreateSession: 'com.atproto.server.createSession',
  ComAtprotoServerDefs: 'com.atproto.server.defs',
  ComAtprotoServerDeleteAccount: 'com.atproto.server.deleteAccount',
  ComAtprotoServerDeleteSession: 'com.atproto.server.deleteSession',
  ComAtprotoServerDescribeServer: 'com.atproto.server.describeServer',
  ComAtprotoServerGetAccountInviteCodes:
    'com.atproto.server.getAccountInviteCodes',
  ComAtprotoServerGetSession: 'com.atproto.server.getSession',
  ComAtprotoServerListAppPasswords: 'com.atproto.server.listAppPasswords',
  ComAtprotoServerRefreshSession: 'com.atproto.server.refreshSession',
  ComAtprotoServerRequestAccountDelete:
    'com.atproto.server.requestAccountDelete',
  ComAtprotoServerRequestPasswordReset:
    'com.atproto.server.requestPasswordReset',
  ComAtprotoServerResetPassword: 'com.atproto.server.resetPassword',
  ComAtprotoServerRevokeAppPassword: 'com.atproto.server.revokeAppPassword',
  ComAtprotoSyncGetBlob: 'com.atproto.sync.getBlob',
  ComAtprotoSyncGetBlocks: 'com.atproto.sync.getBlocks',
  ComAtprotoSyncGetCheckout: 'com.atproto.sync.getCheckout',
  ComAtprotoSyncGetCommitPath: 'com.atproto.sync.getCommitPath',
  ComAtprotoSyncGetHead: 'com.atproto.sync.getHead',
  ComAtprotoSyncGetRecord: 'com.atproto.sync.getRecord',
  ComAtprotoSyncGetRepo: 'com.atproto.sync.getRepo',
  ComAtprotoSyncListBlobs: 'com.atproto.sync.listBlobs',
  ComAtprotoSyncListRepos: 'com.atproto.sync.listRepos',
  ComAtprotoSyncNotifyOfUpdate: 'com.atproto.sync.notifyOfUpdate',
  ComAtprotoSyncRequestCrawl: 'com.atproto.sync.requestCrawl',
  ComAtprotoSyncSubscribeRepos: 'com.atproto.sync.subscribeRepos',
  AppBskyActorDefs: 'app.bsky.actor.defs',
  AppBskyActorGetPreferences: 'app.bsky.actor.getPreferences',
  AppBskyActorGetProfile: 'app.bsky.actor.getProfile',
  AppBskyActorGetProfiles: 'app.bsky.actor.getProfiles',
  AppBskyActorGetSuggestions: 'app.bsky.actor.getSuggestions',
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyActorPutPreferences: 'app.bsky.actor.putPreferences',
  AppBskyActorSearchActors: 'app.bsky.actor.searchActors',
  AppBskyActorSearchActorsTypeahead: 'app.bsky.actor.searchActorsTypeahead',
  AppBskyEmbedExternal: 'app.bsky.embed.external',
  AppBskyEmbedImages: 'app.bsky.embed.images',
  AppBskyEmbedRecord: 'app.bsky.embed.record',
  AppBskyEmbedRecordWithMedia: 'app.bsky.embed.recordWithMedia',
  AppBskyFeedDefs: 'app.bsky.feed.defs',
  AppBskyFeedDescribeFeedGenerator: 'app.bsky.feed.describeFeedGenerator',
  AppBskyFeedGenerator: 'app.bsky.feed.generator',
  AppBskyFeedGetActorFeeds: 'app.bsky.feed.getActorFeeds',
  AppBskyFeedGetAuthorFeed: 'app.bsky.feed.getAuthorFeed',
  AppBskyFeedGetFeed: 'app.bsky.feed.getFeed',
  AppBskyFeedGetFeedGenerator: 'app.bsky.feed.getFeedGenerator',
  AppBskyFeedGetFeedSkeleton: 'app.bsky.feed.getFeedSkeleton',
  AppBskyFeedGetLikes: 'app.bsky.feed.getLikes',
  AppBskyFeedGetPostThread: 'app.bsky.feed.getPostThread',
  AppBskyFeedGetPosts: 'app.bsky.feed.getPosts',
  AppBskyFeedGetRepostedBy: 'app.bsky.feed.getRepostedBy',
  AppBskyFeedGetSavedFeeds: 'app.bsky.feed.getSavedFeeds',
  AppBskyFeedGetTimeline: 'app.bsky.feed.getTimeline',
  AppBskyFeedLike: 'app.bsky.feed.like',
  AppBskyFeedPost: 'app.bsky.feed.post',
  AppBskyFeedRepost: 'app.bsky.feed.repost',
  AppBskyFeedSaveFeed: 'app.bsky.feed.saveFeed',
  AppBskyFeedUnsaveFeed: 'app.bsky.feed.unsaveFeed',
  AppBskyGraphBlock: 'app.bsky.graph.block',
  AppBskyGraphDefs: 'app.bsky.graph.defs',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskyGraphGetBlocks: 'app.bsky.graph.getBlocks',
  AppBskyGraphGetFollowers: 'app.bsky.graph.getFollowers',
  AppBskyGraphGetFollows: 'app.bsky.graph.getFollows',
  AppBskyGraphGetList: 'app.bsky.graph.getList',
  AppBskyGraphGetListMutes: 'app.bsky.graph.getListMutes',
  AppBskyGraphGetLists: 'app.bsky.graph.getLists',
  AppBskyGraphGetMutes: 'app.bsky.graph.getMutes',
  AppBskyGraphList: 'app.bsky.graph.list',
  AppBskyGraphListitem: 'app.bsky.graph.listitem',
  AppBskyGraphMuteActor: 'app.bsky.graph.muteActor',
  AppBskyGraphMuteActorList: 'app.bsky.graph.muteActorList',
  AppBskyGraphUnmuteActor: 'app.bsky.graph.unmuteActor',
  AppBskyGraphUnmuteActorList: 'app.bsky.graph.unmuteActorList',
  AppBskyNotificationGetUnreadCount: 'app.bsky.notification.getUnreadCount',
  AppBskyNotificationListNotifications:
    'app.bsky.notification.listNotifications',
  AppBskyNotificationUpdateSeen: 'app.bsky.notification.updateSeen',
  AppBskyRichtextFacet: 'app.bsky.richtext.facet',
  AppBskyUnspeccedGetPopular: 'app.bsky.unspecced.getPopular',
}
