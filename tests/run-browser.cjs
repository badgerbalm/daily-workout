// Serve this checkout on an ephemeral local port and run browser regressions.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
 let file;
 try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname))}catch{response.writeHead(400).end();return}
 if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return}
 if(file===root)file=path.join(root,'index.html');
 fs.readFile(file,(error,bytes)=>{response.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});response.end(error?'Not found':bytes)});
});
server.listen(0,'127.0.0.1',async()=>{
 try{
  const base=`http://127.0.0.1:${server.address().port}/`;
  const all=['verify-watch-sections.cjs','verify-mobile.cjs','verify-photo-loading.cjs','verify-navigation.cjs','verify-google-sync-browser.cjs','verify-production.cjs','verify-posture-images.cjs'];
  const selected=process.argv.slice(2);if(selected.some(test=>!all.includes(test)))throw Error('Unknown browser test');
  for(const test of selected.length?selected:all){
   const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,test),base],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>resolve(code??1))});
   if(code)process.exitCode=code;
  }
 }catch(error){console.error(error);process.exitCode=1}finally{server.close()}
});
