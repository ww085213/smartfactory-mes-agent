<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Refresh, Warning, CircleCheck, Clock } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { alertsApi, equipmentApi } from '../api/index.js'
import { formatDateTime } from '../utils/status.js'
import StatusTag from '../components/StatusTag.vue'

const rows=ref([]),equipment=ref([]),loading=ref(false),dialogVisible=ref(false),editingId=ref(null),formRef=ref()
const filters=reactive({status:'',level:''})
const pagination=reactive({page:1,pageSize:20,total:0})
const emptyForm=()=>({equipmentId:null,alertType:'',description:'',level:'MEDIUM',status:'OPEN'})
const form=reactive(emptyForm())
const stats=computed(()=>({open:rows.value.filter(i=>i.status==='OPEN').length,processing:rows.value.filter(i=>i.status==='PROCESSING').length,resolved:rows.value.filter(i=>i.status==='RESOLVED').length,critical:rows.value.filter(i=>i.level==='CRITICAL').length}))
async function load(){loading.value=true;try{const [alertResult,equipmentResult]=await Promise.all([alertsApi.list({...filters,page:pagination.page,pageSize:pagination.pageSize}),equipmentApi.list({pageSize:100})]);rows.value=alertResult.items;pagination.total=alertResult.total;equipment.value=equipmentResult.items}catch(e){ElMessage.error(e.message)}finally{loading.value=false}}
function applyFilters(){pagination.page=1;load()}
function openCreate(){editingId.value=null;Object.assign(form,emptyForm());dialogVisible.value=true}
function openEdit(row){editingId.value=row.id;Object.assign(form,{equipmentId:row.equipmentId,alertType:row.alertType,description:row.description,level:row.level,status:row.status});dialogVisible.value=true}
async function submit(){await formRef.value.validate();try{editingId.value?await alertsApi.update(editingId.value,form):await alertsApi.create(form);ElMessage.success('异常信息已保存');dialogVisible.value=false;load()}catch(e){ElMessage.error(e.message)}}
async function resolve(row){try{await alertsApi.update(row.id,{status:'RESOLVED'});ElMessage.success('异常已标记为解决');load()}catch(e){ElMessage.error(e.message)}}
async function remove(row){try{await ElMessageBox.confirm('确定删除这条异常记录吗？','删除确认',{type:'warning'});await alertsApi.remove(row.id);ElMessage.success('记录已删除');load()}catch(e){if(e!=='cancel')ElMessage.error(e.message)}}
onMounted(load)
</script>

