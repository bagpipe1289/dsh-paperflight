import {useCallback} from 'react'
import type {PluginHomeCard} from '@/lib/plugin-api'
const cards:PluginHomeCard[]=[]
export function usePluginHomeCards(){return {pluginHomeCards:cards,isPluginHomeCardsLoading:false,fetchPluginHomeCards:useCallback(async()=>{},[])}}
