import fs from 'node:fs/promises';
import path from 'node:path';

const documents = Object.freeze({license:'LICENSE',notice:'NOTICE.md',privacy:'docs/PRIVACY.md',install:'docs/SECOND-DEVICE.md'});
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Fixed document routes only. User input never becomes a filesystem path.
export async function legalResponse(pathname, payloadRoot) {
  if(pathname === '/legal/source.tgz') return {type:'application/gzip',download:'dsh-paperflight-corresponding-source.tgz',body:await fs.readFile(path.join(payloadRoot,'corresponding-source.tgz'))};
  if(pathname !== '/legal' && (!pathname.startsWith('/legal/') || !Object.hasOwn(documents,pathname.slice('/legal/'.length)))) return null;
  const sourceRoot=path.join(payloadRoot,'../source');
  const pkg=JSON.parse(await fs.readFile(path.join(sourceRoot,'package.json'),'utf8'));
  const file=documents[pathname.slice('/legal/'.length)];
  const content=file?'<pre>'+escape(await fs.readFile(path.join(sourceRoot,file),'utf8'))+'</pre>':`<h2>非官方未来复古外壳</h2><p>本项目修改自 MaiBot Dashboard 1.7.3。原作者与第三方版权声明保留在来源声明中；外壳适配代码采用 AGPL-3.0-only。</p><p>本软件不提供担保。你可以依 AGPL 条件使用、修改和再分发；许可证赋予接收者的权利不因分发渠道而改变。</p><p>下方提供本次安装包对应的完整源码、构建步骤、第三方许可和隐私说明。源码下载由本机插件提供，无需 GitHub 登录。</p><p><a href="/legal/source.tgz">下载本版本对应源码（含构建脚本与许可）</a></p><p><a href="https://github.com/bagpipe1289/dsh-paperflight">项目仓库与问题反馈</a> · 公开实验性预览项目。</p>`;
  return {type:'text/html; charset=utf-8',body:`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>许可、隐私与源码 · 纸航 Paperflight</title><style>body{max-width:960px;margin:36px auto;padding:0 24px;background:#f3e5cd;color:#074c57;font:17px/1.7 system-ui}a{color:#ad421d}nav{display:flex;flex-wrap:wrap;gap:18px;border-block:1px solid;padding:14px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}h1{font-size:28px}</style><h1>许可、隐私与源码 · ${escape(pkg.version)}</h1><nav><a href="/settings">返回设置</a><a href="/legal">项目说明</a><a href="/legal/license">AGPL 全文</a><a href="/legal/notice">来源与版权</a><a href="/legal/privacy">隐私说明</a><a href="/legal/install">换设备安装</a><a href="/legal/source.tgz">对应源码</a></nav>${content}</html>`};
}
