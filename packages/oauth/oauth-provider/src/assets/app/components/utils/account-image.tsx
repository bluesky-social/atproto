import { useEffect, useState } from 'react'
import { AccountIcon } from './icons.tsx'

export type AccountIconProps = {
  src?: string
  alt: string
}

export function AccountImage({ src, alt }: AccountIconProps) {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  return src && !errored ? (
    <img
      aria-hidden
      crossOrigin="anonymous"
      src={src}
      alt={alt}
      className="-ml-1 w-6 h-6 rounded-full"
      onError={() => setErrored(true)}
    />
  ) : (
    <div
      aria-hidden
      className="h-6 w-6 text-white bg-brand rounded-full border-solid border-2 border-brand overflow-hidden"
    >
      <AccountIcon className="-mx-1 -mb-1" />
    </div>
  )
}
