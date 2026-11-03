import type { RouteRecordRaw } from 'vue-router'

import type { Role } from '@/types/user'
import { parseTicketFilters } from '@/utils/ticketFilters'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: Role[]
    guest?: boolean
    title?: string
    parent?: string
    tabs?: Record<string, string>
  }
}

// Vista temporal: cada historia la reemplaza por su pantalla.
const placeholder = () => import('@/views/PlaceholderView.vue')

export const ROLE_HOME: Record<Role, string> = {
  tecnico: 'bandeja',
  coordinador: 'dashboard',
  auditor: 'monitoreo',
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    redirect: { name: 'login' },
    children: [
      {
        path: 'registrar',
        name: 'registrar',
        component: () => import('@/views/RegisterView.vue'),
        meta: { roles: ['tecnico'], title: 'Registrar ticket' },
      },
      {
        path: 'bandeja',
        name: 'bandeja',
        component: () => import('@/views/InboxView.vue'),
        props: (route) => ({ filters: parseTicketFilters(route.query) }),
        meta: { roles: ['tecnico'], title: 'Bandeja de incidentes' },
      },
      {
        path: 'bandeja/:id',
        name: 'bandeja-detalle',
        component: () => import('@/views/TicketDetailView.vue'),
        props: true,
        meta: { roles: ['tecnico'], title: 'Detalle de ticket', parent: 'bandeja' },
      },
      {
        path: 'general',
        name: 'general',
        component: () => import('@/views/InboxView.vue'),
        props: (route) => ({ filters: parseTicketFilters(route.query), mode: 'coordinador' }),
        meta: { roles: ['coordinador'], title: 'Bandeja general' },
      },
      {
        path: 'general/:id',
        name: 'general-detalle',
        component: () => import('@/views/TicketDetailView.vue'),
        props: true,
        meta: { roles: ['coordinador'], title: 'Detalle de ticket', parent: 'general' },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: placeholder,
        meta: { roles: ['coordinador'], title: 'Dashboard de carga de trabajo' },
      },
      {
        path: 'modelo/:tab?',
        name: 'modelo',
        component: placeholder,
        meta: {
          roles: ['coordinador'],
          title: 'Rendimiento del modelo',
          tabs: {
            metricas: 'Métricas',
            matriz: 'Matriz de confusión',
            datos: 'Datos de entrenamiento',
            modelo: 'Modelo',
          },
        },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: placeholder,
        meta: { roles: ['coordinador'], title: 'Gestión de usuarios' },
      },
      {
        path: 'monitoreo/:tab?',
        name: 'monitoreo',
        component: placeholder,
        meta: {
          roles: ['auditor'],
          title: 'Monitoreo de base de datos',
          tabs: { estado: 'Estado general', tablas: 'Tablas', respaldos: 'Respaldos' },
        },
      },
      {
        path: 'bitacora',
        name: 'bitacora',
        component: placeholder,
        meta: { roles: ['auditor'], title: 'Bitácora de registros' },
      },
      {
        path: 'historial/:id?',
        name: 'historial',
        component: placeholder,
        meta: { roles: ['auditor'], title: 'Historial de ticket' },
      },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/componentes',
          name: 'dev-components',
          component: () => import('@/views/dev/ComponentKitView.vue'),
        },
      ]
    : []),
  { path: '/:pathMatch(.*)*', redirect: { name: 'login' } },
]
