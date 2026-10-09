export function formatServiceUptime(seconds:unknown):string {
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0)return '暂不可用'
 const value=Math.floor(seconds)
 if(value<60)return `${value}秒`
 if(value<3600)return `${Math.floor(value/60)}分钟`
 return `${Math.floor(value/3600)}小时${Math.floor(value%3600/60)}分`
}
