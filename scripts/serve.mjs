import http from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav'};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(req.url==='/__wave/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({app:'wave-platform',project:createHash('sha256').update(root).digest('hex')}));return;}
  const raw=decodeURIComponent(new URL(req.url,'http://localhost').pathname),route=raw==='/'?'/public/index.html':raw;
  if(!['/public/','/src/','/schemas/'].some(prefix=>route.startsWith(prefix))||route.includes('\0'))throw new Error('not allowed');
  const file=await realpath(path.join(root,route));
  const relative=path.relative(root,file).split(path.sep).join('/');
  if(!['public/','src/','schemas/'].some(prefix=>relative.startsWith(prefix))||!mime[path.extname(file)])throw new Error('not allowed');
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
const port=Number(process.env.WAVE_PORT??4173);
server.on('error',error=>{console.error(`本地服务无法启动：${error.code}. 未建立监听。`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Wave core: http://127.0.0.1:${port}`));
