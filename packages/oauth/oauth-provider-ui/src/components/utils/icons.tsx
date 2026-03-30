import { type FunctionComponent, type JSX, forwardRef } from 'react'
import { Override } from '#/lib/util.ts'

export type IconProps = Override<
  Omit<JSX.IntrinsicElements['svg'], 'viewBox' | 'children' | 'xmlns'>,
  {
    /**
     * The title of the icon, used for accessibility.
     */
    title?: string
  }
>

const makeSvgComponent = (path: string, displayName: string) => {
  const SvgComponent: FunctionComponent<IconProps> = forwardRef(
    ({ title, ...props }, ref) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        {...props}
        ref={ref}
        aria-hidden={!title}
      >
        {title && <title>{title}</title>}
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d={path}
        ></path>
      </svg>
    ),
  )
  SvgComponent.displayName = displayName
  return SvgComponent
}

export const ButterflyIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Logo.tsx#L4
  'M6.335 4.212c2.293 1.76 4.76 5.327 5.665 7.241.906-1.914 3.372-5.482 5.665-7.241C19.319 2.942 22 1.96 22 5.086c0 .624-.35 5.244-.556 5.994-.713 2.608-3.315 3.273-5.629 2.87 4.045.704 5.074 3.035 2.852 5.366-4.22 4.426-6.066-1.111-6.54-2.53-.086-.26-.126-.382-.127-.278 0-.104-.041.018-.128.278-.473 1.419-2.318 6.956-6.539 2.53-2.222-2.331-1.193-4.662 2.852-5.366-2.314.403-4.916-.262-5.63-2.87C2.35 10.33 2 5.71 2 5.086c0-3.126 2.68-2.144 4.335-.874Z',
  'ButterflyIcon',
)
