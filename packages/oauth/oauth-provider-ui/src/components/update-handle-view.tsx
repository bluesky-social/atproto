import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import {
  AsyncActionController,
  FormCardAsync,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleDomain } from '#/components/forms/input-handle-domain.tsx'
import { mergeRefs } from '#/lib/ref.ts'
import { FormCard } from './forms/form-card'

export type UpdateHandleViewProps = {
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
  currentHandle,
  domains,
  pending,
  onSubmit,
}: UpdateHandleViewProps) {
  const [viewState, setViewState] = useState<ViewState>(ViewState.Idle)
  const formRef = useRef<AsyncActionController>(null)
  const [handle, setHandle] = useState<string | undefined>(currentHandle)

  if (viewState === ViewState.Update) {
    return (
      <FormCardAsync
        ref={mergeRefs([formRef])}
        invalid={!handle}
        disabled={pending}
        onSubmit={async () => {
          if (handle) {
            await onSubmit({ handle })
            setViewState(ViewState.Idle)
          }
        }}
        onCancel={() => {
          setViewState(ViewState.Idle)
        }}
      >
        <InputHandleDomain
          handle={handle}
          onHandle={(value) => {
            formRef.current?.reset()
            setHandle(value)
          }}
          domains={domains}
          name="handle"
          required
          autoFocus
          enterKeyHint="done"
        />
      </FormCardAsync>
    )
  }

  return (
    <FormCard
      actions={
        <Button
          type="submit"
          color="primary"
          onClick={() => {
            setHandle(currentHandle)
            setViewState(ViewState.Update)
          }}
        >
          <Trans>Update username</Trans>
        </Button>
      }
    >
      <p>
        <Trans context="HandleChange">
          Your username is <strong>@{currentHandle}</strong>.
        </Trans>
      </p>
    </FormCard>
  )
}
