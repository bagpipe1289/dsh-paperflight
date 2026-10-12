import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Display the distributed plugin version, not an independently versioned UI package.
const packageJson = require('../plugin/package.json') as { version?: unknown }

if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
  throw new Error('plugin/package.json 缺少有效的 version 字段')
}

export const DASHBOARD_APP_VERSION = packageJson.version.trim()
export const dashboardVersionDefine = {
  __APP_VERSION__: JSON.stringify(DASHBOARD_APP_VERSION),
}
