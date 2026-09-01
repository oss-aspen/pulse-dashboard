import { defineAsyncComponent } from 'vue'

export const routes = {
  'products': defineAsyncComponent(() => import('./views/ProductsView.vue')),
  'search': defineAsyncComponent(() => import('./views/SearchView.vue')),
  'product-detail': defineAsyncComponent(() => import('./views/ProductDetailView.vue')),
}
