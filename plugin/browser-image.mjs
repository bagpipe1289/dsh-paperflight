// Use the host attachment store only after the active model explicitly supports images.
export async function projectBrowserImage(data,exec,ctx){
 if(!data.image)return data;
 const image=data.image;delete data.image;
 try{
  const services=exec.agent.ctx,attachments=services.get('attachments')||ctx.get('attachments'),llm=services.get('llm')||ctx.get('llm');
  const config=exec.agent.session.requestHeader?.()?.config,provider=config?.provider??exec.agent.options?.provider,model=config?.model??exec.agent.options?.model;
  if(!attachments||!llm||provider===undefined||model===undefined)throw new Error('宿主未提供可验证的图片通道');
  const info=await llm.resolveModelInfo(provider,model,exec.signal);if(!info.inputModalities?.includes('image'))throw new Error('当前模型未声明支持图片输入；请切换支持视觉的模型');
  const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);if(!match||match[1].length>4*1024*1024)throw new Error('截图格式或大小不受支持');
  exec.signal.throwIfAborted();const [attachment]=await attachments.saveImages([{data:Buffer.from(match[1],'base64'),mediaType:'image/jpeg'}]);
  data.imageAttachment=attachment;data.vision={delivered:true};
 }catch(e){data.vision={delivered:false,reason:e.message};}
 return data;
}
export const browserOutput={schema:{type:'string'},render:(_args,value)=>{try{const data=JSON.parse(value),attachment=data.imageAttachment;delete data.imageAttachment;return [{type:'text',text:JSON.stringify(data)},...(attachment?[{type:'image',attachment}]:[])]}catch{return[{type:'text',text:value}]}}};
