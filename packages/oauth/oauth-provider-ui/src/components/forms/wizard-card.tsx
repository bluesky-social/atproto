import { Trans } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX, ReactNode, useCallback } from 'react'
import { DisabledStep, Step, useStepper } from '../../hooks/use-stepper.ts'
import { Override } from '../../lib/util.ts'

export type DoneFn = (...a: any) => unknown

export type WizardRenderProps<TDone extends DoneFn> = {
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
  invalid: boolean

  prev?: () => void
  prevLabel: ReactNode

  // On the last step, the "next()" function will actually be the done function
  next: (() => void) | TDone
  nextLabel: ReactNode
}

export type WizardRenderFn<TDone extends DoneFn> = (
  data: WizardRenderProps<TDone>,
) => ReactNode

export type WizardStep<TDone extends DoneFn> = Step & {
  titleRender?: WizardRenderFn<TDone>
  contentRender: WizardRenderFn<TDone>
}

export type WizardCardProps<TDone extends DoneFn> = Override<
  Omit<JSX.IntrinsicElements['div'], 'children'>,
  {
    prevLabel?: ReactNode
    nextLabel?: ReactNode

    onBack?: () => void
    backLabel?: ReactNode

    onDone: TDone
    doneLabel?: ReactNode

    steps: readonly (WizardStep<TDone> | DisabledStep)[]
  }
>

export function WizardCard<TDone extends DoneFn>({
  prevLabel,
  nextLabel,

  onBack,
  backLabel,

  onDone,
  doneLabel,

  steps,
  className,

  ...props
}: WizardCardProps<TDone>) {
  const {
    atFirst,
    atLast,
    count,
    current,
    currentPosition,
    completed,
    toNext,
    toPrev,
    toRequired,
  } = useStepper(steps)

  // Memoized to avoid re-renders in child (rendered) components
  const onNext = useCallback(() => {
    // If already at last step, go to the first incomplete (required) step
    if (!toNext()) toRequired()
  }, [toNext, toRequired])

  const data: WizardRenderProps<TDone> = {
    // The current UI only displays the current title & content.
    current: true,
    invalid: current ? current.invalid : false,

    prevLabel: (atFirst && backLabel) || prevLabel || <Trans>Back</Trans>,
    prev: atFirst ? onBack : toPrev,

    nextLabel: (atLast && doneLabel) || nextLabel || <Trans>Next</Trans>,
    next: atLast && completed ? onDone : onNext,
  }

  const stepTitle = current?.titleRender?.(data)
  const stepContent = current?.contentRender?.(data)

  return (
    <div className={clsx(className, 'flex flex-col')} {...props}>
      <p className="text-slate-500 dark:text-slate-400">
        <Trans>
          Step {currentPosition} of {count}
        </Trans>
      </p>

      {stepTitle && <h2 className="mb-4 text-xl font-medium">{stepTitle}</h2>}

      {stepContent}
    </div>
  )
}
