export async function checkService(url,project,request=fetch){
  let response;
  try{response=await request(`${url}/__wave/health`,{signal:AbortSignal.timeout(1000),redirect:'error'});}
  catch(error){
    if(error.cause?.code==='ECONNREFUSED')return false;
    throw new Error('无法检查本地服务 请确认本机网络访问未被阻止 然后重试',{cause:error});
  }
  const data=response.ok?await response.json().catch(()=>null):null;
  if(data?.app==='wave-platform'&&data.project===project)return true;
  throw new Error('端口 4173 正被其他服务或旧版声音空间占用 请关闭原服务后重试');
}
