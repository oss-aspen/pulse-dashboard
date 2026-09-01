import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SearchView from '../../client/views/SearchView.vue'
import { _resetForTesting } from '../../client/composables/useCatalog.js'

const catalog = {
  meta: {
    stewardTeam: 'Red Hat AI Engineering',
    sourceNote: 'Static snapshot for tests.',
    lastUpdated: '2026-09-01',
    featureRequestUrl: 'https://example.test/feature',
    customDataRequestUrl: 'https://example.test/custom',
    issuesUrl: 'https://example.test/issues'
  },
  products: [
    {
      id: 'rhaiis',
      name: 'Red Hat AI Inference Server',
      shortName: 'RHAIIS',
      available: true,
      upstreams: [
        {
          id: 'vllm',
          name: 'vLLM',
          url: 'https://github.com/vllm-project/vllm',
          packages: [
            { name: 'vllm', version: '0.8.5' },
            { name: 'vllm-flash-attn', version: '2.7.4' }
          ]
        }
      ]
    },
    {
      id: 'llama-stack',
      name: 'Llama Stack',
      available: false,
      upstreams: [
        { id: 'llama', name: 'Llama', url: 'https://github.com/meta-llama/llama', packages: [{ name: 'llama', version: '0.1.0' }] }
      ]
    }
  ]
}

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api.js'

function mountView(q = '') {
  const params = ref({ q })
  return mount(SearchView, {
    global: {
      provide: {
        moduleNav: {
          navigateTo: vi.fn(),
          updateParams: vi.fn(),
          params
        }
      }
    }
  })
}

describe('SearchView', () => {
  beforeEach(() => {
    _resetForTesting()
    vi.clearAllMocks()
  })

  it('shows origin copy and searches packages', async () => {
    apiRequest.mockResolvedValue(catalog)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Package Search')
    expect(wrapper.text()).toContain('Red Hat AI Engineering')
    expect(wrapper.find('[data-testid="search-empty-hint"]').exists()).toBe(true)

    await wrapper.find('[data-testid="package-search-input"]').setValue('vllm')
    await flushPromises()

    const table = wrapper.find('[data-testid="package-search-results"]')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('vllm')
    expect(table.text()).toContain('0.8.5')
    expect(table.text()).toContain('Red Hat AI Inference Server')
    expect(table.text()).toContain('https://github.com/vllm-project/vllm')
    expect(table.text()).not.toContain('llama-stack')
  })

  it('shows a no-results state with a custom data request', async () => {
    apiRequest.mockResolvedValue(catalog)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-testid="package-search-input"]').setValue('not-a-real-package')
    await flushPromises()

    expect(wrapper.find('[data-testid="search-no-results"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Request custom data')
  })
})
