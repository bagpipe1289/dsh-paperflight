import {backendOrigin} from './runtime-config.mjs';
import {rpcArgs} from './dsh-client.mjs';
// The native backend owns PKCE, callback validation and credential storage.
// Never accept a browser-supplied callback destination or pass tokens through this shell.
export async function accountAction(input,call=rpcArgs){
 const client={version:'0.1.7-rc.2',locale:'zh-CN',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60};
 switch(input?.action){
  case 'start': return call('account/startSignIn',{client,callbackOrigin:backendOrigin,loginSource:'web'});
  case 'cancel': {
   if(typeof input.attemptId!=='string'||!/^[-\w]{1,100}$/.test(input.attemptId))throw new Error('登录请求标识无效，请刷新');
   const state=await call('account/getState');
   if(state.attempt?.id!==input.attemptId)throw new Error('登录请求已变化，请刷新');
   if(state.attempt.phase==='committing')throw new Error('正在保存授权，请稍候');
   return call('account/cancelSignIn',{attemptId:input.attemptId});
  }
  case 'signout':
   if(input.confirm!==true)throw new Error('请先确认退出账号');
   return call('account/signOut',{client});
  default: throw new Error('未知账号操作');
 }
}
