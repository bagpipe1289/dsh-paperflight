import {fileLinkPrefix,workspaceFilePath} from './file-links'
import {ApprovalPrompt} from './ApprovalPrompt'
import {sessionVisible} from './session-visibility'
import {storedNavigationOrder} from './session-order'
import {mergeMessages} from './history-model'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {L,useDshLocale} from './locale'
import {DisplayContext,useDisplayPreferences} from './DisplayPreferences'
import {VoiceInput} from './VoiceInput'
import {GoalPanel,ReminderBadge} from './AutomationPage'
import {CordisPanel} from './NativeSettings'
import {WorkflowCard} from './ToolCards'
import {usePendingInteractions,DirectoryPicker,ReferencePicker,QueuePanel,JobPanel} from './ConversationPanels'
import {RightWorkspace} from './RightWorkspace'
import {ComposerTools} from './ComposerTools'
import {SessionGroups} from './SessionGroups'
import {ConversationItem} from '@/routes/chat/ChatWorkspaceSidebar'
import {ListTodo,Workflow,Target,Blocks} from 'lucide-react'
import {confirmAction} from './confirm'
import {ArchivedSessions} from './ArchivedSessions'
import {SubagentList} from './SubagentList'
import {useModelIdentity} from './modelIdentity'
import {SessionStatsPanel,PermissionPanel,CommandsPanel} from './ChatNativePanels'
import {SessionActions} from './SessionActions'
import {motion} from 'motion/react'
import {useCallback,useEffect,useRef,useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Plus,RefreshCw,Square,ExternalLink,Settings2,MessagesSquare,SlidersHorizontal,Paperclip,Terminal,ShieldCheck,ChartNoAxesCombined,MessageSquare,ImagePlus,Archive} from 'lucide-react'
import {Link} from '@tanstack/react-router'
import {useLoad} from './Management'
import {Button} from '@/components/ui/button'
import {dsh} from './api'
import {ChatComposer} from '@/routes/chat/ChatComposer'
import {ChatSidebar} from './ChatSidebar'
import {ChatWorkspaceSidebar} from '@/routes/chat/ChatWorkspaceSidebar'
import {MessageList} from '@/routes/chat/MessageList'
import type {ChatMessage,ChatTab,ChatImageAttachment} from '@/routes/chat/types'

