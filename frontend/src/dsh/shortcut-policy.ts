export const commands=[
 {id:'chat',name:'打开会话',alias:'open chat',key:'Alt+KeyC',path:'/chat'},
 {id:'new',name:'新建会话（会话页）',alias:'new session',key:'Alt+KeyN'},
 {id:'focus',name:'聚焦消息输入框',alias:'focus composer',key:'Alt+KeyI'},
 {id:'settings',name:'打开设置',alias:'settings',key:'Alt+KeyS',path:'/settings'},
 {id:'tasks',name:'定时任务',alias:'scheduled tasks',key:'Alt+KeyT',path:'/adapter-management'},
 {id:'previous',name:'上一个会话',alias:'previous session',key:'Alt+ArrowUp'},
 {id:'next',name:'下一个会话',alias:'next session',key:'Alt+ArrowDown'},
 {id:'left',name:'展开或收起会话侧栏',alias:'toggle left sidebar',key:'Alt+KeyL'},
 {id:'right',name:'隐藏或显示右侧栏',alias:'toggle right sidebar',key:'Alt+KeyR'},
 {id:'files',name:'打开文件',alias:'open files',key:'Alt+KeyF'},
 {id:'browser',name:'打开浏览器',alias:'open browser',key:'Alt+KeyB'},
 {id:'changes',name:'打开审查',alias:'open review',key:'Alt+KeyD'},
 {id:'current',name:'当前会话设置',alias:'session settings',key:'Alt+KeyM'},
 {id:'commands',name:'会话指令与工具',alias:'commands tools',key:'Alt+KeyO'},
 {id:'help',name:'快捷键速查',alias:'keyboard shortcuts',key:'Alt+Slash',path:'/settings?tab=shortcuts'},
 ...[
 ['archived','已归档对话','archived sessions'],['permission','权限策略','permissions'],['stats','会话统计','session statistics'],
 ['queue','排队消息','queued messages'],['goals','目标管理','goals'],['jobs','后台任务','background jobs'],
 ['add','添加内容','attach content'],['rename','重命名会话','rename session'],['pin','切换会话置顶','pin session'],
 ['fork','分叉会话','fork session'],['archive','归档会话','archive session'],['stop','停止当前回复','stop response'],
 ['trace','当前会话执行轨迹','session trace']
 ].map(([id,name,alias])=>({id,name,alias,key:''}))
];
export const fixedInputs=[['发送消息','Enter'],['输入换行','Shift+Enter'],['打开指令建议','/'],['引用文件或会话','@']];
export type Bindings=Record<string,string|null>;
export function readBindings(raw:string|null):Bindings{if(!raw)return {};const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data)||Object.values(data).some(x=>x!==null&&typeof x!=='string'))throw new Error('快捷键配置损坏，请先备份并修复浏览器存储');return data}
export function keyBinding(e:{ctrlKey:boolean;altKey:boolean;shiftKey:boolean;metaKey:boolean;code:string}){return [e.ctrlKey?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.metaKey?'Meta':'',e.code].filter(Boolean).join('+')}
export function bindingIssue(key:string){if(!/^(Alt|Ctrl|Meta)\+/.test(key))return '请至少使用 Alt、Ctrl 或 Command 修饰键';if(/^(Ctrl|Meta)\+(Key[ACFLNPRSTVWXYZ]|Digit\d|Tab|Enter)$/.test(key)||['Alt+F4','Alt+Tab','Ctrl+Alt+Delete'].includes(key))return '此组合由浏览器或系统保留';return ''}
export const effective=(c:{id:string;key:string},saved:Bindings)=>c.id in saved?saved[c.id]||'':c.key;
export function matchedCommand(key:string,saved:Bindings){const matches=commands.filter(c=>effective(c,saved)===key);return matches.length===1?matches[0]:undefined}
export function searchMatch(query:string,...values:string[]){const q=query.toLowerCase().replace(/\s/g,'');return values.some(v=>{let i=0;for(const c of v.toLowerCase().replace(/\s/g,''))if(c===q[i])i++;return i===q.length})}
