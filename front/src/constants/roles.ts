import type { Role } from '@/types/user'

import { ICONS } from './icons'

export interface MenuItem {
  route: string
  label: string
  icon: string
}

export interface RoleMenu {
  label: string
  section: string
  items: MenuItem[]
}

export const ROLE_MENUS: Record<Role, RoleMenu> = {
  tecnico: {
    label: 'Técnico de TI',
    section: 'Mesa de servicio',
    items: [
      { route: 'registrar', label: 'Registrar ticket', icon: ICONS.plus },
      { route: 'bandeja', label: 'Bandeja de incidentes', icon: ICONS.inbox },
    ],
  },
  coordinador: {
    label: 'Coordinador de mesa de ayuda',
    section: 'Coordinación',
    items: [
      { route: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
      { route: 'general', label: 'Bandeja general', icon: ICONS.list },
      { route: 'modelo', label: 'Rendimiento del modelo', icon: ICONS.chart },
      { route: 'usuarios', label: 'Gestión de usuarios', icon: ICONS.users },
    ],
  },
  auditor: {
    label: 'Auditor de sistemas',
    section: 'Auditoría',
    items: [
      { route: 'monitoreo', label: 'Monitoreo de base de datos', icon: ICONS.database },
      { route: 'bitacora', label: 'Bitácora de registros', icon: ICONS.log },
      { route: 'historial', label: 'Historial de ticket', icon: ICONS.clock },
    ],
  },
}