<template>
  <div class="alert-stats">
    <div class="panel-card red"><span><el-icon><Warning/></el-icon></span><div><small>待处理</small><strong>{{stats.open}}</strong></div></div>
    <div class="panel-card orange"><span><el-icon><Clock/></el-icon></span><div><small>处理中</small><strong>{{stats.processing}}</strong></div></div>
    <div class="panel-card green"><span><el-icon><CircleCheck/></el-icon></span><div><small>已解决</small><strong>{{stats.resolved}}</strong></div></div>
    <div class="panel-card purple"><span><el-icon><Warning/></el-icon></span><div><small>紧急异常</small><strong>{{stats.critical}}</strong></div></div>
  </div>
  <div class="content-card table-card">
    <div class="toolbar"><div class="toolbar-left"><el-select v-model="filters.status" placeholder="全部处理状态" clearable style="width:145px" @change="applyFilters"><el-option label="待处理" value="OPEN"/><el-option label="处理中" value="PROCESSING"/><el-option label="已解决" value="RESOLVED"/></el-select><el-select v-model="filters.level" placeholder="全部级别" clearable style="width:125px" @change="applyFilters"><el-option label="低" value="LOW"/><el-option label="中" value="MEDIUM"/><el-option label="高" value="HIGH"/><el-option label="紧急" value="CRITICAL"/></el-select><el-button :icon="Refresh" @click="load">刷新</el-button></div><el-button type="primary" :icon="Plus" @click="openCreate">上报异常</el-button></div>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="级别" width="85"><template #default="{row}"><StatusTag :value="row.level"/></template></el-table-column>
      <el-table-column label="设备" min-width="160"><template #default="{row}"><div class="equipment-cell"><strong>{{row.equipment?.equipmentNo||'-'}}</strong><span>{{row.equipment?.name||'非设备异常'}}</span></div></template></el-table-column>
      <el-table-column prop="alertType" label="异常类型" width="125"/>
      <el-table-column prop="description" label="异常描述" min-width="250" show-overflow-tooltip/>
      <el-table-column label="发生时间" width="170"><template #default="{row}">{{formatDateTime(row.createdAt)}}</template></el-table-column>
      <el-table-column label="处理状态" width="100"><template #default="{row}"><StatusTag :value="row.status"/></template></el-table-column>
      <el-table-column label="操作" width="165" fixed="right"><template #default="{row}"><el-button v-if="row.status!=='RESOLVED'" link type="success" @click="resolve(row)">解决</el-button><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>
    <div class="table-foot"><span>共 {{pagination.total}} 条异常</span><el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[10,20,50]" layout="sizes, prev, pager, next" @change="load"/></div>
  </div>
  <el-dialog v-model="dialogVisible" :title="editingId?'编辑异常':'上报生产异常'" width="540px">
    <el-form ref="formRef" :model="form" label-position="top"><el-form-item label="关联设备"><el-select v-model="form.equipmentId" clearable placeholder="选择设备（可选）" style="width:100%"><el-option v-for="item in equipment" :key="item.id" :label="`${item.equipmentNo} · ${item.name}`" :value="item.id"/></el-select></el-form-item><div class="form-grid"><el-form-item label="异常类型" prop="alertType" :rules="[{required:true,message:'请输入异常类型'}]"><el-input v-model="form.alertType" placeholder="如 温度异常"/></el-form-item><el-form-item label="异常级别"><el-select v-model="form.level" style="width:100%"><el-option label="低" value="LOW"/><el-option label="中" value="MEDIUM"/><el-option label="高" value="HIGH"/><el-option label="紧急" value="CRITICAL"/></el-select></el-form-item></div><el-form-item label="异常描述" prop="description" :rules="[{required:true,message:'请输入异常描述'}]"><el-input v-model="form.description" type="textarea" :rows="3"/></el-form-item><el-form-item label="处理状态"><el-select v-model="form.status" style="width:100%"><el-option label="待处理" value="OPEN"/><el-option label="处理中" value="PROCESSING"/><el-option label="已解决" value="RESOLVED"/></el-select></el-form-item></el-form>
    <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="submit">保存异常</el-button></template>
  </el-dialog>
</template>

<style scoped>
.alert-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:16px}.alert-stats>.panel-card{padding:17px 20px;display:flex;align-items:center;gap:13px}.alert-stats>.panel-card>span{width:38px;height:38px;border-radius:10px;display:grid;place-items:center}.alert-stats .red>span{background:#feecec;color:#eb5555}.alert-stats .orange>span{background:#fff3e5;color:#e99b31}.alert-stats .green>span{background:#e9f9f3;color:#16a675}.alert-stats .purple>span{background:#f2edff;color:#8557de}.alert-stats div div{display:flex;flex-direction:column;gap:2px}.alert-stats small{color:var(--text-muted)}.alert-stats strong{font-size:19px}.equipment-cell{display:flex;flex-direction:column;gap:3px}.equipment-cell strong{font-size:12px;color:#3268b9}.equipment-cell span{font-size:10px;color:var(--text-muted)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.table-foot{padding:14px 4px 0;color:var(--text-muted);font-size:11px;display:flex;align-items:center;justify-content:space-between}@media(max-width:850px){.alert-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.form-grid{grid-template-columns:1fr}.table-foot{align-items:flex-start;gap:12px;flex-direction:column}}
</style>
