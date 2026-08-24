export type AuthUser = {
  id: string
  name: string
  authorizationCode?: string
  referrer?: 'DEFAULT' | 'SANDBOX'
}
