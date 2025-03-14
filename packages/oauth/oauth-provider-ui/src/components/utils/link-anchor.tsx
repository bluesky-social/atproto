import { JSX } from 'react'
import type { LinkDefinition } from '@atproto/oauth-provider-api'
import { Override } from '../../lib/util.ts'
import { LinkTitle } from './link-title.tsx'

export type LinkAnchorProps = Override<
  JSX.IntrinsicElements['a'],
  {
    link: LinkDefinition
  }
>
export function LinkAnchor({
  link,

  // a
  children = <LinkTitle link={link} />,
  role = 'link',
  target = '_blank',
  href = link.href,
  rel = link.rel,
  ...props
}: LinkAnchorProps) {
  return (
    <a {...props} role={role} target={target} href={href} rel={rel}>
      {children}
    </a>
  )
}
