import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX, ReactNode, useCallback, useState } from 'react'
import { DisabledStep, useStepper } from '#/hooks/use-stepper.ts'
import { Override } from '#/lib/util.ts'

export type WizardRenderProps<TStepData> = {
  /**
   * Indicates wether the render function being invoked corresponds to the step
   * currently active. The steps titles could, for example, be rendered in a
   * list of links, where the current step is highlighted (based on `current`).
   *
   * Another use for this is to render the next/previous steps in order to
   * provide animated transitions between steps. In this case, `current` would
   * be used to disable any form interaction with the form transitioning in/out.
   */
  current: boolean

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

export type WizardCardProps<TWizardData extends readonly any[]> = Override<
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

export function WizardCard<const T extends readonly any[]>({
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
}: WizardCardProps<T>) {
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
      className={clsx(className, 'flex flex-col')}
      {...props}
    >
      <p className="text-contrast-500">
        <Trans>
          Step {currentPosition} of {count}
        </Trans>
      </p>

      {stepTitle && <h2 className="mb-4 text-xl font-medium">{stepTitle}</h2>}

      {stepContent}
    </div>
  )
}
