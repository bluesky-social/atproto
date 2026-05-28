import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { FormCard } from './forms/form-card.tsx'
import { UpdateHandleForm } from './update-handle-form.tsx'

export type UpdateHandleViewProps = {
  did: string
  currentHandle?: string
  domains: string[]
  pending?: boolean
  onSubmit: (data: { handle: string }) => void | PromiseLike<void>
}

enum ViewState {
  Idle,
  Update,
}

export function UpdateHandleView({
  did,
  currentHandle,
  domains,
  pending,
  onSubmit,
}: UpdateHandleViewProps) {
  const [viewState, setViewState] = useState<ViewState>(ViewState.Idle)

  if (viewState === ViewState.Update) {
    return (
      <UpdateHandleForm
        did={did}
        domains={domains}
        handleDefault={currentHandle}
        disabled={pending}
        onSubmit={async (data) => {
          await onSubmit(data)
          setViewState(ViewState.Idle)
        }}
        onCancel={() => {
          setViewState(ViewState.Idle)
        }}
        hideError
      />
    )
  }

  return (
    <FormCard
      actions={
        <Button
          type="submit"
          color="primary"
          onClick={() => {
            setViewState(ViewState.Update)
          }}
        >
          <Trans context="Handle">Update</Trans>
        </Button>
      }
    >
      <p>
        <Trans context="Handle">
          Your username is <strong>@{currentHandle}</strong>.
        </Trans>
      </p>
    </FormCard>
  )
}
