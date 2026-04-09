import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'chat',
    component: () => import('@/pages/ChatLanding.vue'),
  },
  // TODO: real galaxy view route lands when /galaxy/:id is built.
  {
    path: '/galaxy/:id',
    name: 'galaxy',
    component: () => import('@/pages/GalaxyPlaceholder.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
