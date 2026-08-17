import { Trans } from '@lingui/react/macro'
import { type JSX, type ReactNode, useCallback, useState } from 'react'
import { Progress } from '#/components/ui/progress.tsx'
import { type DisabledStep, useStepper } from '#/hooks/use-stepper.ts'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type WizardRenderProps<TStepData> = {
  /**
   * Indicates wether the render function being invoked corresponds to the step
   * currently active. The steps titles could, for example, be rendered in a
   * list of links, where the current step is highlighted (based on `current`).
   */
  current: boolean

  /**
   * Whether submitting this step completes the wizard, ie. whether `next`
   * calls `onDone` rather than advancing. A step that carries copy about the
   * outcome — a consent disclaimer, say — shows it only when this is set.
   */
  atLast: boolean

  prev?: () => void
  prevLabel: ReactNode

  next: (data: TStepData) => Promise<void>
  nextLabel: ReactNode
}

export type WizardRenderFn<TStepData> = (
  data: WizardRenderProps<TStepData>,
) => ReactNode

export type WizardStep<TStepData = any> = {
  titleRender?: WizardRenderFn<TStepData>
  contentRender: WizardRenderFn<TStepData>
}

export type SignUpWizardProps<TWizardData extends readonly any[]> = Override<
  JSX.IntrinsicElements['div'],
  {
    children?: never

    prevLabel?: ReactNode
    nextLabel?: ReactNode

    onBack?: () => void
    backLabel?: ReactNode

    onDone: (data: TWizardData) => void | PromiseLike<void>
    doneLabel?: ReactNode

    steps: {
      [K in keyof TWizardData]: null extends TWizardData[K]
        ? WizardStep<TWizardData[K]> | DisabledStep
        : WizardStep<TWizardData[K]>
    }
  }
>

/**
 * Frames the multi-step sign-up: a progress bar over the current step, which
 * the caller supplies as a render prop. The step machine is `useStepper`.
 */
export function SignUpWizard<const T extends readonly any[]>({
  prevLabel,
  nextLabel,

  onBack,
  backLabel,

  onDone,
  doneLabel,

  steps,
  className,

  // div
  ...props
}: SignUpWizardProps<T>) {
  const [data, setData] = useState(
    () => steps.map(() => null) as { [K in keyof T]: T[K] | null },
  )

  const {
    atFirst,
    atLast,
    count,
    current,
    currentPosition,
    othersCompleted,
    toNext,
    toPrev,
    toRequired,
  } = useStepper(
    steps.map((step, index) =>
      step
        ? { index, step, invalid: !!step && data[index] == null }
        : undefined,
    ),
  )

  const index = current?.index

  const setCurrentStepData = useCallback(
    (stepData: any) => {
      if (index != null) {
        setData((prevData) => {
          const nextData = [...prevData] as {
            -readonly [K in keyof T]: T[K] | null
          }
          nextData[index] = stepData
          return nextData
        })
      }
    },
    [index],
  )

  const stepProps: WizardRenderProps<any> = {
    // The current UI only displays the current title & content.
    current: true,

    atLast,

    prevLabel: (atFirst && backLabel) || prevLabel || <Trans>Back</Trans>,
    prev: atFirst ? onBack : toPrev,

    nextLabel: (atLast && doneLabel) || nextLabel || <Trans>Next</Trans>,
    next: async (stepData) => {
      setCurrentStepData(stepData)

      // Every other step (than the current one) must be completed (ie. not be
      // defined, or have non-null data) in order to call `onDone`.
      if (atLast && othersCompleted) {
        const doneData: any = steps.map((step, i) =>
          step ? (i === current?.index ? stepData : data[i]) : null,
        )

        await onDone(doneData)
      } else {
        // If already at last step, go to the first incomplete (required) step
        if (!toNext()) toRequired()
      }
    },
  }

  const stepTitle = current?.step?.titleRender?.(stepProps)
  const stepContent = current?.step?.contentRender?.(stepProps)

  return (
    <div
      // Force re-render of the child component when the step changes, to ensure
      // any internal state is reset. This is especially useful since most step
      // will tends to have the same component for their content (just with
      // different props).
      key={currentPosition}
      className={cn('flex flex-col', className)}
      {...props}
    >
      <div className="mb-4 flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          <Trans>
            Step {currentPosition} of {count}
          </Trans>
        </p>
        <Progress value={(currentPosition / count) * 100} className="h-1" />
      </div>

      {stepTitle && <h2 className="mb-4 text-xl font-medium">{stepTitle}</h2>}

      {stepContent}
    </div>
  )
}
