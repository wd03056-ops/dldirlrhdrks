export type AuthMethod = 'anonymous-key' | 'toss-login'

export type AuthUser = {
  id: string
  name: string
  authMethod?: AuthMethod
}
