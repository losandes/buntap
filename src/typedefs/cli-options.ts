export type TReporterName = 'tap' | 'nyan' | 'markdown' | 'block' | 'agent'

export type TColorMode = 'auto' | 'on' | 'off'

export type TRunCliOptions = Readonly<{
  mode: 'run'
  reporter: TReporterName
  colorMode: TColorMode
}>

export type TCliOptions =
  | TRunCliOptions
  | Readonly<{ mode: 'help' }>
  | Readonly<{ mode: 'version' }>
