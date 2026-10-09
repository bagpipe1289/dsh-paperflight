export function marketProgress(s:any){
 const running=!!(s?.active||s?.busy||s?.operation?.state==='running')
 const phases:Record<string,string>={resolving:'解析依赖',resolution:'解析依赖',fetching:'下载依赖',download:'下载依赖',downloading:'下载依赖',importing:'写入依赖',linking:'链接插件',building:'执行构建',installing:'安装插件',done:'等待安装结果'}
 const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0
 const ratio=(done:unknown,total:unknown)=>valid(done)&&valid(total)&&total>0&&done<=total?Math.floor(done/total*100):null
 const downloading=!s?.phase||['fetching','download','downloading'].includes(s.phase)
 const hasBytes=downloading&&valid(s?.downloaded)
 const bytes=hasBytes?ratio(s.downloaded,s.size):null,counts=ratio(s?.done,s?.total)
 const percent=running?(hasBytes?bytes:counts):null
 const format=(v:number)=>v<1024?`${v} B`:v<1048576?`${(v/1024).toFixed(1)} KB`:`${(v/1048576).toFixed(1)} MB`
 const detail=hasBytes?(bytes!==null?`当前包 ${format(s.downloaded)} / ${format(s.size)}`:`已下载 ${format(s.downloaded)}；总大小待确认`):counts!==null?`当前阶段 ${s.done} / ${s.total}`:s?.done>0?`当前阶段已处理 ${s.done} 项；总量待确认`:'等待市场返回进度'
 return {running,percent,detail,phase:s?.cancelling?'正在取消':phases[s?.phase]||s?.phase||(running?'准备安装':'市场当前空闲')}
}
