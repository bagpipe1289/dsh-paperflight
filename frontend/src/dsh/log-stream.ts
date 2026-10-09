import {getSetting} from '@/lib/settings-manager'
/** DSH event adapter; retains the original MaiBot log viewer and filters. */
export interface LogEntry{id:string;timestamp:string;level:'DEBUG'|'INFO'|'WARNING'|'ERROR'|'CRITICAL';module:string;moduleDisplayName?:string;moduleBackgroundColor?:string;moduleBold?:boolean;moduleColor?:string;message:string}
type LogCallback=(logs:LogEntry[])=>void
type ConnectionCallback=(connected:boolean)=>void
export class LogWebSocketManager{
 private source:EventSource|null=null
 private logs:LogEntry[]=[]
 private callbacks=new Set<LogCallback>()
 private connections=new Set<ConnectionCallback>()
 private connected=false
 private clearedAt=0
 private timer:ReturnType<typeof setTimeout>|null=null
 private retries=0
 connect(){if(this.source)return;this.source=new EventSource('/api/dsh/logs');this.source.onopen=()=>{this.retries=0;this.connection(true)};this.source.onerror=()=>{this.connection(false);this.source?.close();this.source=null;if(this.callbacks.size&&this.retries++<Math.max(1,Math.min(100,getSetting('wsMaxReconnectAttempts'))))this.timer=setTimeout(()=>{this.timer=null;this.connect()},Math.max(500,Math.min(60000,getSetting('wsReconnectInterval'))))};this.source.onmessage=e=>{this.logs=(JSON.parse(e.data) as LogEntry[]).filter(x=>Date.parse(x.timestamp)>this.clearedAt).slice(-Math.max(1,Math.min(1000,getSetting('logCacheSize'))));this.callbacks.forEach(f=>f(this.logs))}}
 private connection(on:boolean){this.connected=on;this.connections.forEach(f=>f(on))}
 disconnect(){if(this.timer)clearTimeout(this.timer);this.timer=null;this.retries=0;this.source?.close();this.source=null;this.connection(false)}
 onLog(f:LogCallback){this.callbacks.add(f);this.connect();return()=>{this.callbacks.delete(f);if(!this.callbacks.size)this.disconnect()}}
 onConnectionChange(f:ConnectionCallback){this.connections.add(f);f(this.connected);return()=>{this.connections.delete(f)}}
 getAllLogs(){return this.logs}
 clearLogs(){this.clearedAt=Date.now();this.logs=[];this.callbacks.forEach(f=>f([]))}
 getConnectionStatus(){return this.connected}
}
export const logWebSocket=new LogWebSocketManager()
