<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { Search as SearchIcon, AlertCircle as AlertCircleIcon, Package as PackageIcon } from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api.js'
import { useComponentSearch } from '../composables/useComponentSearch.js'

const nav = inject('moduleNav')

const records = ref([])
const loadedAt = ref(null)
const loading = ref(true)
const error = ref(null)

// ── Filters ────────────────────────────────────────────────────────────────

const selectedProduct = ref('')
const selectedActive = ref('')

const { query, results: searchResults } = useComponentSearch(records)

const products = computed(() => {
  const set = new Set()
  for (const r of records.value) {
    if (r['Product']) set.add(r['Product'])
  }
  return Array.from(set).sort()
})

/** Apply Product and Active filters on top of fuzzy search results */
const filteredResults = computed(() => {
  let rows = searchResults.value
  if (selectedProduct.value) {
    rows = rows.filter(r => r['Product'] === selectedProduct.value)
  }
  if (selectedActive.value !== '') {
    rows = rows.filter(r => (r['Active'] || '').toLowerCase() === selectedActive.value)
  }
  return rows
})

const hasActiveFilters = computed(() =>
  query.value.trim() !== '' || selectedProduct.value !== '' || selectedActive.value !== ''
)

// ── Data loading ───────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/rpm-qa/components')
    records.value = data.records || []
    loadedAt.value = data.loadedAt || null
  } catch (err) {
    error.value = err.message || 'Failed to load component data'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ── Navigation ─────────────────────────────────────────────────────────────

function openDetail(component) {
  nav.navigateTo('detail', { component: component['Component'] })
}

function clearFilters() {
  query.value = ''
  selectedProduct.value = ''
  selectedActive.value = ''
}

// ── Helpers ────────────────────────────────────────────────────────────────

function activeBadgeClass(active) {
  const val = (active || '').toLowerCase()
  if (val === 'true' || val === '1' || val === 'yes') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }
  if (val === 'false' || val === '0' || val === 'no') {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
  }
  return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500'
}

function activeLabel(active) {
  const val = (active || '').toLowerCase()
  if (val === 'true' || val === '1' || val === 'yes') return 'Active'
  if (val === 'false' || val === '0' || val === 'no') return 'Inactive'
  return active || '—'
}
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-5">

    <!-- Header -->
    <div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Component Lookup</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Search for RPM components to find QA contacts and ownership metadata.
      </p>
    </div>

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
          <div class="h-9 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="i in 8" :key="i" class="px-4 py-3 flex gap-4">
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-40"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 flex items-start gap-3">
      <component :is="AlertCircleIcon" :size="20" class="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-medium text-red-800 dark:text-red-300">Failed to load components</p>
        <p class="text-sm text-red-600 dark:text-red-400 mt-1">{{ error }}</p>
        <button
          class="mt-3 text-sm font-medium text-red-700 dark:text-red-300 hover:underline"
          @click="loadData"
        >Retry</button>
      </div>
    </div>

    <!-- No data uploaded yet -->
    <div
      v-else-if="records.length === 0"
      class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-12 text-center"
    >
      <component :is="PackageIcon" :size="40" class="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No component data loaded</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Upload a CSV file in Settings &rsaquo; RPM QA Lookup to get started.
      </p>
    </div>

    <!-- Main table -->
    <template v-else>
      <!-- Search + filter bar -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
          <div class="flex flex-col sm:flex-row gap-2">
            <!-- Fuzzy search -->
            <div class="relative flex-1">
              <component
                :is="SearchIcon"
                :size="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                v-model="query"
                type="text"
                placeholder="Search by component, QA contact, developer…"
                class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none
                       placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <!-- Product filter -->
            <select
              v-model="selectedProduct"
              class="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All products</option>
              <option v-for="p in products" :key="p" :value="p">{{ p }}</option>
            </select>

            <!-- Active filter -->
            <select
              v-model="selectedActive"
              class="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg
                     focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Any status</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>

          <!-- Result count + clear -->
          <div class="flex items-center justify-between mt-2">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              <template v-if="hasActiveFilters">
                {{ filteredResults.length }} of {{ records.length }} components
              </template>
              <template v-else>
                {{ records.length }} components
                <span v-if="loadedAt" class="ml-2 text-gray-400 dark:text-gray-500">
                  · loaded {{ new Date(loadedAt).toLocaleDateString() }}
                </span>
              </template>
            </p>
            <button
              v-if="hasActiveFilters"
              class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th class="px-4 py-3 font-medium">Component</th>
                <th class="px-4 py-3 font-medium">Product</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium">QA Contact</th>
                <th class="px-4 py-3 font-medium">Developer</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="row in filteredResults"
                :key="row['Component ID'] || row['Component']"
                class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30 cursor-pointer"
                @click="openDetail(row)"
              >
                <td class="px-4 py-2.5">
                  <button
                    type="button"
                    class="text-left font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {{ row['Component'] || '—' }}
                  </button>
                  <div v-if="row['New Name']" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    → {{ row['New Name'] }}
                  </div>
                </td>
                <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ row['Product'] || '—' }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  <span
                    v-if="row['Active']"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="activeBadgeClass(row['Active'])"
                  >
                    {{ activeLabel(row['Active']) }}
                  </span>
                  <span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
                </td>
                <td class="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {{ row['QA Contact'] || '—' }}
                </td>
                <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                  {{ row['Developer'] || row['Default Assignee'] || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty state (filters produced nothing) -->
        <div v-if="filteredResults.length === 0" class="py-12 text-center">
          <component :is="SearchIcon" :size="32" class="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p class="text-sm text-gray-500 dark:text-gray-400">No components match your search.</p>
          <button
            class="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>
      </div>
    </template>

  </div>
</template>
