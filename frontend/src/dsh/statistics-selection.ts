import type {DashboardData} from '../routes/home/types'
export async function selectStatistics(load:(hours:number)=>Promise<DashboardData>,manual:number|null){
 const ranges=manual===null?[24,168,720]:[manual]
 for(const hours of ranges){
  const data=await load(hours)
  if(data.summary.total_requests>0)return{hours,data}
  if(hours===ranges[ranges.length-1])return{hours,data:emptyStatisticsDisplay(data)}
 }
 throw new Error('统计时段无效')
}
// Only the display copy uses missing values; the server's real zero counts remain intact.
export function emptyStatisticsDisplay(data:DashboardData):DashboardData{
 return {...data,summary:Object.fromEntries(Object.keys(data.summary).map(key=>[key,key.endsWith('_rate')?null:NaN])) as unknown as DashboardData['summary']}
}
