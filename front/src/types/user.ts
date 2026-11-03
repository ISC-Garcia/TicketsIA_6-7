export type Role = 'tecnico' | 'coordinador' | 'auditor'

export interface User {
  name: string
  username: string
  role: Role
  active: boolean
  // Entró con una contraseña temporal y debe cambiarla antes de usar el sistema (P-4).
  mustChangePassword?: boolean
}

export interface NewUser {
  name: string
  username: string
  role: Role
  password: string
}
