import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn } from '@/lib/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'taco',
    component: () => import('@/pages/TacoDashboard.vue'),
  },
  {
    path: '/new',
    name: 'home',
    component: () => import('@/pages/ChatLanding.vue'),
  },
  {
    path: '/galaxy/:id/chat',
    name: 'chat-galaxy',
    component: () => import('@/pages/ChatGalaxyPage.vue'),
  },
  {
    path: '/galaxy/:id/loading',
    name: 'galaxy-loading',
    component: () => import('@/pages/GalaxyLoadingPage.vue'),
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

router.beforeEach((to) => {
  if (to.meta.public || to.name === 'login') return
  if (!isLoggedIn.value) return { name: 'login' }
})
