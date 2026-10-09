export const pluginAdapters=[
 {id:'engram',title:'Engram',kind:'memory',packages:['@kenz1117/dsh-engram'],page:'/resource/knowledge-base',docs:'https://github.com/kenz1117/dsh-engram',description:'本地记忆宫殿：记忆、走廊、审阅与维护。'},
 {id:'openviking',hasPanel:false,title:'OpenViking',kind:'memory',packages:['@openviking/dsh-memory-plugin'],page:'/resource/knowledge-base?provider=openviking',docs:'https://github.com/volcengine/OpenViking/tree/main/examples/dsh-memory-plugin',description:'依赖 OpenViking 服务；连接由 ovcli.conf 和插件配置提供。当前发布包的 DSH 兼容声明仍为 0.1 系列，0.2 主机须另行验证。'},
 {id:'hindsight',hasPanel:false,title:'Hindsight',kind:'memory',packages:['@vectorize-io/hindsight-coding-agents'],page:'/resource/knowledge-base?provider=hindsight',docs:'https://github.com/vectorize-io/hindsight/tree/main/hindsight-integrations/coding-agents',description:'按项目管理记忆银行。需选用云端、自建服务或本地 daemon；插件安装不等于服务就绪。'},
 {id:'skills',title:'技能中心',kind:'resource',packages:['@linxin666/dsh-client-ui-skill-explorer'],page:'/resource/emoji',docs:'https://github.com/zhu1090093659/dsh-web/tree/main/packages/dsh-skill-explorer',description:'按来源查看技能、启停模型调用、编辑技能正文。'},
 {id:'tasks',title:'任务看板',kind:'resource',packages:['@linxin666/dsh-client-ui-task-board'],page:'/resource/jargon',docs:'https://github.com/zhu1090093659/dsh-web/tree/main/packages/dsh-task-board',description:'查看任务状态、创建待办、归档与恢复。执行和权限升级保留在插件原生界面。'},
]
export function adapterStatus(adapter,plugins,bundles){const p=plugins.filter(p=>adapter.packages.some(name=>p.moduleName===name||p.moduleName?.startsWith(name+'/'))),b=bundles.find(b=>adapter.packages.includes(b.name)&&b.installed);const installed=!!b||p.length>0,enabled=p.some(p=>p.enabled===true&&p.fiberPhase==='active');return{...adapter,installed,enabled,state:!installed?'absent':enabled?'active':p.some(p=>p.enabled)?'unavailable':'disabled',version:b?.version||null}}
export function pluginInventory(plugins,bundles){return pluginAdapters.map(a=>adapterStatus(a,plugins,bundles))}
export function adapterRoute(id,method,route){const prefixes={skills:'/api/dsh-skill-explorer/',tasks:'/api/task-board/'};const routes={skills:{GET:['list','read','health'],POST:['set-enabled','update','create','delete']},tasks:{GET:['state'],POST:['action']}};return routes[id]?.[method]?.includes(route)?prefixes[id]+route:null}
export function validateBoardAction(body){
 const a=body?.action;
 if(!a||!['create','archive','restore','move','delete'].includes(a.kind))throw new Error('此操作请使用任务看板原生界面');
 const fields={create:['kind','id','input'],archive:['kind','taskId'],restore:['kind','taskId'],move:['kind','taskId','status'],delete:['kind','taskId']};
 if(Object.keys(a).some(k=>!fields[a.kind].includes(k)))throw new Error('任务操作包含不支持的字段');
 if(a.kind==='create'){const i=a.input;if(!i||typeof i.title!=='string'||!i.title.trim()||typeof i.prompt!=='string'||!i.prompt.trim()||Object.keys(i).some(k=>!['title','description','prompt'].includes(k)))throw new Error('仅支持创建待办草稿');}
 else if(typeof a.taskId!=='string'||!a.taskId.trim())throw new Error('任务标识无效');
 if(a.kind==='move'&&!['backlog','todo'].includes(a.status))throw new Error('仅支持整理待办任务');
 return body;
}
export const feedbackCategoryIds=['task-result','instruction-following','product-interaction','service-stability','resource-cost','security-privacy-permission','other'];
export function sessionFeedbackRequest(b){if(typeof b.sessionId!=='string'||!/^[-\w]{1,120}$/.test(b.sessionId)||b.text!==undefined&&(typeof b.text!=='string'||b.text.length>32000)||b.category!==undefined&&!feedbackCategoryIds.includes(b.category))throw new Error('反馈参数无效');return{sessionId:b.sessionId,...(b.text?.trim()?{text:b.text.trim()}:{}),...(b.category?{category:b.category}:{})}}

export function pluginPagesInventory(plugins,bundles){const items=pluginInventory(plugins,bundles).filter(a=>a.hasPanel!==false);return{items,other:bundles.filter(bundle=>bundle.installed&&!items.some(a=>a.packages.includes(bundle.name))).map(bundle=>({name:bundle.name,version:bundle.version,enabled:bundle.enabled}))}}
export function scheduleAvailable(plugins){return plugins.some(p=>p.moduleName==='@deepseek-ai/dsh-schedule'&&p.enabled===true&&p.fiberPhase==='active')}
