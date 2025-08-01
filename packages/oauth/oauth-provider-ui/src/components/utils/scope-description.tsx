import { Trans } from '@lingui/react/macro'
import {
  AccountScope,
  BlobScope,
  IdentityScope,
  RepoScope,
  RpcScope,
  fromString,
} from '@atproto/oauth-scopes'

export type ScopeDescriptionProps = {
  scope: string
}
export function ScopeDescription({ scope }: ScopeDescriptionProps) {
  switch (scope) {
    case 'atproto':
      return <Trans>Uniquely identify you</Trans>
    case 'transition:email':
      return <Trans>Read your email address</Trans>
    case 'transition:generic':
      return <Trans>Access your account data (except chat messages)</Trans>
    case 'transition:chat.bsky':
      return <Trans>Access your chat messages</Trans>
    default: {
      const parsed = fromString(scope)
      if (parsed instanceof AccountScope) {
        const { attribute, action } = parsed
        if (attribute === 'email') {
          return action === 'read' ? (
            <Trans>Read your email address </Trans>
          ) : (
            <Trans>Manage your email address </Trans>
          )
        } else if (attribute === 'repo') {
          return action === 'read' ? (
            <Trans>Read the entire content of your repository</Trans>
          ) : (
            <Trans>Manage the entire content of your repository</Trans>
          )
        } else if (attribute === 'status') {
          return action === 'read' ? (
            <Trans>Read your account status</Trans>
          ) : (
            <Trans>Manage your account status</Trans>
          )
        }
      } else if (parsed instanceof BlobScope) {
        return <Trans>Upload files</Trans>
      } else if (parsed instanceof IdentityScope) {
        if (parsed.attribute === 'handle') {
          return <Trans>Update your handle</Trans>
        } else if (parsed.attribute === '*') {
          return parsed.action === 'manage' ? (
            <p className="text-amber-300">
              <Trans>Update aspects of your identity document</Trans>
            </p>
          ) : (
            <p className="text-red-500">
              <Trans>
                Fully edit your identity document in a potentially unsafe way.
                Grant with extreme caution.
              </Trans>
            </p>
          )
        }
      } else if (parsed instanceof RepoScope) {
        if (
          parsed.action.includes('create') &&
          parsed.action.includes('update') &&
          parsed.action.includes('delete')
        ) {
          if (parsed.collection.includes('*')) {
            return <Trans>Fully manage all content</Trans>
          }

          // @TODO Dropdown with collection list
          return <Trans>Fully manage partial content</Trans>
        } else {
          if (parsed.collection.includes('*')) {
            return <Trans>Partially manage all content</Trans>
          }

          // @TODO Dropdown with collection list
          return <Trans>Partially manage some content</Trans>
        }
      } else if (parsed instanceof RpcScope) {
        if (parsed.aud === '*') {
          // @TODO Dropdown with list of methods
          return <Trans>Call any service</Trans>
        } else {
          // @TODO Dropdown with list of methods
          return <Trans>Perform calls on {parsed.aud}</Trans>
        }
      }

      // Should never happen
      return scope
    }
  }
}
