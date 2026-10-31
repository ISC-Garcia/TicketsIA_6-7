import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
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
  ],
})

export default router
