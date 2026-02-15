import YAML from 'yaml'

interface GitHubContentItem {
  name: string
  path: string
  type: 'file' | 'dir'
  download_url: string | null
}

interface FormField {
  type: 'markdown' | 'input' | 'textarea' | 'dropdown' | 'checkboxes'
  id?: string
  attributes: Record<string, unknown>
  validations?: { required?: boolean }
}

export interface IssueFormTemplate {
  type: 'form'
  filename: string
  name: string
  description: string
  title: string
  labels: string[]
  body: FormField[]
}

export interface IssueMarkdownTemplate {
  type: 'markdown'
  filename: string
  name: string
  about: string
  title: string
  body: string
}

export type IssueTemplate = IssueFormTemplate | IssueMarkdownTemplate

const REPO_ID_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) { id }
}
`

function parseMarkdownTemplate(filename: string, raw: string): IssueMarkdownTemplate | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return null

  const frontmatter = YAML.parse(match[1]!) as Record<string, unknown>
  return {
    type: 'markdown',
    filename,
    name: String(frontmatter.name ?? filename),
    about: String(frontmatter.about ?? ''),
    title: String(frontmatter.title ?? ''),
    body: match[2]!.trim(),
  }
}

function parseYamlTemplate(filename: string, raw: string): IssueFormTemplate | null {
  const parsed = YAML.parse(raw) as Record<string, unknown>
  if (!parsed || !Array.isArray(parsed.body)) return null

  return {
    type: 'form',
    filename,
    name: String(parsed.name ?? filename),
    description: String(parsed.description ?? ''),
    title: String(parsed.title ?? ''),
    labels: Array.isArray(parsed.labels) ? parsed.labels.map(String) : [],
    body: parsed.body as FormField[],
  }
}

export default defineEventHandler(async (event) => {
  const { token } = await getSessionToken(event)
  const repo = getQuery(event).repo as string | undefined

  if (!repo) {
    throw createError({ statusCode: 400, message: 'Missing repo query parameter' })
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    throw createError({ statusCode: 400, message: 'Invalid repo format, expected owner/repo' })
  }

  // Fetch repositoryId (needed for createIssue mutation)
  const { repository } = await githubGraphQL<{ repository: { id: string } }>(
    token,
    REPO_ID_QUERY,
    { owner, repo: repoName },
  )

  // List template files
  let files: GitHubContentItem[] = []
  try {
    const { data } = await githubFetchWithToken<GitHubContentItem[]>(
      token,
      `/repos/${owner}/${repoName}/contents/.github/ISSUE_TEMPLATE`,
    )
    files = data
  }
  catch (err: unknown) {
    // No ISSUE_TEMPLATE directory — repo has no templates
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
      return { repositoryId: repository.id, templates: [] }
    }
    throw err
  }

  // Parse each template file
  const templateFiles = files.filter(
    f => f.type === 'file' && (f.name.endsWith('.yml') || f.name.endsWith('.yaml') || f.name.endsWith('.md')),
  )

  const templates: IssueTemplate[] = []

  await Promise.all(templateFiles.map(async (file) => {
    if (!file.download_url) return
    try {
      const response = await fetch(file.download_url, {
        headers: { Authorization: `token ${token}` },
      })
      if (!response.ok) return
      const raw = await response.text()

      if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
        const template = parseYamlTemplate(file.name, raw)
        if (template) templates.push(template)
      }
      else if (file.name.endsWith('.md')) {
        const template = parseMarkdownTemplate(file.name, raw)
        if (template) templates.push(template)
      }
    }
    catch {
      // Skip unparseable templates
    }
  }))

  return { repositoryId: repository.id, templates }
})
