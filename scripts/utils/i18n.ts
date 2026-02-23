import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createI18NReport } from 'vue-i18n-extract'

export const LOCALES_DIRECTORY = fileURLToPath(new URL('../../i18n/locales', import.meta.url))
const VUE_FILES_GLOB = './app/**/*.?(vue|ts|js)'
const APP_PAGES_DIRECTORY = fileURLToPath(new URL('../../app/pages', import.meta.url))

async function getFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return getFilesRecursively(fullPath)
    }
    return [fullPath]
  }))
  return nested.flat()
}

async function collectPageMetaTitleKeys(): Promise<Set<string>> {
  const files = await getFilesRecursively(APP_PAGES_DIRECTORY)
  const vueFiles = files.filter(file => file.endsWith('.vue'))
  const keys = new Set<string>()

  for (const file of vueFiles) {
    const content = await readFile(file, 'utf-8')
    const matches = content.matchAll(/titleKey\s*:\s*['"]([^'"]+)['"]/g)
    for (const match of matches) {
      const key = match[1]
      if (key) {
        keys.add(key)
      }
    }
  }

  return keys
}

export const createI18nReport = async () => {
  const { missingKeys, unusedKeys, maybeDynamicKeys } = await createI18NReport({
    vueFiles: VUE_FILES_GLOB,
    languageFiles: join(LOCALES_DIRECTORY, '*.json'),
    exclude: ['$schema'],
  })
  const pageMetaTitleKeys = await collectPageMetaTitleKeys()

  const uniqueDynamicKeys = maybeDynamicKeys.filter((key, i, arr) => arr.findIndex(k => k.path === key.path) === i)
  const dynamicKeysWithoutTranslation = new Array(...uniqueDynamicKeys)

  const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const actualUnusedKeys = unusedKeys
    .filter(key => !pageMetaTitleKeys.has(key.path))
    .filter(key => !maybeDynamicKeys.some((dynamicKey) => {
      const parts = dynamicKey.path.split(/\$\{[^}]+\}/g)
      const pattern = `^${parts.map(escapeRegex).join('.*')}$`
      const matcher = new RegExp(pattern)
      if (matcher.test(key.path)) {
        if (dynamicKeysWithoutTranslation.includes(dynamicKey)) {
          const index = dynamicKeysWithoutTranslation.indexOf(dynamicKey)
          dynamicKeysWithoutTranslation.splice(index, 1)
        }
        return true
      }
      else {
        return false
      }
    }))

  const unusedFalsePositives = unusedKeys.filter(k => !actualUnusedKeys.includes(k))
  const dynamicKeyFalsePositives = maybeDynamicKeys.filter(k => !dynamicKeysWithoutTranslation.includes(k))
  return { missingKeys, actualUnusedKeys, unusedFalsePositives, dynamicKeysWithoutTranslation, dynamicKeyFalsePositives }
}
