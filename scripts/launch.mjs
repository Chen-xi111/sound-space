import {spawn} from 'node:child_process';
import {checkService} from './launch-check.mjs';
import {mkdir,open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const url='http://127.0.0.1:4173';
const project=createHash('sha256').update(root).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=()=>checkService(url,project);
async function main(){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('需要 Node.js 22 或更新版本');
  let ready=await check();
  if(!ready){
    const dir=path.join(root,'.local');await mkdir(dir,{recursive:true});
    const log=await open(path.join(dir,'server.log'),'a');
    const child=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{cwd:root,detached:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,WAVE_PORT:'4173'}});
    let failure=null;child.on('error',error=>{failure=error;});child.unref();await log.close();
    for(let attempt=0;attempt<40;attempt++){if(failure)throw failure;await sleep(150);if(await check()){ready=true;break;}}
    if(!ready){const detail=(await readFile(path.join(dir,'server.log'),'utf8')).slice(-1000);throw new Error(`服务未能启动 请查看 .local/server.log 后重试\n${detail}`);}
  }
  // Also verify that the application document is available before handing off.
  const page=await fetch(url,{signal:AbortSignal.timeout(2000)});
  if(!page.ok)throw new Error('服务已启动但页面不可用 请检查 public/index.html');
  console.log(`声音空间已就绪 ${url}\n服务在后台运行 关闭此窗口不影响播放`);
  if(!process.argv.includes('--no-open')){
    const child=spawn('/usr/bin/open',[url],{stdio:'ignore'});
    await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`自动打开失败 请手动访问 ${url}`)));});
  }
}
main().catch(error=>{console.error(`声音空间启动失败\n${error.message}`);process.exitCode=1;});
