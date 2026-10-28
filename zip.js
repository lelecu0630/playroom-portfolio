// ZIP reader: central directory sizes are checked before decompression.
async function readGameZip(file) {
  if(file.size>50*1024*1024) throw Error('ZIP 파일은 50MB 이하여야 합니다.');
  const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break}
  if(end<0)throw Error('올바른 ZIP 파일이 아닙니다.');
  const count=v.getUint16(end+10,true);let offset=v.getUint32(end+16,true),total=0;
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count===65535||count>2000)throw Error('분할 ZIP 또는 파일이 2,000개를 넘는 ZIP은 지원하지 않습니다.');
  const files={};
  for(let n=0;n<count;n++){
    if(offset+46>bytes.length||v.getUint32(offset,true)!==0x02014b50)throw Error('ZIP 목록이 손상되었습니다.');
    const flags=v.getUint16(offset+8,true),method=v.getUint16(offset+10,true),size=v.getUint32(offset+24,true),packed=v.getUint32(offset+20,true),nl=v.getUint16(offset+28,true),xl=v.getUint16(offset+30,true),cl=v.getUint16(offset+32,true),local=v.getUint32(offset+42,true);
    const name=new TextDecoder().decode(bytes.subarray(offset+46,offset+46+nl)).replaceAll('\\','/');offset+=46+nl+xl+cl;
    if(name.endsWith('/')||name.startsWith('__MACOSX/'))continue;
    if(name.startsWith('/')||name.split('/').some(s=>s==='..')||Object.hasOwn(files,name)||name==='__proto__')throw Error('ZIP 안에 잘못된 파일 경로가 있습니다.');
    total+=size;if(total>150*1024*1024||size>50*1024*1024)throw Error('압축 해제 크기는 총 150MB, 파일당 50MB 이하여야 합니다.');
    if(flags&1)throw Error('비밀번호가 걸린 ZIP은 지원하지 않습니다.');
    if(local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)throw Error('ZIP 파일이 손상되었습니다.');
    const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);if(start+packed>bytes.length)throw Error('ZIP 파일이 잘렸습니다.');
    let raw=bytes.slice(start,start+packed);
    if(method===8){
      const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();let chunks=[],length=0;
      for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>size){await reader.cancel();throw Error('ZIP 크기 정보가 올바르지 않습니다.')}chunks.push(r.value)}
      raw=new Uint8Array(length);let p=0;for(const chunk of chunks){raw.set(chunk,p);p+=chunk.length}
    }else if(method!==0)throw Error('지원하지 않는 ZIP 압축 방식입니다. 일반 ZIP으로 다시 압축하세요.');
    if(raw.length!==size)throw Error('ZIP 파일 크기가 올바르지 않습니다.');
    let binary='';for(let p=0;p<raw.length;p+=8192)binary+=String.fromCharCode(...raw.subarray(p,p+8192));files[name]=btoa(binary);
  }
  const entries=Object.keys(files).filter(p=>/\.html?$/i.test(p)).sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b));
  if(!entries.length)throw Error('ZIP 안에 HTML 실행 파일이 없습니다. 웹용 게임 빌드를 압축하세요.');
  return {files,entries,entry:entries.find(p=>/(^|\/)index\.html?$/i.test(p))||entries[0]};
}
let zipObjectUrls=[];
function releaseZip(){zipObjectUrls.forEach(u=>URL.revokeObjectURL(u));zipObjectUrls=[]}
function zipGameUrl(game){
  const files=game.files,cache=new Map(),active=new Set(),decoder=new TextDecoder();
  const mime=p=>({'html':'text/html','htm':'text/html','js':'text/javascript','mjs':'text/javascript','css':'text/css','json':'application/json','svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','gif':'image/gif','mp3':'audio/mpeg','ogg':'audio/ogg','wav':'audio/wav','wasm':'application/wasm','woff2':'font/woff2'}[p.split('.').pop().toLowerCase()]||'application/octet-stream');
  function resolve(ref,from){if(!ref||/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref))return null;try{const u=new URL(ref,'https://zip.invalid/'+from);const p=decodeURIComponent(u.pathname.slice(1));return Object.hasOwn(files,p)?p:null}catch{return null}}
  function rewrite(ref,from){const p=resolve(ref,from);return p?build(p):ref}
  function build(path){
    if(cache.has(path))return cache.get(path);if(active.has(path))throw Error('순환 모듈이 있는 게임은 게시된 게임 주소로 등록해주세요.');active.add(path);
    let raw=Uint8Array.from(atob(files[path]),c=>c.charCodeAt(0)),type=mime(path),content=raw;
    const css=s=>s.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(_,q,ref)=>'url("'+rewrite(ref,path)+'")').replace(/(@import\s*)(['"])(.*?)\2/gi,(_,prefix,q,ref)=>prefix+q+rewrite(ref,path)+q);
    const js=s=>s.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\2/g,(_,prefix,q,ref)=>prefix+q+rewrite(ref,path)+q).replace(/(new\s+URL\s*\(\s*)(['"])([^'"]+)\2/g,(_,prefix,q,ref)=>prefix+q+rewrite(ref,path)+q);
    if(type==='text/css')content=css(decoder.decode(raw));
    else if(type==='text/javascript')content=js(decoder.decode(raw));
    else if(type==='text/html'){
      const doc=new DOMParser().parseFromString(decoder.decode(raw),'text/html');doc.querySelectorAll('base').forEach(n=>n.remove());
      doc.querySelectorAll('[src],[href],[poster]').forEach(n=>{for(const attr of ['src','href','poster'])if(n.hasAttribute(attr))n.setAttribute(attr,rewrite(n.getAttribute(attr),path));if(n.tagName==='SCRIPT'){n.removeAttribute('integrity');n.removeAttribute('crossorigin')}});
      doc.querySelectorAll('[srcset]').forEach(n=>n.setAttribute('srcset',n.getAttribute('srcset').split(',').map(part=>{const [ref,...rest]=part.trim().split(/\s+/);return [rewrite(ref,path),...rest].join(' ')}).join(', ')));
      doc.querySelectorAll('style').forEach(n=>n.textContent=css(n.textContent));doc.querySelectorAll('[style]').forEach(n=>n.setAttribute('style',css(n.getAttribute('style'))));doc.querySelectorAll('script:not([src])').forEach(n=>{if(!n.type||n.type==='module'||n.type==='text/javascript')n.textContent=js(n.textContent)});
      // Runtime image/audio/fetch paths used by ordinary canvas games.
      const map={};for(const p of Object.keys(files))if(!/\.(?:html?|css|m?js)$/i.test(p))map[p]=build(p);
      const bootstrap=doc.createElement('script');bootstrap.textContent='('+function(map,path){const root='https://zip.invalid/';function resolve(value){try{const u=new URL(String(value),root+path);return u.origin===new URL(root).origin?(map[decodeURIComponent(u.pathname.slice(1))]||value):value}catch{return value}}const fetchOriginal=window.fetch;window.fetch=(input,init)=>fetchOriginal(typeof input==='string'||input instanceof URL?resolve(input):input,init);const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){return open.call(this,method,resolve(url),...args)};for(const [ctor,property] of [[HTMLImageElement,'src'],[HTMLMediaElement,'src'],[HTMLSourceElement,'src']]){const d=Object.getOwnPropertyDescriptor(ctor.prototype,property);if(d?.set)Object.defineProperty(ctor.prototype,property,{...d,set(value){d.set.call(this,resolve(value))}})}}.toString()+')('+JSON.stringify(map)+','+JSON.stringify(path)+');';doc.head.prepend(bootstrap);content='<!doctype html>'+doc.documentElement.outerHTML;
    }
    const url=URL.createObjectURL(new Blob([content],{type}));zipObjectUrls.push(url);cache.set(path,url);active.delete(path);return url;
  }
  try{return build(game.entry)}catch(e){releaseZip();throw e}
}
