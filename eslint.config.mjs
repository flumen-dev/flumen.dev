// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  files: ['app/components/ui/MarkdownRenderer.vue'],
  rules: {
    'vue/no-v-html': 'off',
  },
})
