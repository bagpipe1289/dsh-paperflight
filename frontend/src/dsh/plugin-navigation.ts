export interface InstalledPanel {page:string;installed:boolean}
const pluginRoutes = new Set(['/resource/emoji','/resource/jargon','/resource/knowledge-base'])
export function pluginEntryVisible(path:string, panels:InstalledPanel[]|null):boolean {
  return !pluginRoutes.has(path) || panels?.some(panel=>panel.page===path && panel.installed)===true
}
