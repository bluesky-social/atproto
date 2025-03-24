import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'

export function usePasswordConfirmMutation() {
  const api = useApi()

  return useMutation({
    async mutationFn({ code, password }: { code: string; password: string }) {
      await api.fetch('/reset-password-confirm', { token: code, password })
    },
  })
}
