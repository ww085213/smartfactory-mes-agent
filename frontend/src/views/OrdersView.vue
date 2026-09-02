<script setup>
import { reactive, ref, onMounted } from 'vue'
import { Plus, Search, Refresh, DataLine } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ordersApi, productionApi } from '../api/index.js'
import { formatDate } from '../utils/status.js'
import StatusTag from '../components/StatusTag.vue'

const rows = ref([]), loading = ref(false), dialogVisible = ref(false), reportVisible = ref(false), editingId = ref(null)
const filters = reactive({ search: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const emptyForm = () => ({ orderNo: '', productName: '', quantity: 1000, completedQuantity: 0, status: 'PENDING', startDate: '', deadline: '' })
const form = reactive(emptyForm())
const reportForm = reactive({ orderId: null, orderNo: '', date: '', plannedQuantity: 0, actualQuantity: 0 })
const rules = { orderNo: [{ required:true,message:'请输入订单编号' }], productName:[{required:true,message:'请输入产品名称'}], quantity:[{required:true,message:'请输入生产数量'}], startDate:[{required:true,message:'请选择开始日期'}], deadline:[{required:true,message:'请选择交付日期'}] }
const formRef = ref()

async function load() { loading.value=true; try { const result=await ordersApi.list({...filters,page:pagination.page,pageSize:pagination.pageSize}); rows.value=result.items; pagination.total=result.total } catch(e){ ElMessage.error(e.message) } finally{ loading.value=false } }
function applyFilters(){pagination.page=1;load()}
function openCreate(){ editingId.value=null; Object.assign(form,emptyForm()); dialogVisible.value=true }
function openEdit(row){ editingId.value=row.id; Object.assign(form,{...row,startDate:String(row.startDate).slice(0,10),deadline:String(row.deadline).slice(0,10)}); dialogVisible.value=true }
async function submit(){ await formRef.value.validate(); try { editingId.value ? await ordersApi.update(editingId.value,form) : await ordersApi.create(form); ElMessage.success(editingId.value?'订单已更新':'订单已创建'); dialogVisible.value=false; load() } catch(e){ElMessage.error(e.message)} }
async function remove(row){ try{ await ElMessageBox.confirm(`确定删除订单 ${row.orderNo} 吗？`,'删除确认',{type:'warning'}); await ordersApi.remove(row.id); ElMessage.success('订单已删除'); load() }catch(e){if(e!=='cancel') ElMessage.error(e.message)} }
function localToday(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function openReport(row){Object.assign(reportForm,{orderId:row.id,orderNo:row.orderNo,date:localToday(),plannedQuantity:Math.max(0,row.quantity-row.completedQuantity),actualQuantity:0});reportVisible.value=true}
async function submitReport(){try{await productionApi.report({orderId:reportForm.orderId,date:reportForm.date,plannedQuantity:reportForm.plannedQuantity,actualQuantity:reportForm.actualQuantity});ElMessage.success('生产报工成功，订单进度与看板已同步');reportVisible.value=false;load()}catch(e){ElMessage.error(e.message)}}
const progress = row => Math.min(100, Math.round(row.completedQuantity/row.quantity*100))
onMounted(load)
</script>

<template>
  <div class="content-card table-card">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="filters.search" placeholder="搜索订单号或产品名称" clearable :prefix-icon="Search" style="width:250px" @keyup.enter="applyFilters" @clear="applyFilters" />
        <el-select v-model="filters.status" placeholder="全部状态" clearable style="width:130px" @change="applyFilters">
          <el-option label="待生产" value="PENDING"/><el-option label="生产中" value="IN_PROGRESS"/><el-option label="已完成" value="COMPLETED"/><el-option label="已暂停" value="PAUSED"/>
        </el-select>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建订单</el-button>
    </div>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="订单编号" min-width="125"><template #default="{row}"><span class="mono">{{ row.orderNo }}</span></template></el-table-column>
      <el-table-column prop="productName" label="产品名称" min-width="150" />
      <el-table-column label="生产进度" min-width="210"><template #default="{row}"><div class="progress-cell"><el-progress :percentage="progress(row)" :stroke-width="7" :show-text="false"/><span>{{ progress(row) }}%</span></div><small class="qty">{{ row.completedQuantity }} / {{ row.quantity }}</small></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}"><StatusTag :value="row.status"/></template></el-table-column>
      <el-table-column label="开始日期" width="115"><template #default="{row}">{{ formatDate(row.startDate) }}</template></el-table-column>
      <el-table-column label="交付日期" width="115"><template #default="{row}">{{ formatDate(row.deadline) }}</template></el-table-column>
      <el-table-column label="操作" width="175" fixed="right"><template #default="{row}"><el-button v-if="row.status!=='COMPLETED'" link type="success" :icon="DataLine" @click="openReport(row)">报工</el-button><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>
    <div class="table-foot"><span>共 {{ pagination.total }} 条生产订单</span><el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[10,20,50]" layout="sizes, prev, pager, next" @change="load"/></div>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId?'编辑生产订单':'新建生产订单'" width="560px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <div class="form-grid"><el-form-item label="订单编号" prop="orderNo"><el-input v-model="form.orderNo" placeholder="如 ORD2026021"/></el-form-item><el-form-item label="产品名称" prop="productName"><el-input v-model="form.productName"/></el-form-item></div>
      <div class="form-grid"><el-form-item label="计划数量" prop="quantity"><el-input-number v-model="form.quantity" :min="1" style="width:100%"/></el-form-item><el-form-item label="已完成数量"><el-input-number v-model="form.completedQuantity" :min="0" :max="form.quantity" style="width:100%"/></el-form-item></div>
      <div class="form-grid"><el-form-item label="订单状态"><el-select v-model="form.status" style="width:100%"><el-option label="待生产" value="PENDING"/><el-option label="生产中" value="IN_PROGRESS"/><el-option label="已完成" value="COMPLETED"/><el-option label="已暂停" value="PAUSED"/></el-select></el-form-item><div></div></div>
      <div class="form-grid"><el-form-item label="开始日期" prop="startDate"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item><el-form-item label="交付日期" prop="deadline"><el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item></div>
    </el-form>
    <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="submit">保存订单</el-button></template>
  </el-dialog>
  <el-dialog v-model="reportVisible" title="生产报工" width="480px">
    <el-alert title="报工成功后将同步更新订单完成数量与生产看板" type="info" show-icon :closable="false" />
    <el-form :model="reportForm" label-position="top" class="report-form"><el-form-item label="生产订单"><el-input :model-value="reportForm.orderNo" disabled/></el-form-item><div class="form-grid"><el-form-item label="生产日期"><el-date-picker v-model="reportForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item><el-form-item label="当日计划数量"><el-input-number v-model="reportForm.plannedQuantity" :min="0" style="width:100%"/></el-form-item></div><el-form-item label="当日实际完成数量"><el-input-number v-model="reportForm.actualQuantity" :min="0" style="width:100%"/></el-form-item></el-form>
    <template #footer><el-button @click="reportVisible=false">取消</el-button><el-button type="primary" @click="submitReport">确认报工</el-button></template>
  </el-dialog>
</template>

<style scoped>
.qty{color:var(--text-light);font-size:10px;margin-left:0}.table-foot{padding:14px 4px 0;color:var(--text-muted);font-size:11px;display:flex;align-items:center;justify-content:space-between}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.report-form{margin-top:18px}@media(max-width:600px){.form-grid{grid-template-columns:1fr}.table-foot{align-items:flex-start;gap:12px;flex-direction:column}}
</style>
