import fs from 'node:fs/promises';
export const name='paperflight-preset-guide';
export const inject=['skills'];
export async function apply(ctx){const content=await fs.readFile(new URL('./preset-guide.md',import.meta.url),'utf8');ctx.skills.register({name:'paperflight-preset-tools',description:'为 DSH Agent 预设添加 PaperFlight CMD 或共享浏览器：原生组件名称、配置示例、依赖及验证。',source:'bundled',content});}
