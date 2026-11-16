import {env} from 'cloudflare:workers';
import seed from '../../../data/seed.json';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const validDate=(s:any)=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const positive=(n:any)=>typeof n==='number' && Number.isFinite(n) && n>=0 && n<=1e12;
export async function GET(){
 try{
 const db=env.DB!;
 const c=seed.contractor;
 await db.batch([db.prepare('INSERT OR IGNORE INTO contractors(id,name,project,feeder,engineer) VALUES(?,?,?,?,?)').bind(c.id,c.name,c.project,c.feeder,c.engineer),...seed.records.map(r=>db.prepare('INSERT OR IGNORE INTO reports(contractor_id,date,data,version) VALUES(?,?,?,1)').bind(c.id,r.date,JSON.stringify(r)))]);
 const [cs,rs,is]=await Promise.all([db.prepare('SELECT * FROM contractors ORDER BY name').all(),db.prepare('SELECT * FROM reports ORDER BY date').all(),db.prepare('SELECT * FROM issues ORDER BY date,id').all()]);
 return json({contractors:cs.results,reports:rs.results.map((r:any)=>({...JSON.parse(r.data),contractorId:r.contractor_id,version:r.version})),issues:is.results.map((r:any)=>({id:r.id,contractorId:r.contractor_id,date:r.date,itemId:r.item_id,quantity:Number(r.quantity),reference:r.reference}))});
 }catch(e){console.error(e);return json({error:'Data load नहीं हुआ। कृपया दोबारा प्रयास करें।'},500)}
}
export async function POST(req:Request){
 try{
 if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 const b:any=await req.json(); const db=env.DB!;
 if(b.action==='contractor'){
  const c=b.contractor;
  if(!c || ['name','project','feeder','engineer'].some(k=>typeof c[k]!=='string'||!c[k].trim()||c[k].length>160))return json({error:'सभी contractor details भरें।'},400);
  const id=crypto.randomUUID();await db.prepare('INSERT INTO contractors(id,name,project,feeder,engineer) VALUES(?,?,?,?,?)').bind(id,c.name.trim(),c.project.trim(),c.feeder.trim(),c.engineer.trim()).run();return json({id});
 }
 if(!await db.prepare('SELECT id FROM contractors WHERE id=?').bind(b.contractorId||'').first())return json({error:'Contractor नहीं मिला।'},400);
 if(!validDate(b.date))return json({error:'सही तारीख चुनें।'},400);
 if(b.action==='report'){
  if(!b.quantities || typeof b.quantities!=='object' || Object.entries(b.quantities).some(([k,v])=>!seed.items.some(i=>i.id===k)||!positive(v)))return json({error:'Item quantities सही भरें।'},400);
  if(!b.manpower || ['leader','skilled','unskilled','tractor','augur','room'].some(k=>!positive(b.manpower[k]))||['leader','skilled','unskilled'].some(k=>!Number.isInteger(b.manpower[k])))return json({error:'Manpower में पूरे और charges में सही नंबर भरें।'},400);
  if(typeof b.remarks!=='string'||b.remarks.length>2000)return json({error:'Remarks बहुत लंबे हैं।'},400);
  const data=JSON.stringify({date:b.date,quantities:b.quantities,manpower:b.manpower,remarks:b.remarks});
  const result=b.version ? await db.prepare('UPDATE reports SET data=?,version=version+1 WHERE contractor_id=? AND date=? AND version=?').bind(data,b.contractorId,b.date,b.version).run() : await db.prepare('INSERT OR IGNORE INTO reports(contractor_id,date,data,version) VALUES(?,?,?,1)').bind(b.contractorId,b.date,data).run();
  if(!result.meta.changes)return json({error:'इस तारीख का report दूसरे session में बदल गया है। Refresh करके फिर खोलें।'},409);
  return json({ok:true});
 }
 if(b.action==='issue'){
  if(!seed.items.some(i=>i.id===b.itemId)||!positive(b.quantity)||b.quantity===0||typeof b.reference!=='string'||b.reference.length>200)return json({error:'Item, quantity और reference जाँचें।'},400);
  await db.prepare('INSERT INTO issues(id,contractor_id,date,item_id,quantity,reference) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),b.contractorId,b.date,b.itemId,String(b.quantity),b.reference).run();return json({ok:true});
 }
 return json({error:'Invalid action'},400);
 }catch(e){console.error(e);return json({error:'Save नहीं हुआ। Internet connection जाँचकर फिर प्रयास करें।'},500)}
}
