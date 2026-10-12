export const name='paperflight-tool-browser';
export const inject=['tools','paperflightTools'];
export function apply(ctx){ctx.effect(()=>ctx.paperflightTools.mount(ctx,'browser'),'PaperFlight native preset tool');}
