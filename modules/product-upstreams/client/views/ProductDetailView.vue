<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <div v-if="loading && !catalog" class="space-y-4">
      <div class="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div class="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div v-else-if="!product" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Product not found in this catalog snapshot.</p>
      <button
        class="mt-4 text-primary-600 dark:text-primary-400 hover:underline text-sm"
        @click="goBack"
      >
        Back to products
      </button>
    </div>

    <template v-else>
      <button
        class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
        data-testid="back-to-products"
        @click="goBack"
      >
        Back to products
      </button>

      <div class="mb-4">
        <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ product.category }} · curated by Red Hat OSAIPO</p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{{ product.name }}</h1>
        <p class="mt-2 text-gray-600 dark:text-gray-400">{{ product.description }}</p>
      </div>

      <div
        v-if="product.available === false"
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-6 text-sm text-gray-600 dark:text-gray-400"
        data-testid="unavailable-product-notice"
      >
        <p class="font-medium text-gray-900 dark:text-gray-100 mb-1">This product is listed but not yet catalogued.</p>
        <p>{{ product.unavailableReason }}</p>
        <p class="mt-2">
          Need this mapping now?
          <a
            v-if="meta && meta.customDataRequestUrl"
            :href="meta.customDataRequestUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-700 dark:text-primary-300 hover:underline"
          >Request custom data</a>
          from OSAIPO.
        </p>
      </div>

      <template v-else>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Upstreams in {{ product.shortName || product.name }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Each row is an upstream project that ships in this product, with the package names and
          versions recorded in the OSAIPO snapshot. URLs go to the public source repositories.
        </p>

        <div class="space-y-4" data-testid="upstream-list">
          <article
            v-for="upstream in product.upstreams"
            :key="upstream.id"
            class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            :data-testid="'upstream-' + upstream.id"
          >
            <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ upstream.name }}</h3>
              <a
                v-if="upstream.url"
                :href="upstream.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary-700 dark:text-primary-300 hover:underline"
              >
                {{ upstream.url }}
              </a>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ upstream.description }}</p>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th class="pb-1 font-medium">Package</th>
                  <th class="pb-1 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pkg in upstream.packages" :key="pkg.name + pkg.version" class="border-t border-gray-100 dark:border-gray-700">
                  <td class="py-1.5 font-mono text-gray-900 dark:text-gray-100">{{ pkg.name }}</td>
                  <td class="py-1.5 text-gray-600 dark:text-gray-300">{{ pkg.version }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      </template>

      <DataOriginCallout :meta="meta" variant="footer" class="mt-8" />
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCatalog } from '../composables/useCatalog.js'
import DataOriginCallout from '../components/DataOriginCallout.vue'

const nav = inject('moduleNav')
const { catalog, loading, error, findProduct } = useCatalog()

const productId = computed(() => nav && nav.params && nav.params.value && nav.params.value.id)
const product = computed(() => findProduct(productId.value))
const meta = computed(() => catalog.value && catalog.value.meta)

function goBack() {
  nav.navigateTo('products')
}
</script>
