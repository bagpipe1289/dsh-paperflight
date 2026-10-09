import {useCallback} from 'react'
import type {LocalCacheStats} from '@/lib/system-api'
const stats={directories:['images','emoji','logs'].map(key=>({key,total_size:NaN,file_count:NaN,db_records:NaN})),database:{total_size:NaN,files:[],tables:[]}} as unknown as LocalCacheStats
export function useLocalCacheMetrics(){return{localCacheStats:stats,isLocalCacheStatsLoading:false,fetchLocalCacheStats:useCallback(async()=>{},[])}}
