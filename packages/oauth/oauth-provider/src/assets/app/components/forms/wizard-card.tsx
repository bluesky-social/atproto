import { JSX, ReactNode } from 'react'
import { Step, useStepper } from '../../hooks/use-stepper'
import { clsx } from '../../lib/clsx'
import { Override } from '../../lib/util'

export type DoneFn = (...a: any) => unknown

export type WizardSlotData<TDone extends DoneFn> = {
  required: boolean

  prev?: () => void
  prevLabel: string

  // On the last step, the "next()" function will actually be the done function
  next: (() => void) | TDone
  nextLabel: string
}

export type WizardSlot<TDone extends DoneFn> =
  | ReactNode
  | ((data: WizardSlotData<TDone>) => ReactNode)

export type WizardStep<TDone extends DoneFn> = Step & {
  title?: WizardSlot<TDone>
  content: WizardSlot<TDone>
}

export type WizardCardProps<TDone extends DoneFn> = Override<
  JSX.IntrinsicElements['div'],
  {
    label?: WizardSlot<TDone>

    prevLabel?: string
    nextLabel?: string

    onBack?: () => void
    backLabel?: string

    onDone: TDone
    doneLabel?: string

    steps: readonly WizardStep<TDone>[]
  }
>

export function WizardCard<TDone extends DoneFn>({
  label,

  prevLabel,
  nextLabel,

  onBack,
  backLabel,

  onDone,
  doneLabel,

  steps,
  children,
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
    required: current?.required || false,

    // @TODO translate
    prevLabel: (atFirst && backLabel) || prevLabel || 'Back',
    prev: atFirst ? onBack : toPrev,

    // @TODO translate
    nextLabel: (atLast && doneLabel) || nextLabel || 'Next',
    next:
      atLast && isCompleted
        ? onDone
        : () => {
            // If already at last step, go to the first incomplete (required) step
            if (!toNext()) toRequired()
          },
  }

  const cardLabel = label
    ? invoke(label, data)
    : // @TODO translate
      `Step ${currentPosition} of ${count}`
  const stepTitle = invoke(current?.title, data)
  const stepContent = invoke(current?.content, data)

  return (
    <div className={clsx(className, 'flex flex-col')} {...props}>
      {cardLabel && (
        <p className="mt-4 text-slate-500 dark:text-slate-400">{cardLabel}</p>
      )}

      {stepTitle && <h2 className="font-medium text-xl mb-4">{stepTitle}</h2>}

      {stepContent}

      {children}
    </div>
  )
}

function invoke<TDone extends DoneFn>(
  slot: WizardSlot<TDone>,
  data: WizardSlotData<TDone>,
) {
  return typeof slot === 'function' ? slot(data) : slot
}
