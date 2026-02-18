export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      secondary: 'sky',
      success: 'emerald',
      info: 'cyan',
      warning: 'amber',
      error: 'rose',
      neutral: 'zinc',
    },
    editor: {
      slots: {
        base: [
          // Commit SHA styling
          '[&_.commit-sha]:font-mono [&_.commit-sha]:text-xs [&_.commit-sha]:text-primary [&_.commit-sha]:bg-primary/5 [&_.commit-sha]:rounded-sm [&_.commit-sha]:px-1 [&_.commit-sha]:py-0.5',
          '[&_.commit-sha-decoration]:font-mono [&_.commit-sha-decoration]:text-xs [&_.commit-sha-decoration]:text-muted',
        ],
      },
    },
  },
})
