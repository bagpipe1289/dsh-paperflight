import {rpc,rpcArgs} from './dsh-client.mjs';
const validId=x=>{if(typeof x!=='string'||!/^[-\w]{1,120}$/.test(x))throw new Error('会话标识无效');return x};
export async function uploadFile(b){
 validId(b.sessionId);
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>255||typeof b.data!=='string'||b.data.length>11200000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data))throw new Error('文件无效或超过 8 MB');
 if(Buffer.from(b.data,'base64').length>8*1024*1024)throw new Error('单个文件最大 8 MB');
 return rpcArgs('fileUploads/upload',{agentId:b.sessionId,request:{name:b.name,data:b.data}});
}
export async function permissionCatalog(){return rpcArgs('permissionPresets/catalog')}
export async function permission(b){
 validId(b.sessionId);if(b.confirm!==true)throw new Error('请确认权限变更');
 if(typeof b.value!=='string'||!/^[-a-z]+$/.test(b.value)||!(await permissionCatalog()).options.some(x=>x.value===b.value))throw new Error('权限预设不可用');
 if(b.value==='danger-full-access'&&b.acceptFullAccess!==true)throw new Error('完全访问需单独确认');
 const result=await rpcArgs('commands/execute',{agentId:b.sessionId,line:'/permission '+b.value,submittedAttachments:[]});
 if(!result)throw new Error('当前会话没有权限指令');return result;
}
