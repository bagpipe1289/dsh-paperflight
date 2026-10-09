export function sessionOperationError(error){
 if(error?.code==='session/agent-busy'&&/subagent/i.test(error?.details?.reason||error?.message||''))return '这是由父会话管理的子代理记录，不能通过普通会话入口上传附件或发送消息。请返回父会话添加文件；子代理通信请使用原生子代理面板。';
 return error?.message||JSON.stringify(error);
}
