import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/ChatLanding.vue'),
  },
  {
    path: '/galaxy/:id',
    name: 'galaxy',
    component: () => import('@/pages/GalaxyView.vue'),
  },
  {
    path: '/galaxy/:id/system/:clusterId',
    name: 'solar-system',
    component: () => import('@/pages/SolarSystemView.vue'),
  },
  {
    path: '/galaxy/:id/stats',
    name: 'stats',
    component: () => import('@/pages/StatsView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
