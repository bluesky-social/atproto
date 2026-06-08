import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useCallback } from 'react'
import { useNotificationsContext } from '#/contexts/notifications.tsx'
import { apiErrorParser } from '#/lib/api-error-parser'
import { parseError } from '#/lib/error-parser'

export function useNotifyError() {
  const { _ } = useLingui()
  const { notify } = useNotificationsContext()
  return useCallback(
    (err: unknown, title = msg`An error occurred`) => {
      const { description, message } = apiErrorParser(err) ?? parseError(err)
      notify({
        variant: 'error',
        title: _(title),
        description: description ? _(description) : message,
      })
    },
    [_, notify],
  )
}
