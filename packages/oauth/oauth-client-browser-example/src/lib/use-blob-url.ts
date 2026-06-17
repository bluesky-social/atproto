import { useEffect, useState } from 'react'

export function useBlobUrl(data: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!data) {
      setUrl(null)
      return
    }

    const blobUrl = URL.createObjectURL(data)
    setUrl(blobUrl)

    return () => {
      // Clear the URL after some time to prevent flickering if the blob is
      // recreated quickly (e.g., avatar updates), or during animations.
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 1000)
    }
  }, [data])

  return url
}
