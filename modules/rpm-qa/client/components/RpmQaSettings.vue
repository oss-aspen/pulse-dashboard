<script setup>
import { ref, onMounted } from 'vue'
import { Upload as UploadIcon, CheckCircle as CheckCircleIcon, AlertCircle as AlertCircleIcon } from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api.js'

const status = ref(null)        // { total, loadedAt, headers }
const uploading = ref(false)
const uploadResult = ref(null)  // { success, total, loadedAt } | { error }
const dragOver = ref(false)

async function loadStatus() {
  try {
    const data = await apiRequest('/modules/rpm-qa/components')
    status.value = {
      total: data.total,
      loadedAt: data.loadedAt,
      headers: data.headers || [],
    }
  } catch {
    status.value = null
  }
}

onMounted(loadStatus)

async function uploadFile(file) {
  if (!file) return
  if (!file.name.endsWith('.csv') && file.type !== 'text/plain' && file.type !== 'text/csv') {
    uploadResult.value = { error: 'Please select a .csv file' }
    return
  }

  uploading.value = true
  uploadResult.value = null

  try {
    const text = await file.text()
    const result = await apiRequest('/modules/rpm-qa/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    })
    uploadResult.value = { success: true, total: result.total, loadedAt: result.loadedAt }
    status.value = { total: result.total, loadedAt: result.loadedAt, headers: result.headers || [] }
  } catch (err) {
    uploadResult.value = { error: err.message || 'Upload failed' }
  } finally {
    uploading.value = false
  }
}

function onFileInput(event) {
  uploadFile(event.target.files[0])
  // Reset so the same file can be re-uploaded
  event.target.value = ''
}

function onDrop(event) {
  event.preventDefault()
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  uploadFile(file)
}

function formatDate(iso) {
  if (!iso) return 'unknown'
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div class="space-y-6 max-w-xl">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Component Data</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Upload a semicolon-delimited CSV export from BugZilla (or compatible tool).
        The first row must be the header row. Uploading replaces all existing data immediately.
      </p>
    </div>

    <!-- Current status -->
    <div
      v-if="status"
      class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 text-sm"
    >
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="text-gray-700 dark:text-gray-300 font-medium">
          {{ status.total.toLocaleString() }} components loaded
        </span>
        <span class="text-gray-400 dark:text-gray-500 text-xs">
          Last updated {{ formatDate(status.loadedAt) }}
        </span>
      </div>
      <div v-if="status.headers.length > 0" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        {{ status.headers.length }} fields: {{ status.headers.slice(0, 6).join(', ') }}<span v-if="status.headers.length > 6">…</span>
      </div>
    </div>
    <div
      v-else
      class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/20 px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
    >
      No data loaded yet.
    </div>

    <!-- Drop zone / file picker -->
    <div
      class="rounded-xl border-2 border-dashed transition-colors cursor-pointer"
      :class="dragOver
        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-white dark:bg-gray-800'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop="onDrop"
      @click="$refs.fileInput.click()"
    >
      <div class="flex flex-col items-center justify-center py-8 px-4 text-center pointer-events-none">
        <component
          :is="UploadIcon"
          :size="28"
          class="mb-2 transition-colors"
          :class="dragOver ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'"
        />
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          <span v-if="uploading">Uploading…</span>
          <span v-else>Drop CSV here or click to browse</span>
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Semicolon-delimited, header row required
        </p>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv,text/plain"
        class="hidden"
        @change="onFileInput"
      />
    </div>

    <!-- Upload result -->
    <div
      v-if="uploadResult"
      class="rounded-lg px-4 py-3 flex items-start gap-3 text-sm"
      :class="uploadResult.success
        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'"
    >
      <component
        :is="uploadResult.success ? CheckCircleIcon : AlertCircleIcon"
        :size="18"
        class="shrink-0 mt-0.5"
        :class="uploadResult.success ? 'text-green-500' : 'text-red-500'"
      />
      <div>
        <template v-if="uploadResult.success">
          <p class="font-medium text-green-800 dark:text-green-300">Upload successful</p>
          <p class="text-green-700 dark:text-green-400 mt-0.5">
            {{ uploadResult.total.toLocaleString() }} components loaded at {{ formatDate(uploadResult.loadedAt) }}.
          </p>
        </template>
        <template v-else>
          <p class="font-medium text-red-800 dark:text-red-300">Upload failed</p>
          <p class="text-red-700 dark:text-red-400 mt-0.5">{{ uploadResult.error }}</p>
        </template>
      </div>
    </div>
  </div>
</template>
