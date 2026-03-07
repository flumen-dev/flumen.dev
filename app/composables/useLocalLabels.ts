export function useLocalLabels(getLabels: () => Array<{ name: string, color: string }>) {
  const localLabels = ref([...getLabels()])
  watch(getLabels, v => localLabels.value = [...v])

  function onLabelAdded(label: { name: string, color: string }) {
    if (!localLabels.value.some(l => l.name === label.name)) {
      localLabels.value = [...localLabels.value, label]
    }
  }

  function onLabelRemoved(name: string) {
    localLabels.value = localLabels.value.filter(l => l.name !== name)
  }

  return { localLabels, onLabelAdded, onLabelRemoved }
}
