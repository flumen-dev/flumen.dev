import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createI18NReport } from 'vue-i18n-extract'

export const LOCALES_DIRECTORY = fileURLToPath(new URL('../../i18n/locales', import.meta.url))
const VUE_FILES_GLOB = './app/**/*.?(vue|ts|js)'

export const createI18nReport = async () => {
  const { missingKeys, unusedKeys, maybeDynamicKeys } = await createI18NReport({
    vueFiles: VUE_FILES_GLOB,
    languageFiles: join(LOCALES_DIRECTORY, '*.json'),
    exclude: ['$schema'],
  })

  const dynamicKeysWithoutTranslation = new Array(...maybeDynamicKeys)

  const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const actualUnusedKeys = unusedKeys
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
