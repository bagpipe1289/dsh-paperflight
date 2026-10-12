export const name='paperflight-tool-cmd';
export const inject=['tools','paperflightTools'];
export function apply(ctx){ctx.effect(()=>ctx.paperflightTools.mount(ctx,'terminal'),'PaperFlight native preset tool');}
