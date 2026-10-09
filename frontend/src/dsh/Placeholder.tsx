import {L,useDshLocale} from './locale'
import { useRouterState } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
export function Placeholder(){const route=useRouterState({select:s=>s.location.pathname});return <div className="p-4 sm:p-6"><Card><CardHeader><CardTitle>{L("暂未接入")}</CardTitle><CardDescription>{L("此功能尚未接入 DSH。")}</CardDescription></CardHeader><CardContent><p className="text-muted-foreground text-sm">{L("这一页将在后续接入，当前没有可操作的内容。")}</p><p className="mt-4 text-xs text-muted-foreground">{route}</p></CardContent></Card></div>}
