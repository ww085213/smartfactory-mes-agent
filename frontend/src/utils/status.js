export const statusMap = {
  PENDING: { label: '待生产', type: 'info' },
  IN_PROGRESS: { label: '生产中', type: 'primary' },
  COMPLETED: { label: '已完成', type: 'success' },
  PAUSED: { label: '已暂停', type: 'warning' },
  RUNNING: { label: '运行中', type: 'success' },
  STOPPED: { label: '已停机', type: 'info' },
  FAULT: { label: '故障', type: 'danger' },
  MAINTENANCE: { label: '维护中', type: 'warning' },
  OPEN: { label: '待处理', type: 'danger' },
  PROCESSING: { label: '处理中', type: 'warning' },
  RESOLVED: { label: '已解决', type: 'success' },
  LOW: { label: '低', type: 'info' },
  MEDIUM: { label: '中', type: 'warning' },
  HIGH: { label: '高', type: 'danger' },
  CRITICAL: { label: '紧急', type: 'danger' }
}

export const statusLabel = (value) => statusMap[value]?.label || value
export const statusType = (value) => statusMap[value]?.type || 'info'
export const formatDate = (value) => value ? new Date(value).toLocaleDateString('zh-CN') : '-'
export const formatDateTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
