import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'chat',
    component: () => import('@/pages/ChatLanding.vue'),
  },
  {
    path: '/galaxy/:id',
    name: 'galaxy',
    component: () => import('@/pages/SkillTree.vue'),
  },
  {
    path: '/galaxy/:id/planet/:subtopicId',
    name: 'planet',
    component: () => import('@/pages/PlanetView.vue'),
  },
  {
    path: '/galaxy/:id/concept/:conceptId',
    name: 'concept',
    component: () => import('@/pages/ConceptScene.vue'),
  },
  {
    path: '/galaxy/:id/stats',
    name: 'stats',
    component: () => import('@/pages/StatsView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
