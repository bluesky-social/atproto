import { Trans } from '@lingui/react/macro'
import { JSX, ReactNode } from 'react'
import { DisabledStep, Step, useStepper } from '../../hooks/use-stepper.ts'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

export type DoneFn = (...a: any) => unknown

export type WizardSlotData<TDone extends DoneFn> = {
  invalid: boolean

  prev?: () => void
  prevLabel: ReactNode

  // On the last step, the "next()" function will actually be the done function
  next: (() => void) | TDone
  nextLabel: ReactNode
}

export type WizardRenderFn<TDone extends DoneFn> = (
  data: WizardSlotData<TDone>,
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
    isCompleted,
    toNext,
    toPrev,
    toRequired,
  } = useStepper(steps)

  const data: WizardSlotData<TDone> = {
    invalid: current?.invalid || false,

    prevLabel: (atFirst && backLabel) || prevLabel || <Trans>Back</Trans>,
    prev: atFirst ? onBack : toPrev,

    nextLabel: (atLast && doneLabel) || nextLabel || <Trans>Next</Trans>,
    next:
      atLast && isCompleted
        ? onDone
        : () => {
            // If already at last step, go to the first incomplete (required) step
            if (!toNext()) toRequired()
          },
  }

  const stepTitle = current?.titleRender?.(data)
  const stepContent = current?.contentRender?.(data)

  return (
    <div className={clsx(className, 'flex flex-col')} {...props}>
      <p className="mt-4 text-slate-500 dark:text-slate-400">
        <Trans>
          Step {currentPosition} of {count}
        </Trans>
      </p>

      {stepTitle && <h2 className="font-medium text-xl mb-4">{stepTitle}</h2>}

      {stepContent}
    </div>
  )
}
