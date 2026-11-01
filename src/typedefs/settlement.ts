export type TSettlement<TData, TError = Error> =
  | Readonly<{ status: 'ok'; data: TData }>
  | Readonly<{ status: 'error'; error: TError }>
