import {L,useDshLocale} from './locale'
import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {useLoad,Status} from './Management'
import {dsh} from './api'
export function AccountBonuses(){const s=useLoad<any>('v11/bonuses'),[error,E]=useState(''),[busy,B]=useState('');return <div className="space-y-2"><Status error={error}/>{s.data?.bonuses?.map((x:any)=><div key={x.orderId} role="status" className="border bg-accent p-3 space-y-1"><strong>{x.message}</strong><p className="text-sm">{L("赠送")}{x.amount} {x.currency} {L("· 有效至")}{new Date(x.expiresAt).toLocaleString()}</p><Button size="sm" variant="outline" disabled={!!busy} onClick={async()=>{B(x.orderId);try{await dsh('v11/bonus-ack',{accountId:s.data.accountId,orderId:x.orderId});s.refresh()}catch(e){E((e as Error).message)}finally{B('')}}}>{L("知道了")}</Button></div>)}{s.error&&<p className="text-xs text-muted-foreground">{L("赠送额度提醒暂不可用，可刷新账号后重试。")}</p>}</div>}
