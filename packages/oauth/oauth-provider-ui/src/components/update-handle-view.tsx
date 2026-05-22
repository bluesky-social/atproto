import { Trans } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import {
  AsyncActionController,
  FormCardAsync,
} from '#/components/forms/form-card-async.tsx'
import { InputHandleDomain } from '#/components/forms/input-handle-domain.tsx'
import { mergeRefs } from '#/lib/ref.ts'

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
        submitLabel={<Trans>Update username</Trans>}
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
    <div className="space-y-4">
      <p>
        {currentHandle ? (
          <Trans context="HandleChange">
            Your current username is <strong>@{currentHandle}</strong>.
          </Trans>
        ) : (
          <Trans context="HandleChange">You don't have a username yet.</Trans>
        )}
      </p>

      <Button
        color="primary"
        onClick={() => {
          setHandle(currentHandle)
          setViewState(ViewState.Update)
        }}
      >
        <Trans>Update username</Trans>
      </Button>
    </div>
  )
}
