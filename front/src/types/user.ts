export type Role = 'tecnico' | 'coordinador' | 'auditor'

export interface User {
  name: string
  username: string
  role: Role
  active: boolean
}
