import React from 'react'
import {
  normalizeAndEnsureValidHandle,
  InvalidHandleError,
} from '@atproto/syntax/dist/handle'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'

type ValidateHandleResult =
  | {
      success: true
      message: undefined
    }
  | {
      success: false
      message: string
    }

export function useValidateHandle(): (v: string) => ValidateHandleResult {
  const { _ } = useLingui()

  return React.useCallback(
    (v: string) => {
      try {
        normalizeAndEnsureValidHandle(stripLeadingAt(v))
        return {
          success: true,
          message: undefined,
        }
      } catch (e: any) {
        if (e instanceof InvalidHandleError) {
          let message = ''

          switch (e.message) {
            // case 'Disallowed characters in handle (ASCII letters, digits, dashes, periods only)':
            //   message = _(msg`Handle contains disallowed characters`)
            //   break
            // case 'Handle is too long (253 chars max)':
            //   message = _(msg`Handle is too long`)
            //   break
            // case 'Handle domain needs at least two parts':
            //   message = _(msg`Handle domain needs at least two parts`)
            //   break
            // case 'Handle parts can not be empty':
            //   message = _(msg`Handle parts can not be empty`)
            //   break
            // case 'Handle part too long (max 63 chars)':
            //   message = _(msg`Handle part is too long`)
            //   break
            // case 'Handle parts can not start or end with hyphens':
            //   message = _(msg`Handle parts can not start or end with hyphens`)
            //   break
            // case 'Handle final component (TLD) must start with ASCII letter':
            //   message = _(msg`Handle final component must start with a letter`)
            //   break
            default:
              message = _(msg`Invalid handle`)
              break
          }

          return {
            success: false,
            message,
          }
        }

        return {
          success: false,
          message: _(msg`Invalid handle`),
        }
      }
    },
    [_],
  )
}

function stripLeadingAt(handle: string) {
  return handle.replace(/^@/, '')
}
