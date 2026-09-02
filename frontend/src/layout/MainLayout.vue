<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataAnalysis, Document, Monitor, Box, Warning, ChatDotRound,
  Fold, Expand, Bell, SwitchButton, Cpu
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { authStore } from '../utils/auth.js'
import { notificationsApi } from '../api/index.js'

const route = useRoute()
const router = useRouter()
const collapsed = ref(false)
const notificationVisible = ref(false)
const notificationLoading = ref(false)
const notifications = ref({ total: 0, summary: { alerts: 0, lowStock: 0, delayedOrders: 0 }, items: [] })
const user = authStore.user() || { name: '生产管理员' }
const menuItems = [
  { path: '/', label: '生产总览', icon: DataAnalysis },
  { path: '/orders', label: '生产订单', icon: Document },
  { path: '/equipment', label: '设备管理', icon: Monitor },
  { path: '/inventory', label: '库存管理', icon: Box },
  { path: '/alerts', label: '异常管理', icon: Warning },
  { path: '/ai', label: '工业 AI Agent', icon: ChatDotRound }
]
const title = computed(() => route.meta.title || '')
const subtitle = computed(() => route.meta.subtitle || '')
const notificationIcon = (category) => category === 'STOCK' ? Box : category === 'ORDER' ? Document : Warning
async function loadNotifications() {
  notificationLoading.value = true
  try { notifications.value = await notificationsApi.list() } catch (error) { ElMessage.error(error.message) } finally { notificationLoading.value = false }
}
function openNotification(item) { notificationVisible.value = false; router.push(item.path) }
async function logout(){try{await ElMessageBox.confirm('确定退出当前账号吗？','退出登录',{type:'warning'});authStore.clear();router.replace('/login')}catch{/* 用户取消退出 */}}
onMounted(loadNotifications)
</script>

<template>
  <div class="app-shell" :class="{ collapsed }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><el-icon :size="23"><Cpu /></el-icon></div>
        <div v-if="!collapsed" class="brand-copy"><strong>SmartFactory</strong><span>MES Lite</span></div>
      </div>
      <nav class="nav-menu">
        <router-link v-for="item in menuItems" :key="item.path" :to="item.path" class="nav-item">
          <el-icon :size="19"><component :is="item.icon" /></el-icon>
          <span v-if="!collapsed">{{ item.label }}</span>
          <i v-if="item.path === '/ai' && !collapsed">AI</i>
        </router-link>
      </nav>
      <div class="system-status" v-if="!collapsed">
        <span class="pulse"></span>
        <div><strong>系统运行正常</strong><small>演示数据已连接</small></div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="page-heading">
          <el-button class="collapse-btn" text @click="collapsed = !collapsed">
            <el-icon :size="20"><component :is="collapsed ? Expand : Fold" /></el-icon>
          </el-button>
          <div><h1>{{ title }}</h1><p>{{ subtitle }}</p></div>
        </div>
        <div class="top-actions">
          <el-popover v-model:visible="notificationVisible" placement="bottom-end" :width="380" trigger="click" popper-class="notification-popover" @show="loadNotifications">
            <template #reference>
              <el-badge :value="notifications.total" :max="99" :hidden="!notifications.total" class="notification-badge">
                <el-button circle text title="通知" aria-label="查看通知"><el-icon><Bell /></el-icon></el-button>
              </el-badge>
            </template>
            <div class="notification-panel" v-loading="notificationLoading">
              <div class="notification-head"><div><strong>生产通知</strong><span>实时异常与业务预警</span></div><el-button text size="small" @click="loadNotifications">刷新</el-button></div>
              <div class="notification-summary">
                <button @click="router.push('/alerts'); notificationVisible=false"><strong>{{ notifications.summary.alerts }}</strong><span>未处理异常</span></button>
                <button @click="router.push('/inventory'); notificationVisible=false"><strong>{{ notifications.summary.lowStock }}</strong><span>库存预警</span></button>
                <button @click="router.push('/orders'); notificationVisible=false"><strong>{{ notifications.summary.delayedOrders }}</strong><span>延期订单</span></button>
              </div>
              <div v-if="notifications.items.length" class="notification-list">
                <button v-for="item in notifications.items" :key="item.id" @click="openNotification(item)">
                  <span class="notification-icon" :class="item.category.toLowerCase()"><el-icon><component :is="notificationIcon(item.category)" /></el-icon></span>
                  <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span><i :class="String(item.level).toLowerCase()">{{ item.level }}</i>
                </button>
              </div>
              <div v-else class="notification-empty">当前没有待处理通知</div>
            </div>
          </el-popover>
          <el-button circle text title="退出登录" aria-label="退出登录" @click="logout"><el-icon><SwitchButton /></el-icon></el-button>
          <div class="user-block"><span>{{ user.name?.slice(0,1) || '管' }}</span><div><strong>{{ user.name || '生产管理员' }}</strong><small>Production Admin</small></div></div>
        </div>
      </header>
      <section class="page-content"><router-view /></section>
    </main>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; }
