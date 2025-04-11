import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SignOutInput, useApi } from '#/api'
import { accountSessionsQueryKey } from '#/data/useAccountSessionsQuery'
import { useDeviceSessionsQueryKey } from '#/data/useDeviceSessionsQuery'

export function useSignOutMutation() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn(input: SignOutInput) {
      return api.fetch('POST', '/sign-out', input)
    },
    onSuccess(_, input) {
      qc.invalidateQueries({ queryKey: useDeviceSessionsQueryKey })
      const subs = Array.isArray(input.sub) ? input.sub : [input.sub]
      for (const sub of subs) {
        qc.invalidateQueries({ queryKey: accountSessionsQueryKey({ sub }) })
      }
    },
  })
}
