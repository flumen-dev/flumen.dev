import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        'app/app.config.ts!',
        'app/app.vue!',
        'app/pages/**/*.vue!',
        'app/components/**/*.vue!',
        'app/layouts/**/*.vue!',
        'app/composables/**/*.ts!',
        'app/utils/**/*.ts!',
        'app/middleware/**/*.ts!',
        'server/**/*.ts!',
        'shared/**/*.ts!',
      ],
      project: ['**/*.{ts,vue,cjs,mjs}', '!test/fixtures/**'],
      ignoreDependencies: ['flat', 'unstorage', 'h3', 'vue', 'nuxt'],
    },
  },
}

export default config
