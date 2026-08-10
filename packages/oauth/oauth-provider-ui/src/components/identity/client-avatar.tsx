import { InfoIcon } from 'lucide-react'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar.tsx'
import { cn } from '#/lib/utils.ts'

export type ClientAvatarProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
  className?: string
}

export function ClientAvatar({
  clientId,
  clientMetadata,
  clientTrusted,
  className,
}: ClientAvatarProps) {
  // Only ever show a client-supplied logo for clients the provider trusts.
  const src = clientTrusted ? clientMetadata.logo_uri : undefined
  const alt = clientMetadata.client_name || clientId

  return (
    <Avatar className={cn('-ml-1 size-8 rounded-none', className)} aria-hidden>
      <AvatarImage src={src} alt={alt} className="object-contain" />
      <AvatarFallback className="bg-primary text-primary-foreground rounded-full">
        <InfoIcon className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}
