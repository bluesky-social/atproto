import { type FunctionComponent, type JSX, forwardRef } from 'react'
import { Override } from '../../lib/util.ts'

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

export const AuthenticateIcon = makeSvgComponent(
  'M17.71 6.15C17.46 5.38 16.79 5.21 16.45 4.77C16.14 4.31 16.18 3.62 15.53 3.15S14.23 2.92 13.7 2.77 12.81 2 12 2 10.82 2.58 10.3 2.77 9.13 2.67 8.47 3.15 7.86 4.31 7.55 4.77C7.21 5.21 6.55 5.38 6.29 6.15S6.5 7.45 6.5 8 6 9.08 6.29 9.85 7.21 10.79 7.55 11.23C7.86 11.69 7.82 12.38 8.47 12.85S9.77 13.08 10.3 13.23 11.19 14 12 14 13.18 13.42 13.7 13.23 14.87 13.33 15.53 12.85 16.14 11.69 16.45 11.23C16.79 10.79 17.45 10.62 17.71 9.85S17.5 8.55 17.5 8 18 6.92 17.71 6.15M12 12A4 4 0 1 1 16 8A4 4 0 0 1 12 12M14 8A2 2 0 1 1 12 6A2 2 0 0 1 14 8M13.71 15.56L13.08 19.16L12.35 23.29L9.74 20.8L6.44 22.25L7.77 14.75A4 4 0 0 0 9.66 15.17A4.15 4.15 0 0 0 11 15.85A3.32 3.32 0 0 0 12 16A3.5 3.5 0 0 0 13.71 15.56M17.92 18.78L15.34 17.86L15.85 14.92A3.2 3.2 0 0 0 16.7 14.47L16.82 14.37Z',
  'AuthenticateIcon',
)

export const AccountIcon = makeSvgComponent(
  'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z',
  'AccountIcon',
)

export const AccountOutlinedIcon = makeSvgComponent(
  'M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM7.5 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM5.678 19h12.644c-.71-2.909-3.092-5-6.322-5s-5.613 2.091-6.322 5Zm-2.174.906C3.917 15.521 7.242 12 12 12c4.758 0 8.083 3.521 8.496 7.906A1 1 0 0 1 19.5 21h-15a1 1 0 0 1-.996-1.094Z',
  'AccountIcon',
)

export const ArrowTop = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Arrow.tsx
  'M8 6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 1 1-2 0V8.414l-9.793 9.793a1 1 0 0 1-1.414-1.414L15.586 7H9a1 1 0 0 1-1-1Z',
  'ArrowTop',
)

export const AlertIcon = makeSvgComponent(
  'M11.14 4.494a.995.995 0 0 1 1.72 0l7.001 12.008a.996.996 0 0 1-.86 1.498H4.999a.996.996 0 0 1-.86-1.498L11.14 4.494Zm3.447-1.007c-1.155-1.983-4.019-1.983-5.174 0L2.41 15.494C1.247 17.491 2.686 20 4.998 20h14.004c2.312 0 3.751-2.509 2.587-4.506L14.587 3.487ZM13 9.019a1 1 0 1 0-2 0v2.994a1 1 0 1 0 2 0V9.02Zm-1 4.731a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z',
  'AlertIcon',
)

export const AtSymbolIcon = makeSvgComponent(
  'M12 4a8 8 0 1 0 4.21 14.804 1 1 0 0 1 1.054 1.7A9.958 9.958 0 0 1 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 1.104-.27 2.31-.949 3.243-.716.984-1.849 1.6-3.331 1.465a4.207 4.207 0 0 1-2.93-1.585c-.94 1.21-2.388 1.94-3.985 1.715-2.53-.356-4.04-2.91-3.682-5.458.358-2.547 2.514-4.586 5.044-4.23.905.127 1.68.536 2.286 1.126a1 1 0 0 1 1.964.368l-.515 3.545v.002a2.222 2.222 0 0 0 1.999 2.526c.75.068 1.212-.21 1.533-.65.358-.493.566-1.245.566-2.067a8 8 0 0 0-8-8Zm-.112 5.13c-1.195-.168-2.544.819-2.784 2.529-.24 1.71.784 3.03 1.98 3.198 1.195.168 2.543-.819 2.784-2.529.24-1.71-.784-3.03-1.98-3.198Z',
  'AtSymbolIcon',
)