interface SessionRow{sessionId:string;title:string;origin?:string;parentSessionId?:string;running:boolean;archived?:boolean;pinned?:boolean;blank?:boolean;cwd?:string;projections?:{values:Record<string,any>}}
interface SessionView{messages:ChatMessage[];running:boolean;connected:boolean;error:string|null;hasMore:boolean;title:string;storedTitle?:boolean;beforeSeq?:number;throughSeq?:number}
const empty:SessionView={messages:[],running:false,connected:false,error:null,hasMore:false,title:'新会话'}
const cache=new Map<string,SessionView>()
const noSessions=new Map()
const unavailable=async()=>{}
export function ChatPage(){useDshLocale();const modelIdentity=useModelIdentity();
 const{i18n}=useTranslation();const display=useDisplayPreferences()
 const inbox=usePendingInteractions();
 const[right,setRight]=useState(''),[preview,setPreview]=useState<any>(null),[composerMenu,setComposerMenu]=useState('')
 const[showSteps,setShowSteps]=useState(()=>localStorage.getItem('dsh-show-steps')!=='false'),[showReasoning,setShowReasoning]=useState(()=>localStorage.getItem('dsh-show-reasoning')!=='false')
 const openPlan=(p:any)=>{setPreview(p);setRight('preview')}
 const openChild=(c:any)=>{setPreview({parentSessionId:c.parentSessionId,childSessionId:c.id,mode:c.mode,label:c.label});setRight('child')}
 const[rows,setRows]=useState<SessionRow[]>([])
 const navigationOrder=useRef<string[]>([]),onNavigationOrder=useCallback((ids:string[])=>{navigationOrder.current=ids},[])
 const[rename,Rename]=useState<string|null>(null),[renameTitle,RT]=useState('')
 const[archived,setArchived]=useState<SessionRow[]>([])
 const[active,setActive]=useState(()=>localStorage.getItem('dsh-active-session')||'')
 const activeRow=rows.find(r=>r.sessionId===active),isChild=activeRow?.origin==='subagent'
 const childNotice='这是由父会话管理的子代理记录，不能直接上传附件或发送消息。请返回父会话添加文件。'
 const[view,setView]=useState<SessionView>(empty)
 const[drafts,setDrafts]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem('dsh-drafts')||'{}')}catch{return{}}})
 const[loading,setLoading]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('')
 const catalog=useLoad<any>('models'),presets=useLoad<any>('presets')
 const[revealKey,setRevealKey]=useState(0)
 const revealSection=(id:string)=>{setSection(id);setRevealKey(x=>x+1)}
 const[section,setSection]=useState('sessions'),[command,setCommand]=useState('/goal');
 const[sendMode,setSendMode]=useState('queue'),[workspaceId,setWorkspaceId]=useState('');
 const workspaces=useLoad<any>('v5/workspaces');
 useEffect(()=>setSendMode(display.busyEnter),[display.busyEnter]);
 const[preset,setPreset]=useState(()=>localStorage.getItem('dsh-next-preset')||''),[selection,setSelection]=useState<any>(null)
 useEffect(()=>{if(presets.data&&!preset)setPreset(presets.data.presets.find((p:any)=>p.isDefault&&!p.broken)?.id||'standard')},[presets.data,preset])
 const[images,setImages]=useState<Record<string,ChatImageAttachment[]>>({})
 const[files,setFiles]=useState<Record<string,any[]>>({});const fileInput=useRef<HTMLInputElement>(null),imageInput=useRef<HTMLInputElement>(null)
 const[older,setOlder]=useState<ChatMessage[]>([]),[historyCursor,setHistoryCursor]=useState<number|null>(null),[more,setMore]=useState<boolean|null>(null)
 const[avatarVersion,setAvatarVersion]=useState(()=>Number(localStorage.getItem('dsh-avatar-version')||0))
 const updateAvatar=async(file:File)=>{try{if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>512*1024)throw new Error('头像须为 PNG/JPEG/WebP/GIF，最大 512 KB');const value=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)});localStorage.setItem('dsh-avatar',value);const v=Date.now();localStorage.setItem('dsh-avatar-version',String(v));setAvatarVersion(v);window.dispatchEvent(new Event('dsh-avatar-change'))}catch(e){setError((e as Error).message)}}
 const[userName,setUserName]=useState(()=>localStorage.getItem('dsh-user-name')||'我')
 const[reconnect,setReconnect]=useState(0)
 useEffect(()=>{const receive=(event:Event)=>{const value=(event as CustomEvent).detail;if(value?.sessionId!==active||typeof value.text!=='string')return;setDrafts(old=>({...old,[active]:[old[active],value.text.slice(0,20000)].filter(Boolean).join('\n\n')}))};window.addEventListener('dsh-tool-context',receive);return()=>window.removeEventListener('dsh-tool-context',receive)},[active]);
 const activeRef=useRef(active);activeRef.current=active
 const refresh=useCallback(async()=>{try{const result=await dsh<{items:SessionRow[]}>('sessions');const items=result.items.filter(r=>!r.archived);setArchived(result.items.filter(r=>r.archived));setRows(items);setActive(current=>items.some(r=>r.sessionId===current)?current:items.find(r=>sessionVisible(r,''))?.sessionId||'')}catch(e){setError((e as Error).message)}},[])
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer)},[refresh])
 useEffect(()=>{setSelection(rows.find(r=>r.sessionId===active)?.projections?.values.modelSelection?.next||catalog.data?.default)},[rows,active,catalog.data])
 useEffect(()=>{setOlder([]);setHistoryCursor(null);setMore(null);setComposerMenu('');setRight('');setPreview(null)},[active])
 useEffect(()=>{localStorage.setItem('dsh-drafts',JSON.stringify(drafts))},[drafts])
 useEffect(()=>{
  setError('');if(!active){setView(empty);return}
  localStorage.setItem('dsh-active-session',active);setView(cache.get(active)||empty);setLoading(true)
  const events=new EventSource('/api/dsh/follow?sessionId='+encodeURIComponent(active))
  events.onmessage=e=>{const state=JSON.parse(e.data) as SessionView;cache.set(active,state);setView(state);if(state.connected)setLoading(false);setRows(old=>old.map(r=>r.sessionId===active?{...r,running:state.running,...(state.running||state.messages.some(m=>m.type==='user'||m.type==='bot')?{blank:false}:{}),...(state.storedTitle?{title:state.title}:{})}:r))}
  events.onerror=()=>{setLoading(false);setView(v=>({...v,connected:false}));setError('会话连接中断，正在重连；也可以点击刷新连接。')}
  events.onopen=()=>setError('')
  return()=>events.close()
 },[active,reconnect])
 const create=async()=>{setPending(true);setError('');try{const r=await dsh<{sessionId:string}>('sessions',{agentPreset:preset||undefined,...(workspaceId?{workspaceId}:{})});await refresh();setActive(r.sessionId)}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 useEffect(()=>{const shortcut=(e:Event)=>{const action=(e as CustomEvent).detail;if(action==='new'&&!pending)void create();if(action==='focus')document.querySelector<HTMLTextAreaElement>('textarea[placeholder]')?.focus();if(action==='previous'||action==='next'){const navigable=rows.filter(r=>sessionVisible(r,active,!!drafts[r.sessionId]?.trim()||!!images[r.sessionId]?.length||!!files[r.sessionId]?.length));const order=navigationOrder.current.length?navigationOrder.current:storedNavigationOrder(navigable.map(r=>({...r,id:r.sessionId})),localStorage.getItem('dsh-session-groups'));const ids=[...order.filter(id=>navigable.some(r=>r.sessionId===id)),...navigable.filter(r=>!order.includes(r.sessionId)).map(r=>r.sessionId)];const i=ids.indexOf(active),n=i+(action==='previous'?-1:1);if(ids[n])setActive(ids[n])};if(['files','browser','changes'].includes(action)&&(action!=='changes'||display.developerTools))setRight(action);if(action==='current')revealSection('current');if(action==='commands')revealSection('commands');if(['archived','permission','stats','queue','jobs','add'].includes(action))revealSection(action);if(action==='goals')revealSection('goal');if(action==='trace'&&active)location.assign('/reasoning-process?sessionId='+encodeURIComponent(active));if(action==='stop'&&view.running&&!pending)void stop();if(action==='rename'&&active&&!pending){Rename(active);RT(rows.find(r=>r.sessionId===active)?.title||'')};if(['pin','fork','archive'].includes(action)&&active&&!pending)void sessionShortcut(action)};const reconnect=()=>setReconnect(x=>x+1);window.addEventListener('dsh-shortcut',shortcut);window.addEventListener('dsh-reconnect',reconnect);return()=>{window.removeEventListener('dsh-shortcut',shortcut);window.removeEventListener('dsh-reconnect',reconnect)}},[pending,preset,workspaceId,rows,active,display.developerTools,presets.data,view.running]);
 const send=async()=>{const id=active,text=(drafts[id]||'').trim();if(isChild){setError(childNotice);return;}if((!text&&!images[id]?.length&&!files[id]?.length)||!id||pending||!view.connected)return;setPending(true);setError('');try{if(text.startsWith('/')){const commands=await dsh<any>('v5/catalogs?sessionId='+encodeURIComponent(id));const name=/^\/([a-z][a-z0-9-]*)(?:\s|$)/.exec(text)?.[1];if(commands.commands.some((c:any)=>c.name===name)){if(['permission','model','export'].includes(name||'')){setSection(name==='permission'?'permission':name==='model'?'current':'commands');setError('请在侧栏对应入口选择并确认操作。');return}if(!await confirmAction('在当前会话执行 '+text+'？'))return;const r=await dsh<any>('v10/command',{sessionId:id,line:text,confirm:true,attachments:[...(files[id]||[]).map(f=>({type:'file',receiptId:f.receiptId})),...(images[id]||[]).map(i=>({type:'image',mediaType:i.mime_type,data:i.base64,name:i.name}))]});if(r.result?.kind==='error')throw new Error(r.result.text);setDrafts(old=>({...old,[id]:''}));setComposerMenu('');setImages(old=>({...old,[id]:[]}));setFiles(old=>({...old,[id]:[]}));return}}await dsh('prompt',{sessionId:id,text,mode:sendMode,files:(files[id]||[]).map(f=>({receiptId:f.receiptId})),images:(images[id]||[]).map(i=>({mediaType:i.mime_type,data:i.base64,name:i.name})),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});setDrafts(old=>({...old,[id]:''}));setImages(old=>({...old,[id]:[]}));setFiles(old=>({...old,[id]:[]}));if(activeRef.current===id)setView(v=>({...v,running:true}))}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const selectModel=async(next:any)=>{setPending(true);setError('');try{const r=await dsh<any>('session-action',{sessionId:active,action:'model',...next});setSelection(r.selected);setRows(old=>old.map(row=>row.sessionId===active?{...row,projections:{values:{...row.projections?.values,modelSelection:{next:r.selected}}}}:row))}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const loadMore=async()=>{const id=active;setPending(true);try{const before=historyCursor??view.beforeSeq;const r=await dsh<any>('history?sessionId='+encodeURIComponent(id)+(before!==undefined&&before!==null?'&beforeSeq='+before:'')+(view.throughSeq!==undefined?'&throughSeq='+view.throughSeq:''));if(activeRef.current===id){setOlder(old=>[...r.messages,...old]);setHistoryCursor(r.beforeSeq);setMore(r.hasMore)}}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const close=async(id:string,event?:React.MouseEvent|React.KeyboardEvent)=>{event?.stopPropagation();event?.preventDefault();if(rows.find(r=>r.sessionId===id)?.running){setError('请先停止会话再归档');return}try{await dsh('session-action',{sessionId:id,action:'archive'});await refresh()}catch(e){setError((e as Error).message)}}
 const addImages=async(files:FileList)=>{const id=active;if(isChild){setError(childNotice);return}try{if((images[id]?.length||0)+files.length>4)throw new Error('每条消息最多 4 张图片');const additions=await Promise.all(Array.from(files).map(async file=>{if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>4*1024*1024)throw new Error('图片须为 PNG/JPEG/WebP/GIF，单张不超过 4 MB');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)});return{id:crypto.randomUUID(),name:file.name,mime_type:file.type,base64:data.split(',')[1],data_url:data}}));setImages(old=>({...old,[id]:[...(old[id]||[]),...additions]}))}catch(e){setError((e as Error).message)}}
 const uploadFiles=async(list:FileList)=>{const id=active;if(!id||pending)return;if(isChild){setError(childNotice);return}setError('');if((files[id]?.length||0)+list.length>4){setError('每条消息最多 4 个文件');return}setPending(true);try{for(const file of Array.from(list)){if(file.size>8*1024*1024)throw new Error('单个文件最大 8 MB');const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('文件读取失败'));r.readAsDataURL(file)});const result=await dsh<any>('v6/upload',{sessionId:id,name:file.name,data});setFiles(old=>({...old,[id]:[...(old[id]||[]),result]}))}}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const receiveFiles=(list:FileList)=>{if(isChild){setError(childNotice);return}const picture=new DataTransfer(),other=new DataTransfer();for(const f of Array.from(list))(['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)?picture:other).items.add(f);if(picture.files.length)void addImages(picture.files);if(other.files.length)void uploadFiles(other.files)}
 const insertReference=(text:string)=>{setDrafts(old=>({...old,[active]:(old[active]||'').replace(/(?:^|\s)[@/]$/,' ')+text}));setComposerMenu('')}
 const pickCommand=(line:string)=>{setCommand(line);setSection('commands')}
 const onSessionChanged=async(id?:string)=>{await refresh();if(id)setActive(id)}
 const selectedModel=catalog.data?.groups.find((g:any)=>g.id===selection?.provider)?.models.find((m:any)=>m.id===selection?.model)
 const allMessages=mergeMessages(older,view.messages).filter(m=>(showSteps||!m.workStep||m.type==='error')&&(m.type!=='bot'||m.content?.trim()||showReasoning&&m.reasoning?.trim())).map(m=>{if(m.type!=='bot')return m;const identity=modelIdentity(m.modelSource);return {...m,reasoning:showReasoning?m.reasoning:undefined,modelAvatarUrl:identity.avatar,sender:{...m.sender,name:identity.name}}})
 const messages=allMessages.filter(m=>!m.tool?.parentCallId||!allMessages.some(p=>p.tool?.callId===m.tool.parentCallId))
 const stop=async()=>{try{await dsh('cancel',{sessionId:active})}catch(e){setError((e as Error).message)}}
 const sessionShortcut=async(action:string)=>{const row=rows.find(r=>r.sessionId===active);if(!row||pending||(row.running&&['fork','archive'].includes(action))||(row.blank&&action==='fork'))return;if(action==='archive'&&!await confirmAction(L('归档当前会话？历史记录会保留。')))return;setPending(true);try{const r=await dsh<any>('session-action',{sessionId:row.sessionId,action:action==='pin'?(row.pinned?'unpin':'pin'):action});await refresh();if(action==='fork')setActive(r.sessionId)}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const saveRename=async()=>{if(!rename||!renameTitle.trim()||pending)return;setPending(true);try{await dsh('session-action',{sessionId:rename,action:'rename',title:renameTitle.trim()});Rename(null);await refresh()}catch(e){setError((e as Error).message)}finally{setPending(false)}}
 const visibleRows=rows.filter(r=>sessionVisible(r,active,!!drafts[r.sessionId]?.trim()||!!images[r.sessionId]?.length||!!files[r.sessionId]?.length))
 const tabs:ChatTab[]=visibleRows.map(r=>{const state=r.sessionId===active?view:cache.get(r.sessionId);return{pinned:r.pinned,showAvatar:modelIdentity().showAvatar,modelAvatarUrl:modelIdentity(r.projections?.values.modelSelection?.next||catalog.data?.default).avatar,id:r.sessionId,type:'webui',label:r.title,messages:state?.messages||[],isConnected:state?.connected||false,isTyping:r.running,sessionInfo:{bot_name:r.title,session_id:r.sessionId}}})
 const shared={tabs,activeTabId:active,activeObservedSessionId:null,observedSessions:noSessions,userId:'local-preview',userName,userAvatarVersion:avatarVersion,isUploadingUserAvatar:false,onSwitch:setActive,onSelectObserved:()=>{},onClose:close,onUpdateUserAvatar:updateAvatar}
 const shownError=error||view.error
 return <DisplayContext.Provider value={display}><div className="bg-background flex h-full min-h-0">
  <ChatSidebar revealKey={revealKey} active={section} onSelect={setSection} sections={[
   {id:'sessions',label:'会话与子代理',icon:MessagesSquare,content:<ChatWorkspaceSidebar {...shared} sessionContent={<SessionGroups rows={tabs} onNavigationOrder={onNavigationOrder} render={tab=><ConversationItem key={tab.id} tab={tab} active={tab.id===active} onSwitch={setActive} onClose={close} actions={<SessionActions row={rows.find(r=>r.sessionId===tab.id)!} onChanged={onSessionChanged}/>}/>}/>} subagentContent={<><ReminderBadge key={active} sessionId={active}/><SubagentList sessionId={active} onOpen={openChild}/>{view.messages.filter(m=>m.workflow).map(m=><WorkflowCard key={m.id} workflow={m.workflow}/>)}</>} className="dsh-chat-sidebar-content" observedStageStatuses={noSessions} renderActions={tab=>{const row=rows.find(r=>r.sessionId===tab.id);return row?<SessionActions row={row} onChanged={onSessionChanged}/>:null}} onUpdateUserName={name=>{setUserName(name);localStorage.setItem('dsh-user-name',name)}}/>},
   {id:'archived',label:'已归档对话',icon:Archive,content:<ArchivedSessions rows={archived} onRestored={async id=>{await onSessionChanged(id);setSection('sessions')}}/>},
   {id:'new',label:'新建会话设置',icon:Plus,content:<div className="dsh-chat-sidebar-controls">    <Button variant="outline" size="sm" onClick={()=>void create()} disabled={pending}><Plus className="mr-1 h-4 w-4"/>新建会话</Button>
    {display.developerTools&&<label>新会话预设<select aria-label="新会话预设" className="bg-background max-w-36 border p-1 text-xs" value={preset} onChange={e=>setPreset(e.target.value)}>{presets.data?.presets.map((p:any)=><option key={p.id} value={p.id} disabled={!!p.broken}>{p.name||p.id}</option>)}</select></label>}
    <label>新会话目录<select aria-label="新会话工作区" className="bg-background max-w-44 border p-1 text-xs" value={workspaceId} onChange={e=>setWorkspaceId(e.target.value)}><option value="">外壳默认目录</option>{workspaces.data?.items.map((w:any)=><option key={w.workspaceId} value={w.workspaceId}>{w.title}</option>)}</select></label><p className="text-xs text-muted-foreground">预设和目录用于下一次新建会话。</p><DirectoryPicker onSelected={id=>{setWorkspaceId(id);workspaces.refresh()}}/></div>},
   {id:'current',label:'当前会话设置',icon:SlidersHorizontal,content:active?<div className="dsh-chat-sidebar-controls"><p className="break-words">{rows.find(r=>r.sessionId===active)?.title}</p><p className="text-xs">预设：{rows.find(r=>r.sessionId===active)?.projections?.values.agentPreset||'未记录'}</p><p className="break-all text-xs">目录：{rows.find(r=>r.sessionId===active)?.cwd||'未记录'}</p>    <label>当前会话模型<select aria-label="会话模型" className="bg-background max-w-48 border p-1 text-xs" disabled={!active||pending||view.running} value={selection?JSON.stringify([selection.provider,selection.model]):''} onChange={e=>{const[provider,model]=JSON.parse(e.target.value);void selectModel({provider,model})}}>{!selection&&<option value="">读取模型…</option>}{catalog.data?.groups.map((g:any)=><optgroup key={g.id} label={g.name}>{g.models.map((m:any)=><option key={m.id} value={JSON.stringify([g.id,m.id])}>{m.name}</option>)}</optgroup>)}</select></label>
    {selectedModel?.reasoning&&<label>思考强度<select aria-label="推理强度" className="bg-background border p-1 text-xs" disabled={!active||pending||view.running} value={selection.reasoningEffort||selectedModel.reasoning.defaultEffort} onChange={e=>void selectModel({...selection,reasoningEffort:e.target.value})}>{selectedModel.reasoning.efforts.map((eff:any)=><option key={eff.id} value={eff.id}>{eff.name}</option>)}</select></label>}
<label><input type="checkbox" checked={showSteps} onChange={e=>{setShowSteps(e.target.checked);localStorage.setItem('dsh-show-steps',String(e.target.checked))}}/>显示工作步骤</label><label><input type="checkbox" checked={showReasoning} onChange={e=>{setShowReasoning(e.target.checked);localStorage.setItem('dsh-show-reasoning',String(e.target.checked))}}/>显示思考过程</label>{view.running&&<Button variant="outline" onClick={()=>void stop()}><Square className="mr-1 h-3 w-3"/>停止</Button>}</div>:<p className="p-3">请先选择会话</p>},
   {id:'add',label:'添加内容',icon:Paperclip,content:<div className="dsh-chat-action-list">{isChild&&<p className="text-xs">{childNotice}</p>}<Button variant="outline" disabled={!active||pending||isChild} onClick={()=>fileInput.current?.click()}><Paperclip className="mr-2 h-4 w-4"/>文件</Button><Button variant="outline" disabled={!active||pending||isChild} onClick={()=>imageInput.current?.click()}><ImagePlus className="mr-2 h-4 w-4"/>图片</Button>{[['goal','目标'],['plan','计划'],['feedback','反馈']].map(([id,name])=><Button key={id} variant="outline" disabled={!active} onClick={()=>pickCommand('/'+id+' ')}>{name} · /{id}</Button>)}<p className="text-xs text-muted-foreground">文件上传到当前会话暂存区，点击发送后才提交给模型。单个文件最大 8 MB，每条消息最多 4 个。</p>{pending&&<p role="status">正在处理…</p>}{active&&!isChild&&<ReferencePicker sessionId={active} onInsert={insertReference}/>}</div>},
   {id:'commands',label:'会话指令与工具',icon:Terminal,content:active?<CommandsPanel key={active} sessionId={active} command={command} onCommand={setCommand} onSection={revealSection} onInsert={text=>setDrafts(old=>({...old,[active]:text+(old[active]||'')}))}/>:<p className="p-3">请先选择会话</p>},
   {id:'queue',label:'排队消息',icon:ListTodo,content:active?<QueuePanel key={active} sessionId={active}/>:<p className="p-3">请先选择会话</p>},
   {id:'goal',label:'目标管理',icon:Target,content:active?<GoalPanel key={active} sessionId={active}/>:<p>请先选择会话</p>},
   {id:'generated',label:'生成插件',icon:Blocks,content:<div className="p-3"><CordisPanel/></div>},
   {id:'jobs',label:'后台任务',icon:Workflow,content:active?<JobPanel key={active} sessionId={active}/>:<p className="p-3">请先选择会话</p>},
   {id:'permission',label:'权限策略',icon:ShieldCheck,content:active?<PermissionPanel key={active} sessionId={active}/>:<p className="p-3">请先选择会话</p>},
   {id:'stats',label:'会话统计',icon:ChartNoAxesCombined,content:active?<SessionStatsPanel key={active} sessionId={active}/>:<p className="p-3">请先选择会话</p>},
   {id:'manage',label:'会话管理',icon:Settings2,href:'/chat-management'},
   {id:'feedback',label:'回复反馈',icon:MessageSquare,href:'/reply-effects'},
   {id:'refresh',label:'刷新连接',icon:RefreshCw,onClick:()=>{void refresh();setReconnect(n=>n+1)}},
   {id:'native',label:'打开原生 DSH',icon:ExternalLink,href:'/api/dsh/native',external:true},
  ]}/>
  <input ref={fileInput} aria-label={L("添加文件附件")} type="file" multiple className="hidden" onChange={e=>{if(e.target.files)void uploadFiles(e.target.files);e.target.value=''}}/>
  <input ref={imageInput} aria-label={L("添加图片附件")} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e=>{if(e.target.files)void addImages(e.target.files);e.target.value=''}}/>

  <motion.div onClickCapture={e=>{const a=(e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');if(!a||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||a.hasAttribute('download')||!a.closest('.dsh-message-prose'))return;const href=a.getAttribute('href')||'';if(href.startsWith(fileLinkPrefix)){e.preventDefault();try{const path=workspaceFilePath(decodeURIComponent(href.slice(fileLinkPrefix.length)),activeRow?.cwd||'');window.dispatchEvent(new CustomEvent('dsh-open-file',{detail:{sessionId:active,path}}))}catch(err){setError((err as Error).message)}return}const u=new URL(a.href,location.href);if(!['http:','https:'].includes(u.protocol)||u.origin===location.origin)return;if(display.linkOpening==='sidebar'){e.preventDefault();window.dispatchEvent(new CustomEvent('dsh-open-browser',{detail:u.href}))}else{e.preventDefault();window.open(u.href,'_blank','noopener,noreferrer')}}} className="flex min-w-0 flex-1 flex-col" variants={{initial:{opacity:0,y:'100%'},animate:{opacity:1,y:0}}}>
   <ApprovalPrompt inbox={inbox} sessionId={active} onPlan={openPlan}/>
   {isChild&&<div role="status" className="border-b px-4 py-2 text-xs">{childNotice}{activeRow?.parentSessionId&&rows.some(r=>r.sessionId===activeRow.parentSessionId)&&<Button size="sm" variant="outline" onClick={()=>setActive(activeRow.parentSessionId!)}>返回父会话</Button>}</div>}
   {shownError&&<div role="alert" className="text-destructive border-b px-4 py-2 text-xs break-words">{shownError}</div>}
   {!active?<div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">{L("点击“新建会话”开始使用 DSH")}</div>:<MessageList showBotAvatars={modelIdentity().showAvatar} historyControl={(more??view.hasMore)?<Button variant="outline" size="sm" disabled={pending} onClick={()=>void loadMore()}>{L("加载更早历史")}</Button>:null} toolMessages={allMessages} key={'messages:'+active} messages={messages} isLoadingHistory={loading} botDisplayName={modelIdentity(selection).name} userName={userName} userAvatarPlatform="webui" userAvatarId="local-preview" userAvatarVersion={avatarVersion} language={i18n.language} runtimeStatus={view.running?{kind:'thinking',detail:'DSH 正在处理；审批与提问会自动弹出。',updatedAt:Date.now()}:null}/>}
   {view.running&&!isChild&&<div className="flex items-center gap-3 border-t px-4 py-2 text-xs"><span>{L("运行中仍可发送：")}</span><select aria-label={L("运行中发送方式")} className="bg-background border p-1" value={sendMode} onChange={e=>setSendMode(e.target.value)}><option value="queue">{L("下一轮排队")}</option><option value="steer">{L("下一步引导")}</option></select><span>{L("DSH 将在可处理的边界接收。")}</span></div>}
   {!!files[active]?.length&&<div className="flex flex-wrap gap-2 border-t p-2" aria-label={L("待发送文件")}>{files[active].map(f=><div key={f.receiptId} className="flex max-w-full items-center gap-2 border p-2 text-xs"><span className="truncate">{f.file.name} · {f.file.bytes} B</span><Button size="sm" variant="ghost" aria-label={'移除附件：'+f.file.name} onClick={()=>setFiles(old=>({...old,[active]:old[active].filter(x=>x.receiptId!==f.receiptId)}))}>{L("移除")}</Button></div>)}</div>}

   <ChatComposer voiceInput={<VoiceInput key={active} sessionId={active} onInsert={text=>setDrafts(old=>({...old,[active]:(old[active]||'')+text}))}/>} onAdd={()=>{if(!isChild)setComposerMenu(composerMenu?'':'add')}} onReceiveFiles={receiveFiles} assistantMenu={composerMenu&&active&&!isChild?<ComposerTools sessionId={active} tab={composerMenu} onTab={setComposerMenu} onClose={()=>setComposerMenu('')} onInsert={insertReference} onFile={()=>fileInput.current?.click()} onImage={()=>imageInput.current?.click()} onSection={revealSection}/>:null} hasFileAttachments={!!files[active]?.length} value={drafts[active]||''} onChange={value=>{setDrafts(old=>({...old,[active]:value}));if(/(?:^|\s)@$/.test(value))setComposerMenu('references');else if(value==='/')setComposerMenu('commands')}} onSend={()=>void send()} onAddImages={files=>void addImages(files)} onRemoveImage={id=>setImages(old=>({...old,[active]:(old[active]||[]).filter(i=>i.id!==id)}))} onSendEmoji={unavailable} disabled={!view.connected||pending||isChild} images={images[active]||[]} isConnected={!!active&&view.connected} userId="local-preview"/>
  </motion.div>
  <Dialog open={rename!==null} onOpenChange={o=>{if(!o&&!pending)Rename(null)}}><DialogContent><DialogHeader><DialogTitle>{L('重命名会话')}</DialogTitle><DialogDescription>{L('操作同步到 DSH 会话记录。')}</DialogDescription></DialogHeader><input aria-label={L('会话名称')} className="border bg-background p-2" value={renameTitle} maxLength={200} onChange={e=>RT(e.target.value)}/><Button disabled={pending||!renameTitle.trim()} onClick={()=>void saveRename()}>{L('保存名称')}</Button></DialogContent></Dialog>
  <RightWorkspace sessionId={active} active={right} onActive={setRight} preview={preview} inbox={inbox} onPlan={openPlan}/>
 </div></DisplayContext.Provider>
}

