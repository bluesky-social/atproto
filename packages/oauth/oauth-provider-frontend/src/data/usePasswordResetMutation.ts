import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'

export function usePasswordResetMutation() {
  const api = useApi()

  return useMutation({
    async mutationFn({ email }: { email: string }) {
      await api.fetch('/reset-password-request', { email, locale: 'en' })
    },
  })
}
