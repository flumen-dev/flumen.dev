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
        'app/middleware/**/*.ts!',
        'server/**/*.ts!',
        'shared/**/*.ts!',
      ],
      project: ['**/*.{ts,vue,cjs,mjs}', '!test/fixtures/**'],
      ignoreDependencies: ['flat', 'unstorage'],
    },
  },
}

export default config