export const ButterflyIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Logo.tsx#L4
  'M6.335 4.212c2.293 1.76 4.76 5.327 5.665 7.241.906-1.914 3.372-5.482 5.665-7.241C19.319 2.942 22 1.96 22 5.086c0 .624-.35 5.244-.556 5.994-.713 2.608-3.315 3.273-5.629 2.87 4.045.704 5.074 3.035 2.852 5.366-4.22 4.426-6.066-1.111-6.54-2.53-.086-.26-.126-.382-.127-.278 0-.104-.041.018-.128.278-.473 1.419-2.318 6.956-6.539 2.53-2.222-2.331-1.193-4.662 2.852-5.366-2.314.403-4.916-.262-5.63-2.87C2.35 10.33 2 5.71 2 5.086c0-3.126 2.68-2.144 4.335-.874Z',
  'ButterflyIcon',
)

export const ChevronRightIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Chevron.tsx
  'M8.293 3.293a1 1 0 0 1 1.414 0l8 8a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414-1.414L15.586 12 8.293 4.707a1 1 0 0 1 0-1.414Z',
  'ChevronRightIcon',
)

export const ChatIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Message.tsx
  'M4 12a8 8 0 1 1 4.445 7.169 1 1 0 0 0-.629-.088l-3.537.662.7-3.415a1 1 0 0 0-.09-.66A7.961 7.961 0 0 1 4 12Zm8-10C6.477 2 2 6.477 2 12c0 1.523.341 2.968.951 4.262l-.93 4.537a1 1 0 0 0 1.163 1.184l4.68-.876A9.968 9.968 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2ZM7.5 13.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z',
  'ChatIcon',
)

export const CheckMarkIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Check.tsx
  'M21.59 3.193a1 1 0 0 1 .217 1.397l-11.706 16a1 1 0 0 1-1.429.193l-6.294-5a1 1 0 1 1 1.244-1.566l5.48 4.353 11.09-15.16a1 1 0 0 1 1.398-.217Z',
  'CheckMarkIcon',
)

export const CircleInfoIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/CircleInfo.tsx#L3
  'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm8-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-4a1 1 0 0 1-1-1Zm1-3a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z',
  'CircleInfoIcon',
)

export const EmailIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Envelope.tsx
  'M4.568 4h14.864c.252 0 .498 0 .706.017.229.019.499.063.77.201a2 2 0 0 1 .874.874c.138.271.182.541.201.77.017.208.017.454.017.706v10.864c0 .252 0 .498-.017.706a2.022 2.022 0 0 1-.201.77 2 2 0 0 1-.874.874 2.022 2.022 0 0 1-.77.201c-.208.017-.454.017-.706.017H4.568c-.252 0-.498 0-.706-.017a2.022 2.022 0 0 1-.77-.201 2 2 0 0 1-.874-.874 2.022 2.022 0 0 1-.201-.77C2 17.93 2 17.684 2 17.432V6.568c0-.252 0-.498.017-.706.019-.229.063-.499.201-.77a2 2 0 0 1 .874-.874c.271-.138.541-.182.77-.201C4.07 4 4.316 4 4.568 4Zm.456 2L12 11.708 18.976 6H5.024ZM20 7.747l-6.733 5.509a2 2 0 0 1-2.534 0L4 7.746V17.4a8.187 8.187 0 0 0 .011.589h.014c.116.01.278.011.575.011h14.8a8.207 8.207 0 0 0 .589-.012v-.013c.01-.116.011-.279.011-.575V7.747Z',
  'EmailIcon',
)

