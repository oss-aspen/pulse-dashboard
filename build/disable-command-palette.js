/**
 * Strip core's "press / to explore" command palette from App.vue.
 * Needles must match @org-pulse/core src/components/App.vue; tests fail if they drift.
 */

const SEARCH_HINT_BUTTON = `          <button
            v-if="!showCommandPalette"
            @click="showCommandPalette = true; usedThisSession = true; fetchSearchIndex()"
            :class="[
              'absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 px-4 py-1.5 text-sm rounded-md cursor-pointer transition-all duration-200',
              !usedThisSession
                ? 'search-hint-breathe scope-chip-btn'
                : 'scope-chip-btn'
            ]"
          >
            <span class="font-medium tracking-wide">press</span>
            <kbd class="scope-chip-kbd px-2 py-0.5 text-xs font-bold rounded-md border shadow-sm">/</kbd>
            <span class="font-medium tracking-wide">to explore</span>
          </button>
`

const COMMAND_PALETTE_COMPONENT = `    <CommandPalette
      v-if="showCommandPalette"
      :manifests="builtInManifests"
      :is-admin="authIsAdmin"
      :is-team-admin="authIsTeamAdmin"
      :is-manager="authIsManager"
      :roles="authRoles"
      :team-data-source="rosterData?.teamDataSource || ''"
      :search-index-items="searchIndexItems"
      @navigate="handlePaletteNavigate"
      @action="handlePaletteAction"
      @close="showCommandPalette = false"
    />
`

const SLASH_KEY_HANDLER = `      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.activeElement
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return
        if (this.showCommandPalette) return
        e.preventDefault()
        this.showCommandPalette = true
        this.usedThisSession = true
        this.fetchSearchIndex()
      }
`

function mustReplace(code, needle, replacement, label) {
  if (!code.includes(needle)) {
    throw new Error(`[disable-command-palette] ${label}: needle not found — core App.vue may have changed`)
  }
  return code.replace(needle, replacement)
}

export function isCoreAppVue(id) {
  const [bare, query] = String(id || '').replace(/\\/g, '/').split('?')
  if (query) return false
  return bare.endsWith('/src/components/App.vue')
}

export function stripCommandPalette(code) {
  let next = mustReplace(code, SEARCH_HINT_BUTTON, '', 'search hint button')
  next = mustReplace(next, COMMAND_PALETTE_COMPONENT, '', 'CommandPalette component')
  next = mustReplace(next, SLASH_KEY_HANDLER, '', 'slash key handler')
  return next
}

export function disableCommandPalettePlugin() {
  return {
    name: 'disable-command-palette',
    enforce: 'pre',
    transform(code, id) {
      if (!isCoreAppVue(id)) return
      return { code: stripCommandPalette(code), map: null }
    }
  }
}
