import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        'i18n/i18n.config.ts!',
        'app/pages/**/*.vue!',
        'app/components/**/*.vue!',
        'app/layouts/**/*.vue!',
        'app/composables/**/*.ts!',
        'app/stores/**/*.ts!',
        'app/utils/**/*.ts!',
        'app/middleware/**/*.ts!',
        'server/**/*.ts!',
        'shared/**/*.ts!',
      ],
      project: ['**/*.{ts,vue,cjs,mjs}', '!test/fixtures/**'],
      ignoreDependencies: ['flat', 'unstorage', 'h3', 'unhead', '@upstash/redis', '@iconify-json/simple-icons', '@iconify-json/lucide', 'vue-tsc', '@vue/language-core'],
    },
  },
}

export default config
