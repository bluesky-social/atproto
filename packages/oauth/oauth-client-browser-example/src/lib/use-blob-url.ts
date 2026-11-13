import { useEffect, useMemo } from 'react'

export function useBlobUrl(data: Blob | null | undefined): string | null {
  const url = useMemo(() => {
    if (!data) return null
    return URL.createObjectURL(data)
  }, [data])

  useEffect(() => {
    if (url) {
      return () => {
        // Clear the URL after some time to prevent flickering if the blob is
        // recreated quickly (e.g., avatar updates), or during animations.
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 1000)
      }
    }
  }, [url])

  return url
}
