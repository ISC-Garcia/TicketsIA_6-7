import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'

describe('App', () => {
  it('renderiza la ruta activa y la región de avisos', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => h('h1', 'Ruta activa') } }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, { global: { plugins: [router, createPinia()] } })

    expect(wrapper.text()).toContain('Ruta activa')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })
})
