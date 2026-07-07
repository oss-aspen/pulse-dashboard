import { defineAsyncComponent } from 'vue'

export const routes = {
  'lookup': defineAsyncComponent(() => import('./views/LookupView.vue')),
  'detail': defineAsyncComponent(() => import('./views/ComponentDetail.vue')),
}
