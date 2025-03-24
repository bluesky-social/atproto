import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'

export function useRevokeSessionsMutation() {
  const api = useApi()

  return useMutation({
    async mutationFn({ tokens }: { tokens: string[] }) {
      // @ts-expect-error
      return api.fetch('/revoke', {
        tokens,
      })
    },
  })
}
