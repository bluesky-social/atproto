import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApi } from '#/api'
import { useLocale } from '#/locales'
import {
  useAccountsQueryKey,
  UseAccountsQueryResponse,
} from '#/data/useAccountsQuery'

export function useSignInMutation() {
  const api = useApi()
  const { locale } = useLocale()
  const qc = useQueryClient()

  return useMutation({
    async mutationFn({
      username,
      password,
      code,
      remember,
    }: {
      username: string
      password: string
      code?: string
      remember?: boolean
    }) {
      const res = await api.fetch('/sign-in', {
        username,
        password,
        emailOtp: code,
        remember,
        locale,
      })
      qc.setQueryData<UseAccountsQueryResponse>(useAccountsQueryKey, (data) => {
        return [
          res.account,
          ...(data ?? []).filter((a) => a.sub !== res.account.sub),
        ]
      })
      return res
    },
  })
}
