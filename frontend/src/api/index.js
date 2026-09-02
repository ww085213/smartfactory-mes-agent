import axios from 'axios'
import { authStore } from '../utils/auth.js'

const http = axios.create({ baseURL: '/api', timeout: 15000 })

http.interceptors.request.use((request) => {
  const token = authStore.token()
  if (token) request.headers.Authorization = `Bearer ${token}`
  return request
})

http.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      authStore.clear()
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(new Error(error.response?.data?.message || error.message || '网络请求失败'))
  }
)

export const authApi = {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  status: () => http.get('/auth/status')
}
export const dashboardApi = { get: () => http.get('/dashboard') }
export const notificationsApi = { list: () => http.get('/notifications') }
export const ordersApi = {
  list: (params) => http.get('/orders', { params }),
  create: (data) => http.post('/orders', data),
  update: (id, data) => http.put(`/orders/${id}`, data),
  remove: (id) => http.delete(`/orders/${id}`)
}
export const equipmentApi = {
  list: (params) => http.get('/equipment', { params }),
  create: (data) => http.post('/equipment', data),
  update: (id, data) => http.put(`/equipment/${id}`, data),
  remove: (id) => http.delete(`/equipment/${id}`)
}
export const inventoryApi = {
  list: (params) => http.get('/inventory', { params }),
  create: (data) => http.post('/inventory', data),
  update: (id, data) => http.put(`/inventory/${id}`, data),
  remove: (id) => http.delete(`/inventory/${id}`)
}
export const alertsApi = {
  list: (params) => http.get('/alerts', { params }),
  create: (data) => http.post('/alerts', data),
  update: (id, data) => http.put(`/alerts/${id}`, data),
  remove: (id) => http.delete(`/alerts/${id}`)
}
export const productionApi = {
  list: (params) => http.get('/production-records', { params }),
  report: (data) => http.post('/production-records', data)
}
export const aiApi = {
  chat: (data) => http.post('/ai/chat', data),
  status: () => http.get('/ai/status'),
  config: () => http.get('/ai/config'),
  testConfig: (data) => http.post('/ai/config/test', data),
  updateConfig: (data) => http.put('/ai/config', data),
  actions: (params) => http.get('/agent/actions', { params }),
  searchKnowledge: (params) => http.get('/knowledge/search', { params })
}
