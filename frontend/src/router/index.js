import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'
import { authStore } from '../utils/auth.js'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
  path: '/',
  component: MainLayout,
  children: [
    { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '生产总览', subtitle: '实时掌握工厂生产运行状态' } },
    { path: 'orders', name: 'orders', component: () => import('../views/OrdersView.vue'), meta: { title: '生产订单', subtitle: '管理生产计划与订单执行进度' } },
    { path: 'equipment', name: 'equipment', component: () => import('../views/EquipmentView.vue'), meta: { title: '设备管理', subtitle: '监控设备状态与累计运行时间' } },
    { path: 'inventory', name: 'inventory', component: () => import('../views/InventoryView.vue'), meta: { title: '库存管理', subtitle: '管理生产物料与安全库存预警' } },
    { path: 'alerts', name: 'alerts', component: () => import('../views/AlertsView.vue'), meta: { title: '异常管理', subtitle: '跟踪设备及生产异常处理闭环' } },
    { path: 'ai', name: 'ai', component: () => import('../views/AIChatView.vue'), meta: { title: '工业 AI Agent', subtitle: '自然语言调用 MES Tools 与工业知识库' } }
  ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.public && !authStore.isAuthenticated()) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && authStore.isAuthenticated()) return { name: 'dashboard' }
  return true
})

export default router
