<script setup>
defineProps({
  title: String,
  value: [String, Number],
  unit: { type: String, default: '' },
  note: String,
  color: { type: String, default: '#2878ff' },
  icon: Object
})
</script>

<template>
  <div class="stat-card panel-card">
    <div class="stat-icon" :style="{ color, backgroundColor: `${color}14` }">
      <el-icon :size="24"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-content">
      <div class="stat-title">{{ title }}</div>
      <div class="stat-value">{{ value }}<span>{{ unit }}</span></div>
      <div class="stat-note">{{ note }}</div>
    </div>
  </div>
</template>

<style scoped>
.stat-card { display: flex; align-items: center; gap: 18px; padding: 22px; }
.stat-icon { width: 50px; height: 50px; border-radius: 15px; display: grid; place-items: center; flex: none; }
.stat-title { font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
.stat-value { font-size: 28px; line-height: 1.1; font-weight: 700; letter-spacing: -.8px; color: var(--text-main); }
.stat-value span { font-size: 14px; font-weight: 500; margin-left: 4px; color: var(--text-muted); }
.stat-note { color: var(--text-light); font-size: 12px; margin-top: 7px; }
</style>