.sidebar { position: fixed; inset: 0 auto 0 0; width: var(--sidebar-width); background: #111b2d; color: white; z-index: 20; display: flex; flex-direction: column; transition: width .25s ease; overflow: hidden; }
.collapsed .sidebar { width: 76px; }
.brand { height: var(--topbar-height); display: flex; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid rgba(255,255,255,.08); white-space: nowrap; }
.brand-mark { width: 38px; height: 38px; display: grid; place-items: center; background: linear-gradient(145deg,#3b82f6,#1555d8); border-radius: 11px; box-shadow: 0 8px 20px #0b4ccc55; flex: none; }
.brand-copy { display: flex; flex-direction: column; }
.brand-copy strong { font-size: 16px; letter-spacing: .2px; }.brand-copy span { font-size: 10px; color: #71829d; letter-spacing: 2.5px; margin-top: 2px; }
.nav-menu { padding: 18px 12px; flex: 1; }
.nav-item { height: 48px; display: flex; align-items: center; gap: 13px; padding: 0 14px; color: #8492a8; border-radius: 10px; margin-bottom: 6px; text-decoration: none; font-size: 14px; position: relative; white-space: nowrap; transition: .2s; }
.nav-item:hover { background: rgba(255,255,255,.055); color: #dce6f5; }
.nav-item.router-link-exact-active { color: white; background: linear-gradient(90deg,#286fed,#387ef1); box-shadow: 0 8px 24px rgba(31,105,227,.28); }
.nav-item i { margin-left: auto; font-size: 9px; font-style: normal; background: #8b5cf6; border-radius: 5px; padding: 2px 5px; }
.system-status { margin: 14px; padding: 14px; border-radius: 10px; background: rgba(255,255,255,.045); display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.system-status .pulse { width: 9px; height: 9px; background: #36d399; border-radius: 50%; box-shadow: 0 0 0 5px rgba(54,211,153,.12); }
.system-status div { display: flex; flex-direction: column; gap: 3px; }.system-status strong { font-size: 12px; }.system-status small { color: #71829d; font-size: 10px; }
.main-area { min-height: 100vh; margin-left: var(--sidebar-width); transition: margin-left .25s ease; }.collapsed .main-area { margin-left: 76px; }
.topbar { height: var(--topbar-height); background: rgba(255,255,255,.94); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 28px 0 18px; position: sticky; top: 0; z-index: 15; }
.page-heading { display: flex; align-items: center; gap: 10px; }.page-heading h1 { font-size: 19px; margin: 0 0 3px; letter-spacing: -.2px; }.page-heading p { margin: 0; color: var(--text-muted); font-size: 12px; }
.collapse-btn { color: #6d7b91; }.top-actions { display: flex; align-items: center; gap: 5px; }.user-block { display: flex; align-items: center; gap: 9px; margin-left: 9px; padding-left: 14px; border-left: 1px solid var(--border); }.user-block>span { width: 34px; height: 34px; background: #edf3ff; color: #2b70e9; border-radius: 9px; display: grid; place-items: center; font-size: 13px; font-weight: 700; }.user-block div { display: flex; flex-direction: column; gap: 2px; }.user-block strong { font-size: 12px; }.user-block small { font-size: 9px; color: var(--text-light); }
.page-content { padding: 24px 28px 40px; }
.notification-badge :deep(.el-badge__content) { transform:translate(42%,-35%); border:2px solid white; font-size:9px; height:17px; line-height:13px; min-width:17px; padding:0 4px; }
.notification-panel { margin:-12px; min-height:170px; }.notification-head { display:flex; align-items:center; justify-content:space-between; padding:17px 18px 13px; border-bottom:1px solid #edf1f6; }.notification-head>div { display:flex; flex-direction:column; gap:3px; }.notification-head strong { font-size:15px; }.notification-head span { color:#8996a9; font-size:10px; }
.notification-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; padding:12px 14px; }.notification-summary button { border:0; border-radius:9px; padding:9px 5px; background:#f5f8fc; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; }.notification-summary button:hover { background:#eef4ff; }.notification-summary strong { font-size:16px; color:#2e73e8; }.notification-summary span { font-size:9px; color:#79889d; }
.notification-list { max-height:330px; overflow:auto; padding:0 8px 9px; }.notification-list>button { width:100%; border:0; border-top:1px solid #f0f3f7; background:white; padding:10px 7px; display:flex; align-items:center; gap:9px; text-align:left; cursor:pointer; }.notification-list>button:hover { background:#f8faff; }.notification-icon { width:30px; height:30px; flex:none; border-radius:8px; background:#fff0ef; color:#e3574f; display:grid; place-items:center; }.notification-icon.stock { background:#fff6e7; color:#e59624; }.notification-icon.order { background:#edf3ff; color:#3276e6; }.notification-list>button>span:nth-child(2) { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }.notification-list strong { font-size:10px; color:#28364d; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.notification-list small { font-size:8px; color:#8b98aa; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.notification-list i { font-style:normal; font-size:7px; color:#e78036; }.notification-list i.critical,.notification-list i.high { color:#df4c4c; }.notification-empty { padding:35px; text-align:center; color:#8996a9; font-size:11px; }
@media (max-width: 800px) { .sidebar { width: 76px; }.brand-copy,.nav-item span,.nav-item i,.system-status { display:none; }.main-area { margin-left:76px!important; }.page-content{padding:18px}.topbar{padding-right:15px}.user-block div{display:none}.page-heading p{display:none} }
</style>
