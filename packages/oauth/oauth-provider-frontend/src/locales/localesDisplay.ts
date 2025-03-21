import { Locale } from '#/locales/types'

export const localesDisplay: Record<
  Locale,
  {
    name: string
    flag?: string
  }
> = {
  // an: {
  //   name: 'Aragonés',
  // },
  // ast: {
  //   name: 'Asturianu',
  // },
  // ca: {
  //   name: 'Català',
  //   flag: '🇦🇩', // Andorra's flag (though Andorra does not cover the entire zone speaking Català)
  // },
  // da: {
  //   name: 'Dansk',
  //   flag: '🇩🇰',
  // },
  // de: {
  //   name: 'Deutsch',
  //   flag: '🇩🇪',
  // },
  // el: {
  //   name: 'Ελληνικά',
  //   flag: '🇬🇷',
  // },
  [Locale.en]: {
    name: 'English',
    flag: '🇺🇸',
  },
  [Locale['en-GB']]: {
    name: 'English (UK)',
    flag: '🇬🇧',
  },
  // es: {
  //   name: 'Español',
  //   flag: '🇪🇸',
  // },
  // eu: {
  //   name: 'Euskara',
  // },
  // fi: {
  //   name: 'Suomi',
  //   flag: '🇫🇮',
  // },
  [Locale.fr]: {
    name: 'Français',
    flag: '🇫🇷',
  },
  // ga: {
  //   name: 'Gaeilge',
  //   flag: '🇮🇪',
  // },
  // gl: {
  //   name: 'Galego',
  // },
  // hi: {
  //   name: 'हिन्दी',
  //   flag: '🇮🇳',
  // },
  // hu: {
  //   name: 'Magyar',
  //   flag: '🇭🇺',
  // },
  // ia: {
  //   name: 'Interlingua',
  // },
  // id: {
  //   name: 'Bahasa Indonesia',
  //   flag: '🇮🇩',
  // },
  // it: {
  //   name: 'Italiano',
  //   flag: '🇮🇹',
  // },
  // ja: {
  //   name: '日本語',
  //   flag: '🇯🇵',
  // },
  // km: {
  //   name: 'ភាសាខ្មែរ',
  //   flag: '🇰🇭',
  // },
  // ko: {
  //   name: '한국어',
  //   flag: '🇰🇷',
  // },
  // ne: {
  //   name: 'नेपाली',
  //   flag: '🇳🇵',
  // },
  // nl: {
  //   name: 'Nederlands',
  //   flag: '🇳🇱',
  // },
  // pl: {
  //   name: 'Polski',
  //   flag: '🇵🇱',
  // },
  // 'pt-BR': {
  //   name: 'Português (Brasil)',
  //   flag: '🇧🇷',
  // },
  // ro: {
  //   name: 'Română',
  //   flag: '🇷🇴',
  // },
  // ru: {
  //   name: 'Русский',
  //   flag: '🇷🇺',
  // },
  // sv: {
  //   name: 'Svenska',
  //   flag: '🇸🇪',
  // },
  // th: {
  //   name: 'ไทย',
  //   flag: '🇹🇭',
  // },
  // tr: {
  //   name: 'Türkçe',
  //   flag: '🇹🇷',
  // },
  // uk: {
  //   name: 'Українська',
  //   flag: '🇺🇦',
  // },
  // vi: {
  //   name: 'Tiếng Việt',
  //   flag: '🇻🇳',
  // },
  // 'zh-CN': {
  //   name: '中文(简体)',
  //   flag: '🇨🇳',
  // },
  // 'zh-HK': {
  //   name: '中文(香港)',
  //   flag: '🇭🇰',
  // },
  // 'zh-TW': {
  //   name: '中文(繁體)',
  //   flag: '🇹🇼',
  // },
}
