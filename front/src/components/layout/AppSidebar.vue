<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BaseIcon from '@/components/ui/BaseIcon.vue'
import { ICONS } from '@/constants/icons'
import { ROLE_MENUS } from '@/constants/roles'
import { useLayoutStore } from '@/stores/layout'
import type { User } from '@/types/user'
import { initialsOf } from '@/utils/initials'

const props = defineProps<{ user: User }>()

defineEmits<{ logout: [] }>()

const route = useRoute()
const layout = useLayoutStore()

const menu = computed(() => ROLE_MENUS[props.user.role])
const toggleLabel = computed(() =>
  layout.sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral',
)

const isActive = (name: string) => route.name === name || route.meta.parent === name
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': layout.sidebarCollapsed }">
    <div class="sidebar__top">
      <div class="sidebar__brand sidebar__fade">Tickets de Soporte</div>
      <button
        type="button"
        class="sidebar__toggle"
        :title="toggleLabel"
        :aria-label="toggleLabel"
        @click="layout.toggleSidebar"
      >
        <BaseIcon :path="layout.sidebarCollapsed ? ICONS.expand : ICONS.collapse" :size="18" />
      </button>
    </div>

    <nav class="sidebar__nav" :aria-label="menu.section">
      <div class="sidebar__section sidebar__fade">{{ menu.section }}</div>
      <div v-for="item in menu.items" :key="item.route" class="sidebar__item">
        <RouterLink
          :to="{ name: item.route }"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': isActive(item.route) }"
          :aria-current="isActive(item.route) ? 'page' : undefined"
          :aria-label="item.label"
        >
          <BaseIcon :path="item.icon" class="sidebar__icon" />
          <span class="sidebar__fade">{{ item.label }}</span>
        </RouterLink>
        <div role="tooltip" class="sidebar__tooltip">{{ item.label }}</div>
      </div>
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__item sidebar__user">
        <div class="sidebar__avatar">{{ initialsOf(user.name) }}</div>
        <div class="sidebar__user-text sidebar__fade">
          <div class="sidebar__user-name">{{ user.name }}</div>
          <div class="sidebar__user-role">{{ menu.label }}</div>
        </div>
        <div role="tooltip" class="sidebar__tooltip sidebar__tooltip--user">
          {{ user.name }}<br />
          <span class="sidebar__tooltip-role">{{ menu.label }}</span>
        </div>
      </div>
      <div class="sidebar__item">
        <button
          type="button"
          class="sidebar__logout"
          aria-label="Cerrar sesión"
          @click="$emit('logout')"
        >
          <BaseIcon :path="ICONS.logout" class="sidebar__icon" />
          <span class="sidebar__fade">Cerrar sesión</span>
        </button>
        <div role="tooltip" class="sidebar__tooltip">Cerrar sesión</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  z-index: 5;
  display: flex;
  flex: none;
  flex-direction: column;
  width: 248px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  transition: width 0.22s var(--ease-standard);
}

.sidebar--collapsed {
  width: 72px;
}

.sidebar__fade {
  transition: opacity 0.16s ease;
}

.sidebar--collapsed .sidebar__fade {
  opacity: 0;
}

.sidebar__top {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 64px;
  padding: 0 18px;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}

.sidebar__brand {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-15);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.005em;
  white-space: nowrap;
}

.sidebar__toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-6);
  color: var(--color-text-muted);
  cursor: pointer;
}

.sidebar__toggle:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.sidebar__nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 20px 12px;
}

.sidebar__section {
  padding: 0 14px 8px;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.sidebar__item {
  position: relative;
}

.sidebar__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 40px;
  padding: 0 14px;
  overflow: hidden;
  border-radius: var(--radius-6);
  color: var(--color-text);
  font-size: var(--font-size-14);
  white-space: nowrap;
}

.sidebar__link:hover {
  background: var(--color-fill-hover);
  color: var(--color-accent);
  text-decoration: none;
}

.sidebar__link--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: var(--font-weight-semibold);
}

.sidebar__link--active::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  background: var(--color-accent);
  border-radius: 0 var(--radius-2) var(--radius-2) 0;
}

.sidebar__icon {
  flex: none;
}

.sidebar__tooltip {
  position: absolute;
  top: 50%;
  left: 58px;
  z-index: 20;
  display: none;
  padding: 5px 9px;
  background: var(--color-text);
  border-radius: var(--radius-4);
  color: var(--color-text-inverse);
  font-size: var(--font-size-12);
  pointer-events: none;
  transform: translateY(-50%);
  white-space: nowrap;
}

.sidebar--collapsed .sidebar__item:hover .sidebar__tooltip,
.sidebar--collapsed .sidebar__item:focus-within .sidebar__tooltip {
  display: block;
}

.sidebar__tooltip--user {
  padding: 6px 10px;
  line-height: 1.4;
}

.sidebar__tooltip-role {
  color: var(--color-text-inverse-muted);
}

.sidebar__footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 12px;
  border-top: 1px solid var(--color-border);
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
}

.sidebar__avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-accent-ring);
  border-radius: 50%;
  color: var(--color-accent);
  font-size: var(--font-size-12);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
}

.sidebar__user-text {
  min-width: 0;
  line-height: 1.3;
}

.sidebar__user-name {
  overflow: hidden;
  font-size: var(--font-size-13);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__user-role {
  color: var(--color-text-muted);
  font-size: var(--font-size-12);
  white-space: nowrap;
}

.sidebar__logout {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 40px;
  padding: 0 14px;
  overflow: hidden;
  background: transparent;
  border: none;
  border-radius: var(--radius-6);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-14);
  text-align: left;
  white-space: nowrap;
}

.sidebar__logout:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
</style>