export const EyeIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Eye.tsx
  'M3.135 12C5.413 16.088 8.77 18 12 18s6.587-1.912 8.865-6C18.587 7.912 15.23 6 12 6c-3.228 0-6.587 1.912-8.865 6ZM12 4c4.24 0 8.339 2.611 10.888 7.54a1 1 0 0 1 0 .92C20.338 17.388 16.24 20 12 20c-4.24 0-8.339-2.611-10.888-7.54a1 1 0 0 1 0-.92C3.662 6.612 7.76 4 12 4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-4 2a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z',
  'EyeIcon',
)

export const EyeSlashIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/EyeSlash.tsx
  'M2.293 2.293a1 1 0 0 1 1.414 0L7.335 5.92l.03.03 3.22 3.222 4.243 4.242 3.22 3.22.03.03 3.63 3.629a1 1 0 0 1-1.415 1.414l-3.09-3.09c-2.65 1.478-5.625 1.778-8.421.869-3.039-.987-5.779-3.37-7.67-7.027a1 1 0 0 1 0-.918c1.086-2.1 2.452-3.78 3.996-5.019L2.293 3.707a1 1 0 0 1 0-1.414Zm4.24 5.654 2.021 2.021a4 4 0 0 0 5.478 5.478l1.688 1.688c-2.042.982-4.246 1.124-6.32.45-2.34-.76-4.594-2.586-6.265-5.584.97-1.739 2.135-3.083 3.398-4.053Zm3.535 3.535 2.45 2.45a2 2 0 0 1-2.45-2.45Zm.81-5.405c3.573-.49 7.45 1.369 9.987 5.923a14.797 14.797 0 0 1-1.347 2.02 1 1 0 1 0 1.564 1.247 17.078 17.078 0 0 0 1.806-2.808 1 1 0 0 0 0-.918c-2.833-5.479-7.584-8.088-12.281-7.446a1 1 0 0 0 .271 1.982Z',
  'EyeSlashIcon',
)

export const GlobeIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Globe.tsx
  'M4.062 11h2.961c.103-2.204.545-4.218 1.235-5.77.06-.136.123-.269.188-.399A8.007 8.007 0 0 0 4.062 11ZM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 2c-.227 0-.518.1-.868.432-.354.337-.719.872-1.047 1.61-.561 1.263-.958 2.991-1.06 4.958h5.95c-.102-1.967-.499-3.695-1.06-4.958-.328-.738-.693-1.273-1.047-1.61C12.518 4.099 12.227 4 12 4Zm4.977 7c-.103-2.204-.545-4.218-1.235-5.77a9.78 9.78 0 0 0-.188-.399A8.006 8.006 0 0 1 19.938 11h-2.961Zm-2.003 2H9.026c.101 1.966.498 3.695 1.06 4.958.327.738.692 1.273 1.046 1.61.35.333.641.432.868.432.227 0 .518-.1.868-.432.354-.337.719-.872 1.047-1.61.561-1.263.958-2.991 1.06-4.958Zm.58 6.169c.065-.13.128-.263.188-.399.69-1.552 1.132-3.566 1.235-5.77h2.961a8.006 8.006 0 0 1-4.384 6.169Zm-7.108 0a9.877 9.877 0 0 1-.188-.399c-.69-1.552-1.132-3.566-1.235-5.77H4.062a8.006 8.006 0 0 0 4.384 6.169Z',
  'GlobeIcon',
)

export const ImageIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Image.tsx
  'M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4Zm2 1v7.213l1.246-.932.044-.03a3 3 0 0 1 3.863.454c1.468 1.58 2.941 2.749 4.847 2.749 1.703 0 2.855-.555 4-1.618V5H5Zm14 10.357c-1.112.697-2.386 1.097-4 1.097-2.81 0-4.796-1.755-6.313-3.388a1 1 0 0 0-1.269-.164L5 14.712V19h14v-3.643ZM15 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-3 1a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z',
  'ImageIcon',
)

