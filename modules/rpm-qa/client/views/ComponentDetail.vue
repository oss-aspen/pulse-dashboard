<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { ChevronLeft as ChevronLeftIcon, AlertCircle as AlertCircleIcon, Package as PackageIcon } from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api.js'

const nav = inject('moduleNav')

const records = ref([])
const loading = ref(true)
const error = ref(null)

const componentName = computed(() => nav?.params?.value?.component || '')

const record = computed(() =>
  records.value.find(r => r['Component'] === componentName.value) || null
)

async function loadData() {
  if (records.value.length > 0) return
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/rpm-qa/components')
    records.value = data.records || []
  } catch (err) {
    error.value = err.message || 'Failed to load component data'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function goBack() {
  nav.navigateTo('lookup', {})
}

// ── Field groupings ────────────────────────────────────────────────────────

const CONTACTS_GROUP = {
  label: 'QA & Engineering Contacts',
  fields: [
    'QA Contact',
    'Developer',
    'Default Assignee',
    'Docs Contact',
    'Sustaining Engineer',
  ],
}

const EMBARGO_GROUP = {
  label: 'Embargo Contacts',
  fields: [
    'Embargo QA Contact',
    'Embargo Developer',
    'Embargo Docs Contact',
    'Embargo Contributors',
  ],
}

const OWNERSHIP_GROUP = {
  label: 'Ownership & Routing',
  fields: [
    'Assigned Team',
    'SST Pool',
    'Contributors',
    'Watchers',
    'Watching Groups',
    'Cc List',
    'Bootstrap Ownership Confirmed',
  ],
}

const METADATA_GROUP = {
  label: 'Metadata',
  fields: [
    'Component ID',
    'Product',
    'Active',
    'New Name',
    'Description',
  ],
}

const FIELD_GROUPS = [CONTACTS_GROUP, OWNERSHIP_GROUP, METADATA_GROUP, EMBARGO_GROUP]

function fieldValue(field) {
  if (!record.value) return null
  const val = record.value[field]
  return val !== undefined && val !== '' ? val : null
}

function activeBadgeClass(active) {
  const val = (active || '').toLowerCase()
  if (val === 'true' || val === '1' || val === 'yes') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-5">

    <!-- Back button -->
    <button
      type="button"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      @click="goBack"
    >
      <component :is="ChevronLeftIcon" :size="16" />
      Back to search
    </button>

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <div class="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div v-for="i in 8" :key="i" class="h-10 bg-gray-100 dark:bg-gray-700/60 rounded-lg animate-pulse"></div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="error" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 flex items-start gap-3">
      <component :is="AlertCircleIcon" :size="20" class="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-medium text-red-800 dark:text-red-300">Failed to load data</p>
        <p class="text-sm text-red-600 dark:text-red-400 mt-1">{{ error }}</p>
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="!record" class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-12 text-center">
      <component :is="PackageIcon" :size="36" class="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Component not found</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        "{{ componentName }}" could not be found in the current dataset.
      </p>
      <button
        class="mt-4 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        @click="goBack"
      >
        Return to search
      </button>
    </div>

    <!-- Detail card -->
    <template v-else>
      <!-- Header -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ record['Component'] }}
              </h1>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  v-if="record['Product']"
                  class="text-sm text-gray-500 dark:text-gray-400"
                >{{ record['Product'] }}</span>
                <span
                  v-if="record['Component ID']"
                  class="text-xs text-gray-400 dark:text-gray-500 font-mono"
                >ID: {{ record['Component ID'] }}</span>
              </div>
            </div>
            <span
              v-if="record['Active']"
              class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
              :class="activeBadgeClass(record['Active'])"
            >
              {{ record['Active'] }}
            </span>
          </div>
          <p v-if="record['Description']" class="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ record['Description'] }}
          </p>
          <p v-if="record['New Name']" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Renamed to: {{ record['New Name'] }}
          </p>
        </div>

        <!-- Field groups -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <template v-for="group in FIELD_GROUPS" :key="group.label">
            <!-- Skip groups where all fields are empty -->
            <template v-if="group.fields.some(f => fieldValue(f))">
              <div
                class="px-6 py-4"
                :class="group.label.includes('Embargo') ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''"
              >
                <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3"
                  :class="group.label.includes('Embargo') ? 'text-amber-600 dark:text-amber-500' : ''"
                >
                  {{ group.label }}
                </h2>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  <template v-for="field in group.fields" :key="field">
                    <div v-if="fieldValue(field)">
                      <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ field }}</dt>
                      <dd class="mt-0.5 text-sm text-gray-900 dark:text-gray-100 break-words">
                        {{ fieldValue(field) }}
                      </dd>
                    </div>
                  </template>
                </dl>
              </div>
            </template>
          </template>
        </div>
      </div>
    </template>

  </div>
</template>
