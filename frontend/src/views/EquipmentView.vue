<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Search, Refresh, Monitor, Timer } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { equipmentApi } from '../api/index.js'
import StatusTag from '../components/StatusTag.vue'

const rows=ref([]),loading=ref(false),dialogVisible=ref(false),editingId=ref(null),formRef=ref()
const filters=reactive({search:'',status:''})
const pagination=reactive({page:1,pageSize:20,total:0})
const emptyForm=()=>({equipmentNo:'',name:'',status:'RUNNING',productionLine:'生产线 1',runtimeHours:0,utilizationRate:0})
const form=reactive(emptyForm())
const counts=computed(()=>Object.fromEntries(['RUNNING','STOPPED','FAULT','MAINTENANCE'].map(s=>[s,rows.value.filter(i=>i.status===s).length])))
async function load(){loading.value=true;try{const result=await equipmentApi.list({...filters,page:pagination.page,pageSize:pagination.pageSize});rows.value=result.items;pagination.total=result.total}catch(e){ElMessage.error(e.message)}finally{loading.value=false}}
function applyFilters(){pagination.page=1;load()}
function openCreate(){editingId.value=null;Object.assign(form,emptyForm());dialogVisible.value=true}
function openEdit(row){editingId.value=row.id;Object.assign(form,row);dialogVisible.value=true}
async function submit(){await formRef.value.validate();try{editingId.value?await equipmentApi.update(editingId.value,form):await equipmentApi.create(form);ElMessage.success('设备信息已保存');dialogVisible.value=false;load()}catch(e){ElMessage.error(e.message)}}
async function remove(row){try{await ElMessageBox.confirm(`确定删除设备 ${row.equipmentNo} 吗？`,'删除确认',{type:'warning'});await equipmentApi.remove(row.id);ElMessage.success('设备已删除');load()}catch(e){if(e!=='cancel')ElMessage.error(e.message)}}
onMounted(load)
</script>

<template>
  <div class="mini-stats">
    <div class="panel-card"><span class="dot running"></span><div><small>运行中</small><strong>{{counts.RUNNING||0}} 台</strong></div></div>
    <div class="panel-card"><span class="dot stopped"></span><div><small>已停机</small><strong>{{counts.STOPPED||0}} 台</strong></div></div>
    <div class="panel-card"><span class="dot fault"></span><div><small>故障</small><strong>{{counts.FAULT||0}} 台</strong></div></div>
    <div class="panel-card"><span class="dot maintenance"></span><div><small>维护中</small><strong>{{counts.MAINTENANCE||0}} 台</strong></div></div>
  </div>
  <div class="content-card table-card">
    <div class="toolbar"><div class="toolbar-left"><el-input v-model="filters.search" placeholder="搜索设备编号或名称" clearable :prefix-icon="Search" style="width:250px" @keyup.enter="applyFilters" @clear="applyFilters"/><el-select v-model="filters.status" placeholder="全部状态" clearable style="width:130px" @change="applyFilters"><el-option label="运行中" value="RUNNING"/><el-option label="已停机" value="STOPPED"/><el-option label="故障" value="FAULT"/><el-option label="维护中" value="MAINTENANCE"/></el-select><el-button :icon="Refresh" @click="load">刷新</el-button></div><el-button type="primary" :icon="Plus" @click="openCreate">新增设备</el-button></div>
    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column label="设备编号" width="120"><template #default="{row}"><span class="mono">{{row.equipmentNo}}</span></template></el-table-column>
      <el-table-column label="设备名称" min-width="190"><template #default="{row}"><div class="device-name"><span><el-icon><Monitor/></el-icon></span><strong>{{row.name}}</strong></div></template></el-table-column>
      <el-table-column prop="productionLine" label="所属区域" width="130"/>
      <el-table-column label="设备状态" width="110"><template #default="{row}"><StatusTag :value="row.status"/></template></el-table-column>
      <el-table-column label="累计运行" width="150"><template #default="{row}"><span class="runtime"><el-icon><Timer/></el-icon>{{Number(row.runtimeHours).toLocaleString()}} h</span></template></el-table-column>
      <el-table-column label="利用率" min-width="160"><template #default="{row}"><div class="progress-cell"><el-progress :percentage="Number(row.utilizationRate)" :stroke-width="7" :show-text="false"/><span>{{Number(row.utilizationRate).toFixed(1)}}%</span></div></template></el-table-column>
      <el-table-column label="操作" width="125" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEdit(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
    </el-table>
    <div class="table-foot"><span>共 {{pagination.total}} 台设备</span><el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[10,20,50]" layout="sizes, prev, pager, next" @change="load"/></div>
  </div>
  <el-dialog v-model="dialogVisible" :title="editingId?'编辑设备':'新增设备'" width="520px">
    <el-form ref="formRef" :model="form" label-position="top"><div class="form-grid"><el-form-item label="设备编号" prop="equipmentNo" :rules="[{required:true,message:'请输入设备编号'}]"><el-input v-model="form.equipmentNo" placeholder="如 EQ-011"/></el-form-item><el-form-item label="设备名称" prop="name" :rules="[{required:true,message:'请输入设备名称'}]"><el-input v-model="form.name"/></el-form-item></div><div class="form-grid"><el-form-item label="所属区域"><el-input v-model="form.productionLine"/></el-form-item><el-form-item label="当前状态"><el-select v-model="form.status" style="width:100%"><el-option label="运行中" value="RUNNING"/><el-option label="已停机" value="STOPPED"/><el-option label="故障" value="FAULT"/><el-option label="维护中" value="MAINTENANCE"/></el-select></el-form-item></div><div class="form-grid"><el-form-item label="累计运行时间（小时）"><el-input-number v-model="form.runtimeHours" :min="0" style="width:100%"/></el-form-item><el-form-item label="设备利用率（%）"><el-input-number v-model="form.utilizationRate" :min="0" :max="100" :precision="1" style="width:100%"/></el-form-item></div></el-form>
    <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="submit">保存设备</el-button></template>
  </el-dialog>
</template>

<style scoped>
.mini-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:16px}.mini-stats>.panel-card{padding:17px 20px;display:flex;align-items:center;gap:13px}.mini-stats .dot{width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 5px #eee}.dot.running{background:#18ad78;box-shadow:0 0 0 5px #18ad7815}.dot.stopped{background:#9ba5b4;box-shadow:0 0 0 5px #9ba5b415}.dot.fault{background:#ed5656;box-shadow:0 0 0 5px #ed565615}.dot.maintenance{background:#eaa23a;box-shadow:0 0 0 5px #eaa23a15}.mini-stats div div{display:flex;flex-direction:column;gap:3px}.mini-stats small{color:var(--text-muted)}.mini-stats strong{font-size:17px}.device-name{display:flex;align-items:center;gap:10px}.device-name>span{width:30px;height:30px;border-radius:8px;background:#edf4ff;color:#3478e8;display:grid;place-items:center}.device-name strong{font-size:13px}.runtime{display:flex;align-items:center;gap:6px;color:#647389}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.table-foot{padding:14px 4px 0;color:var(--text-muted);font-size:11px;display:flex;align-items:center;justify-content:space-between}@media(max-width:850px){.mini-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.form-grid{grid-template-columns:1fr}.table-foot{align-items:flex-start;gap:12px;flex-direction:column}}
</style>
