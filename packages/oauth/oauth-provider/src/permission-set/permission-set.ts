// @NOTE should this be moved to @atproto/lexicon ?

import { z } from 'zod'
import { REPO_ACTIONS, isAccept, isAudParam } from '@atproto/oauth-scopes'
import { NSID } from '@atproto/syntax'

const nsidSchema = z.string().transform((input, ctx) => {
  try {
    return new NSID(input)
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid NSID',
    })
    return z.NEVER
  }
})

const RESOURCE = 'resource'

const permissionBaseSchema = z.object({ type: z.literal('permission') })

export const blobPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('blob'),
  accept: z
    .array(z.string().refine(isAccept, 'Invalid blob MIME type'))
    .nonempty(),
})
export type BlobPermission = z.infer<typeof blobPermissionSchema>

export const repoPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('repo'),
  collection: z.array(nsidSchema).nonempty(),
  action: z.array(z.enum(REPO_ACTIONS)).nonempty(),
})
export type RepoPermission = z.infer<typeof repoPermissionSchema>

export const rpcPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('rpc'),
  aud: z.string().refine(isAudParam, 'Invalid DID or "*"'),
  lxm: z.array(nsidSchema).nonempty(),
})
export type RpcPermission = z.infer<typeof rpcPermissionSchema>

export const permissionSetSchema = z.object({
  type: z.literal('permission-set'),
  description: z.string().optional(),
  permissions: z
    .array(
      z.discriminatedUnion(RESOURCE, [
        blobPermissionSchema,
        repoPermissionSchema,
        rpcPermissionSchema,
      ]),
    )
    .nonempty(),
})

export type PermissionSet = z.infer<typeof permissionSetSchema>
