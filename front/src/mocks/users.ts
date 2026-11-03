import type { User } from '@/types/user'

export const ROBERTO = 'Roberto García Hernández'
export const SARELY = 'Sarely Xala Hernández'
export const FRANCISCO = 'Francisco Alejandro Parra Huerta'
export const LUIS = 'Luis Daniel Morales Villarauz'

export const users: User[] = [
  { name: ROBERTO, username: 'tecnico', role: 'tecnico', active: true },
  { name: SARELY, username: 'sxala', role: 'tecnico', active: true },
  { name: FRANCISCO, username: 'coordinador', role: 'coordinador', active: true },
  { name: LUIS, username: 'auditor', role: 'auditor', active: true },
]
