import type { I18NItem } from 'vue-i18n-extract'
import { colors } from './utils/colors.ts'
import { createI18nReport } from './utils/i18n.ts'

function printSection(
  title: string,
  items: I18NItem[],
  status: 'error' | 'warning' | 'success',
): void {
  const icon = status === 'error' ? '❌' : status === 'warning' ? '⚠️' : '✅'
  const colorFn
    = status === 'error' ? colors.red : status === 'warning' ? colors.yellow : colors.green

  console.log(`\n${icon} ${colors.bold(title)}: ${colorFn(String(items.length))}`)

  if (items.length === 0) return

  const groupedByFile = items.reduce<Record<string, string[]>>((acc, item) => {
    const file = item.file ?? 'unknown'
    acc[file] ??= []
    acc[file].push(item.path)
    return acc
  }, {})

  for (const [file, keys] of Object.entries(groupedByFile)) {
    console.log(`  ${colors.dim(file)}`)
    for (const key of keys) {
      console.log(`    ${colors.cyan(key)}`)
    }
  }
}

async function run(): Promise<void> {
  console.log(colors.bold('\n🔍 Analyzing i18n translations...\n'))

  const { missingKeys, actualUnusedKeys, unusedFalsePositives, dynamicKeysWithoutTranslation, dynamicKeyFalsePositives } = await createI18nReport()

  const hasMissingKeys = missingKeys.length > 0
  const hasUnusedKeys = actualUnusedKeys.length > 0
  const hasUnusedFalsePositives = unusedFalsePositives.length > 0
  const hasDynamicKeys = dynamicKeysWithoutTranslation.length > 0
  const hasDynamicKeyFalsePositives = dynamicKeyFalsePositives.length > 0

  printSection(' Missing keys', missingKeys, hasMissingKeys ? 'error' : 'success')

  printSection(' Unused keys', actualUnusedKeys, hasUnusedKeys ? 'error' : 'success')

  printSection(' Unused keys with matching dynamic keys', unusedFalsePositives, hasUnusedFalsePositives ? 'warning' : 'success')

  printSection(
    ' Dynamic keys without translation',
    dynamicKeysWithoutTranslation,
    hasDynamicKeys ? 'error' : 'success',
  )

  printSection(
    ' Dynamic keys with translation',
    dynamicKeyFalsePositives,
    hasDynamicKeyFalsePositives ? 'warning' : 'success',
  )

  // Summary
  console.log('\n' + colors.dim('─'.repeat(50)))

  const shouldFail = hasMissingKeys || hasDynamicKeys || hasUnusedKeys

  if (shouldFail) {
    console.log(colors.red('\n❌ Build failed: missing, unused or dynamic keys detected'))
    console.log(colors.dim('   Fix missing keys by adding them to the locale file'))
    console.log(colors.dim('   Fix dynamic keys by adding translations to the locale files\n'))
    console.log(
      colors.dim(
        '   Fix unused keys by removing them from the locale file (pnpm run i18n:report:fix)\n',
      ),
    )
    process.exit(1)
  }
  else {
    console.log(colors.green('\n✅ All translations are valid!\n'))
  }
}

run().catch((error: unknown) => {
  console.error(colors.red('\n❌ Unexpected error:'), error)
  process.exit(1)
})
