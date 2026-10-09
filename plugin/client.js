window.__ModuleLoader__.load({id:'dsh-paperflight',factory:(require)=>{
 const React=require('react');
 function Panel(){return React.createElement('section',{style:{padding:24}},
  React.createElement('h2',null,'纸航 Paperflight'),
  React.createElement('p',null,'DSH 的非官方未来复古 Web 界面。启用后默认进入纸航，使用当前 DSH 的会话、模型、预设和插件。停用后恢复原生界面。'),
  React.createElement('a',{href:'/mai-shell',target:'_blank',rel:'noopener noreferrer'},'打开 纸航界面 ↗'),
  React.createElement('p',null,'停用或卸载插件会关闭外壳服务；会话、配置和外壳数据保留。已验证宿主版本：DSH 0.1.7-rc.2、0.2.0-rc.2。'))}
 return {inject:['slots'],apply(ctx){
  ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'mai-shell',order:41,label:()=> '纸航 Paperflight'},()=>React.createElement(Panel)));
  // Redirect only a plain native landing page. Explicit native entry and deep links stay native.
  const landing=()=>window.location.pathname==='/'&&!window.location.search&&!window.location.hash;
  if(!landing())return;
  let stopped=false,timer,attempts=0;const abort=new AbortController();
  ctx.effect(()=>()=>{stopped=true;clearTimeout(timer);abort.abort()},'mai-shell: default entry');
  const check=async()=>{
   try{
    const response=await fetch('/mai-shell/status',{credentials:'same-origin',cache:'no-store',signal:abort.signal});
    if(stopped||!landing()||!response.ok)return;
    const state=await response.json();
    if(stopped||!landing())return;
    if(state.state==='ready'){window.location.replace('/mai-shell');return}
    if(state.state==='starting'&&++attempts<10)timer=setTimeout(check,1000);
   }catch{/* Keep the usable native page when shell status is unavailable. */}
  };
  void check();
 }};
}});
