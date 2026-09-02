<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { Goods, Document, Monitor, Warning, Refresh, ArrowRight } from '@element-plus/icons-vue'
import { dashboardApi } from '../api/index.js'
import { ElMessage } from 'element-plus'
import StatusTag from '../components/StatusTag.vue'
import StatCard from '../components/StatCard.vue'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const loading = ref(true)
const data = ref({ stats: {}, trend: [], equipment: [], lowStock: [], recentAlerts: [] })
const chartEl = ref()
let chart
let observer

const equipmentCounts = computed(() => {
  const all = data.value.equipment || []
  return ['RUNNING', 'STOPPED', 'FAULT', 'MAINTENANCE'].map((status) => ({
    status, count: all.filter((item) => item.status === status).length
  }))
})

function renderChart() {
  if (!chartEl.value) return
  chart ||= echarts.init(chartEl.value)
  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: '#17233a', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 } },
    legend: { top: 0, right: 4, itemWidth: 16, itemHeight: 3, textStyle: { color: '#778397', fontSize: 11 } },
    grid: { left: 12, right: 12, top: 38, bottom: 4, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: data.value.trend.map((item) => item.date.slice(5)), axisLine: { lineStyle: { color: '#e7ecf3' } }, axisTick: { show: false }, axisLabel: { color: '#8b97a9', fontSize: 11 } },
    yAxis: { type: 'value', splitNumber: 4, axisLabel: { color: '#8b97a9', fontSize: 11 }, splitLine: { lineStyle: { color: '#edf1f6', type: 'dashed' } } },
    series: [
      { name: '计划产量', type: 'line', smooth: true, symbol: 'none', data: data.value.trend.map((item) => item.planned), lineStyle: { color: '#a8b4c6', width: 2, type: 'dashed' } },
      { name: '实际产量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: data.value.trend.map((item) => item.actual), lineStyle: { color: '#2878ff', width: 3 }, itemStyle: { color: '#fff', borderColor: '#2878ff', borderWidth: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(40,120,255,.22)' }, { offset: 1, color: 'rgba(40,120,255,0)' }]) } }
    ]
  })
}

async function load() {
  loading.value = true
  try { data.value = await dashboardApi.get(); await nextTick(); renderChart() }
  catch (error) { ElMessage.error(`看板数据加载失败：${error.message}`) }
  finally { loading.value = false }
}

onMounted(() => { load(); observer = new ResizeObserver(() => chart?.resize()); if (chartEl.value) observer.observe(chartEl.value) })
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>

