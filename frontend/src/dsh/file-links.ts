// Local links are encoded as inert fragments, never exposed as executable URL schemes.
export const fileLinkPrefix = '#dsh-file='
export function localFileTarget(value: string): string | null {
  if (!value || /[\x00-\x1f]/.test(value)) return null
  if (/^[a-z]:(?:[\\/]|%5c|%2f)/i.test(value)) return value
  if (/^file:\/\//i.test(value)) {
    try { const u = new URL(value); if (u.hostname && u.hostname !== 'localhost') return null; return decodeURIComponent(u.pathname).replace(/^\/([a-z]:\/)/i, '$1') } catch { return null }
  }
  if (/^(?:[a-z][\w+.-]*:|\/\/|#|\?)/i.test(value)) return null
  // Relative document links, including extensionless paths inside a directory.
  return /[/\\]|\.[a-z0-9]{1,12}(?:[?#]|$)/i.test(value) ? value : null
}
export function workspaceFilePath(target: string, cwd: string): string {
  let value = target
  try { value = decodeURIComponent(value) } catch { throw new Error('文件链接编码无效') }
  value = value.replaceAll('\\', '/').replace(/[?#].*$/, '')
  const root = cwd.replaceAll('\\', '/').replace(/\/+$/, '')
  if (!root || /[\x00-\x1f]/.test(value)) throw new Error('无法确定当前会话的文件工作区')
  if (/^(?:[a-z]:\/|\/)/i.test(value)) {
    const windows = /^[a-z]:\//i.test(root)
    const compare = (s: string) => windows ? s.toLowerCase() : s
    if (!compare(value).startsWith(compare(root) + '/')) throw new Error('该文件不在当前会话工作区中，无法在侧栏打开')
    value = value.slice(root.length + 1)
  }
  const parts = value.split('/').filter(p => p && p !== '.')
  if (!parts.length || parts.includes('..') || /[:\x00]/.test(value)) throw new Error('文件路径无效或超出当前工作区')
  return parts.join('/')
}
