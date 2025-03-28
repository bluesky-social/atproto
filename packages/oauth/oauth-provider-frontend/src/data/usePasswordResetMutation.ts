import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'
import { useLocale } from '#/locales'

export function usePasswordResetMutation() {
  const api = useApi()
  const { locale } = useLocale()

  return useMutation({
    async mutationFn({ email }: { email: string }) {
      await api.fetch('/reset-password-request', { email, locale })
    },
  })
}