<template>
  <div v-loading="loading">
    <div class="dashboard-actions">
      <div class="live-label"><span></span>数据实时更新 · {{ new Date().toLocaleDateString('zh-CN') }}</div>
      <el-button :icon="Refresh" @click="load">刷新数据</el-button>
    </div>
    <div class="stats-grid">
      <StatCard title="今日产量" :value="data.stats.todayOutput || 0" unit="件" note="今日实际完成数量" color="#2878ff" :icon="Goods" />
      <StatCard title="进行中订单" :value="data.stats.activeOrders || 0" unit="单" note="当前生产任务" color="#8b5cf6" :icon="Document" />
      <StatCard title="设备运行率" :value="data.stats.equipmentRate || 0" unit="%" note="设备在线运行占比" color="#14a873" :icon="Monitor" />
      <StatCard title="今日异常" :value="data.stats.todayAlerts || 0" unit="条" note="含已处理异常" color="#ed6745" :icon="Warning" />
    </div>

    <div class="main-grid">
      <div class="content-card trend-card">
        <div class="card-head"><div><h2>生产趋势</h2><p>近 7 日计划产量与实际产量对比</p></div></div>
        <div ref="chartEl" class="trend-chart"></div>
      </div>
      <div class="content-card equipment-card">
        <div class="card-head"><div><h2>设备状态</h2><p>当前设备运行分布</p></div><router-link to="/equipment">查看全部 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div class="equipment-rate"><strong>{{ data.stats.equipmentRate || 0 }}<small>%</small></strong><span>综合运行率</span></div>
        <div class="equipment-list">
          <div v-for="item in equipmentCounts" :key="item.status"><StatusTag :value="item.status" /><strong>{{ item.count }}</strong><span>台</span></div>
        </div>
      </div>
    </div>

    <div class="bottom-grid">
      <div class="content-card">
        <div class="card-head"><div><h2>库存预警</h2><p>低于安全库存的物料</p></div><router-link to="/inventory">库存详情 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div v-if="data.lowStock?.length" class="warning-list">
          <div v-for="item in data.lowStock.slice(0, 5)" :key="item.id" class="warning-row">
            <div class="warning-icon"><el-icon><Warning /></el-icon></div>
            <div class="warning-copy"><strong>{{ item.materialName }}</strong><span>{{ item.materialNo }}</span></div>
            <div class="warning-number"><strong>{{ item.quantity }}</strong> / {{ item.safetyStock }} {{ item.unit }}</div>
          </div>
        </div><div v-else class="empty-hint">当前库存充足</div>
      </div>
      <div class="content-card">
        <div class="card-head"><div><h2>最新异常</h2><p>今日设备与生产告警</p></div><router-link to="/alerts">异常中心 <el-icon><ArrowRight /></el-icon></router-link></div>
        <div v-if="data.recentAlerts?.length" class="alert-list">
          <div v-for="item in data.recentAlerts" :key="item.id" class="alert-row">
            <span class="level-dot" :class="item.level.toLowerCase()"></span>
            <div><strong>{{ item.alertType }}</strong><p>{{ item.equipment?.equipmentNo }} · {{ item.description }}</p></div>
            <StatusTag :value="item.status" />
          </div>
        </div><div v-else class="empty-hint">今天暂无异常</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-actions { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }.live-label{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:7px}.live-label span{width:7px;height:7px;background:#20bd84;border-radius:50%;box-shadow:0 0 0 4px #20bd8418}
.stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }.main-grid { display:grid; grid-template-columns:2fr 1fr; gap:16px; margin-top:16px; }.bottom-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
.trend-chart { height:285px; }.card-head a { color:#67809f;text-decoration:none;font-size:11px;display:flex;align-items:center;gap:4px}.card-head a:hover{color:var(--primary)}
.equipment-rate { display:flex; flex-direction:column; align-items:center; padding:17px 0 23px; border-bottom:1px solid var(--border); }.equipment-rate strong{font-size:44px;letter-spacing:-2px}.equipment-rate small{font-size:18px;color:#8c98aa}.equipment-rate span{font-size:11px;color:var(--text-muted);margin-top:4px}.equipment-list{padding-top:12px}.equipment-list>div{display:flex;align-items:center;padding:8px 3px}.equipment-list strong{margin-left:auto;font-size:15px}.equipment-list span{font-size:11px;color:var(--text-muted);margin-left:3px}
.warning-row,.alert-row { min-height:52px;display:flex;align-items:center;border-bottom:1px solid #eff2f6;gap:11px}.warning-row:last-child,.alert-row:last-child{border-bottom:0}.warning-icon{width:31px;height:31px;border-radius:8px;background:#fff3e5;color:#eb8a2e;display:grid;place-items:center}.warning-copy{display:flex;flex-direction:column;gap:3px}.warning-copy strong,.alert-row strong{font-size:12px}.warning-copy span{font-size:10px;color:var(--text-light)}.warning-number{margin-left:auto;color:var(--text-muted);font-size:11px}.warning-number strong{color:#e65959;font-size:14px}
.alert-row>div{flex:1;min-width:0}.alert-row p{font-size:10px;color:var(--text-muted);margin:3px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.level-dot{width:7px;height:7px;border-radius:50%;background:#97a3b4}.level-dot.medium{background:#eaa23a}.level-dot.high,.level-dot.critical{background:#ef5959;box-shadow:0 0 0 4px #ef595914}
@media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,1fr)}.main-grid{grid-template-columns:1fr}.bottom-grid{grid-template-columns:1fr}}@media(max-width:560px){.stats-grid{grid-template-columns:1fr}}
</style>
