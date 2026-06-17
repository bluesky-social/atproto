import { type FunctionComponent, type JSX, forwardRef } from 'react'

export type IconProps = Omit<
  JSX.IntrinsicElements['svg'],
  'viewBox' | 'children' | 'xmlns' | 'title'
> & {
  /**
   * The title of the icon, used for accessibility.
   */
  title?: string
}

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

export const AccountIcon = makeSvgComponent(
  'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z',
  'AccountIcon',
)

export const ClipboardIcon = makeSvgComponent(
  'M8.17 4A3.001 3.001 0 0 1 11 2h2c1.306 0 2.418.835 2.83 2H17a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1.17ZM8 6H7a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6Zm6 0V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1h4Z',
  'ClipboardIcon',
)
export const SquareArrowTopRightIcon = makeSvgComponent(
  'M14 5a1 1 0 1 1 0-2h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V6.414l-7.293 7.293a1 1 0 0 1-1.414-1.414L17.586 5H14ZM3 6a1 1 0 0 1 1-1h5a1 1 0 0 1 0 2H5v12h12v-4a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z',
  'SquareArrowTopRightIcon',
)
