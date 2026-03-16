export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const { url } = await $fetch<{ url: string }>('/api/upload/image', {
    method: 'POST',
    body: form,
  })
  return url
}