export const LockIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Lock.tsx
  'M7 7a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7Zm-1 4v9h12v-9H6Zm9-2H9V7a3 3 0 1 1 6 0v2Zm-3 4a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z',
  'LockIcon',
)

export const NewspaperIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/Newspaper.tsx
  'M1 6.5A2.5 2.5 0 0 1 3.5 4H9a4 4 0 0 1 3 1.354A4 4 0 0 1 15 4h5.5A2.5 2.5 0 0 1 23 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-5.223c-.52 0-1 .125-1.4.372-.421.26-.761.633-.983 1.075a1 1 0 0 1-1.788 0 2.66 2.66 0 0 0-.983-1.075c-.4-.247-.88-.372-1.4-.372H3.5A2.5 2.5 0 0 1 1 17.5v-11ZM11 8a2 2 0 0 0-2-2H3.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h5.223c.776 0 1.564.173 2.277.569V8Zm2 10.569A4.7 4.7 0 0 1 15.277 18H20.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H15a2 2 0 0 0-2 2v10.569Z',
  'NewspaperIcon',
)

export const PaperPlaneIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/PaperPlane.tsx#L4
  'M3.374 3.22a1 1 0 0 1 1.073-.114l16 8a1 1 0 0 1 0 1.788l-16 8a1 1 0 0 1-1.417-1.136L4.97 12 3.03 4.243a1 1 0 0 1 .344-1.023ZM6.781 13l-1.284 5.133L17.764 12 5.497 5.867 6.781 11H9a1 1 0 1 1 0 2H6.78Z',
  'PaperPlaneIcon',
)

export const TokenIcon = makeSvgComponent(
  'M4 5.5a.5.5 0 0 0-.5.5v2.535a.5.5 0 0 0 .25.433A3.498 3.498 0 0 1 5.5 12a3.498 3.498 0 0 1-1.75 3.032.5.5 0 0 0-.25.433V18a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-2.535a.5.5 0 0 0-.25-.433A3.498 3.498 0 0 1 18.5 12a3.5 3.5 0 0 1 1.75-3.032.5.5 0 0 0 .25-.433V6a.5.5 0 0 0-.5-.5H4ZM2.5 6A1.5 1.5 0 0 1 4 4.5h16A1.5 1.5 0 0 1 21.5 6v3.17a.5.5 0 0 1-.333.472 2.501 2.501 0 0 0 0 4.716.5.5 0 0 1 .333.471V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-3.17a.5.5 0 0 1 .333-.472 2.501 2.501 0 0 0 0-4.716.5.5 0 0 1-.333-.471V6Zm12 2a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Zm0 4a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Zm0 4a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Z',
  'TokenIcon',
)

export const VideoClipIcon = makeSvgComponent(
  // https://github.com/bluesky-social/social-app/blob/b32568260f98ea879468fd1bdedacf85d1e6ae8c/src/components/icons/VideoClip.tsx
  'M3 4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4Zm2 1v2h2V5H5Zm4 0v6h6V5H9Zm8 0v2h2V5h-2Zm2 4h-2v2h2V9Zm0 4h-2v2h2V13Zm0 4h-2V19h2ZM15 19v-6H9v6h6Zm-8 0v-2H5v2h2Zm-2-4h2v-2H5v2Zm0-4h2V9H5v2Z',
  'TokenIcon',
)

export const XMarkIcon = makeSvgComponent(
  'M4.293 4.293a1 1 0 0 1 1.414 0L12 10.586l6.293-6.293a1 1 0 1 1 1.414 1.414L13.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414L12 13.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L10.586 12 4.293 5.707a1 1 0 0 1 0-1.414Z',
  'XMarkIcon',
)
