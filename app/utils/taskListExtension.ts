/** Custom event detail for task checkbox toggle. */
export interface TaskToggleDetail {
  taskIndex: number
  checked: boolean
}

/**
 * Toggle the n-th task checkbox in raw markdown.
 * Returns the updated markdown string.
 */
export function toggleTaskInMarkdown(md: string, taskIndex: number): string {
  let current = 0
  return md.replace(
    /^(\s*[-*]\s+)\[([ xX]?)\]/gm,
    (match, prefix: string, check: string) => {
      if (current++ !== taskIndex) return match
      const toggled = check.trim().toLowerCase() === 'x' ? ' ' : 'x'
      return `${prefix}[${toggled}]`
    },
  )
}

/**
 * Post-render DOM enhancement: make task checkboxes interactive.
 * Removes `disabled`, adds change listeners that call the callback.
 */
export function enableInteractiveCheckboxes(
  dom: HTMLElement,
  callback: (detail: TaskToggleDetail) => void,
) {
  const checkboxes = dom.querySelectorAll<HTMLInputElement>('.task-checkbox')
  checkboxes.forEach((checkbox, index) => {
    checkbox.disabled = false
    checkbox.addEventListener('change', () => {
      callback({ taskIndex: index, checked: checkbox.checked })
    })
  })
}
