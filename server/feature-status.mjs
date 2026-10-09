import {pluginInventory} from './plugin-adapters.mjs';
// Host registration state, not a claim about the tools exposed by every preset.
function state(entries) {
  if (!entries.length) return {enabled:false,state:'absent',text:'未加载'};
  if (entries.some(p=>p.enabled===true&&p.fiberPhase==='active')) return {enabled:true,state:'active',text:'已启用'};
  if (entries.every(p=>p.enabled===false)) return {enabled:false,state:'disabled',text:'未启用'};
  return {enabled:null,state:'unavailable',text:'未就绪'};
}
export function projectFeatureStatus(plugins) {
  if(!Array.isArray(plugins)) throw new Error('插件状态格式无效');
  const core=state(plugins.filter(p=>p.moduleName==='@deepseek-ai/dsh-subagent'));
  const providers=state(plugins.filter(p=>/^@deepseek-ai\/dsh-subagent-(spawn-in-process|fork-in-process|codex)$/.test(p.moduleName)));
  const subagent=core.enabled===true?providers:core;
  const memory=state(plugins.filter(p=>pluginInventory([p],[]).some(a=>a.kind==='memory'&&a.installed)));
  return {subagent:{...subagent,detail:'当前 DSH 环境的子代理基础组件与已知执行提供商状态；具体会话能否调用仍由预设决定。'},memory:{...memory,detail:'当前 DSH 环境中 Engram、OpenViking、Hindsight 的插件加载状态；不代表检索或模型调用已通过验收。'},scope:'preview-host',checkedAt:Date.now()};
}
