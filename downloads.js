const MAX_DOWNLOAD_BYTES=200*1024*1024;
async function readDownload(file){
  if(!file)throw Error('등록할 게임 파일을 선택하세요.');
  if(file.size>MAX_DOWNLOAD_BYTES)throw Error('게임 파일은 200MB 이하여야 합니다.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
  for(let p=0;p<bytes.length;p+=8192)binary+=String.fromCharCode(...bytes.subarray(p,p+8192));
  return {fileName:file.name,size:file.size,data:btoa(binary)};
}
function validDownload(g){
  return typeof g.fileName==='string'&&g.fileName.length>0&&typeof g.data==='string'&&g.data.length<=Math.ceil(MAX_DOWNLOAD_BYTES/3)*4&&g.data.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(g.data)&&Number.isSafeInteger(g.size)&&g.size>=0&&g.size<=MAX_DOWNLOAD_BYTES&&Math.floor(g.data.length*3/4)-(g.data.endsWith('==')?2:g.data.endsWith('=')?1:0)===g.size;
}
function downloadGame(g){
  try{
    if(!validDownload(g))throw Error('저장된 파일 정보가 올바르지 않습니다.');
    const bytes=Uint8Array.from(atob(g.data),c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
    const link=document.createElement('a');link.href=url;link.download=g.fileName.split(/[\\/]/).pop();document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    say('다운로드를 요청했습니다. 다운로드한 게임은 PC에서 실행하세요.');
  }catch(e){say(e.message||'다운로드할 수 없습니다.')}
}
