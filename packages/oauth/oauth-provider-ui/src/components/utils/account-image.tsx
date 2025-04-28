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
      src={src}
      alt={alt}
      className="-ml-1 h-6 w-6 rounded-full"
      onError={() => setErrored(true)}
    />
  ) : (
    <div
      aria-hidden
      className="bg-primary border-primary h-6 w-6 overflow-hidden rounded-full border-2 border-solid text-white"
    >
      <AccountIcon className="-mx-1 -mb-1" />
    </div>
  )
}
