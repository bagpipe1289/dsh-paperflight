import type { GitStatus, MaimaiVersion, PluginInfo, PluginLoadProgress, PluginStatsData } from './types'
import { getPluginType } from './types'
import { PluginCard } from './PluginCard'

interface InstalledTabProps {
  plugins: PluginInfo[]
  searchQuery: string
  pluginTypeFilter: string
  showCompatibleOnly: boolean
  gitStatus: GitStatus | null
  maimaiVersion: MaimaiVersion | null
  pluginStats: Record<string, PluginStatsData>
  loadProgress: PluginLoadProgress | null
  likingPluginIds: Set<string>
  onInstall: (plugin: PluginInfo) => void
  onLike: (plugin: PluginInfo) => void
  onUpdate: (plugin: PluginInfo) => void
  onUninstall: (plugin: PluginInfo) => void
  onDetail: (plugin: PluginInfo) => void
  checkPluginCompatibility: (plugin: PluginInfo) => boolean
  needsUpdate: (plugin: PluginInfo) => boolean
  getStatusBadge: (plugin: PluginInfo) => React.JSX.Element | null
  getIncompatibleReason: (plugin: PluginInfo) => string | null
}

export function InstalledTab({
  plugins,
  searchQuery,
  pluginTypeFilter,
  showCompatibleOnly,
  gitStatus,
  maimaiVersion,
  pluginStats,
  loadProgress,
  likingPluginIds,
  onInstall,
  onLike,
  onUpdate,
  onUninstall,
  onDetail,
  checkPluginCompatibility,
  needsUpdate,
  getStatusBadge,
  getIncompatibleReason,
}: InstalledTabProps) {
  // 过滤已安装插件
  const filteredPlugins = plugins.filter(plugin => {
    // 跳过没有 manifest 的插件
    if (!plugin.manifest) {
      return false
    }
    
    // 只显示已安装
    if (!plugin.installed) {
      return false
    }
    
    // 搜索过滤
    const matchesSearch = searchQuery === '' ||
      plugin.manifest.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.manifest.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plugin.manifest.keywords && plugin.manifest.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())))
    
    // 类型过滤
    const matchesType = pluginTypeFilter === 'all' || getPluginType(plugin) === pluginTypeFilter
    
    // 兼容性过滤
    const matchesCompatibility = !showCompatibleOnly || 
      !maimaiVersion || 
      checkPluginCompatibility(plugin)
    
    return matchesSearch && matchesType && matchesCompatibility
  })

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {filteredPlugins.map((plugin) => (
        <PluginCard
          key={plugin.id}
          plugin={plugin}
          gitStatus={gitStatus}
          maimaiVersion={maimaiVersion}
          pluginStats={pluginStats}
          loadProgress={loadProgress}
          likingPluginIds={likingPluginIds}
          onInstall={onInstall}
          onLike={onLike}
          onUpdate={onUpdate}
          onUninstall={onUninstall}
          onDetail={onDetail}
          checkPluginCompatibility={checkPluginCompatibility}
          needsUpdate={needsUpdate}
          getStatusBadge={getStatusBadge}
          getIncompatibleReason={getIncompatibleReason}
        />
      ))}
    </div>
  )
}
