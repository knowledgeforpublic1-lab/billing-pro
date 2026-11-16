import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import seed from '../data/seed.json';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const col=(i:number)=>i<26?String.fromCharCode(65+i):'A'+String.fromCharCode(65+i-26);
export async function downloadReport(contractor:any,reports:any[],from:string,to:string){
 const days:string[]=[];for(let d=new Date(from+'T00:00:00Z');d<=new Date(to+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));
 if(!days.length||days.length>366)throw Error('1 से 366 दिनों का date range चुनें।');
 const res=await fetch('/template.xlsx');if(!res.ok)throw Error('Excel template load नहीं हुआ।');
 const files=unzipSync(new Uint8Array(await res.arrayBuffer()));
 const parse=(s:string)=>new DOMParser().parseFromString(s,'application/xml');
 const serialize=(d:Document)=>strToU8(new XMLSerializer().serializeToString(d));
 const original=strFromU8(files['xl/worksheets/sheet1.xml']);
 const wb=parse(strFromU8(files['xl/workbook.xml']));
 const rel=parse(strFromU8(files['xl/_rels/workbook.xml.rels']));
 const types=parse(strFromU8(files['[Content_Types].xml']));
 wb.querySelector('externalReferences')?.remove();wb.querySelector('definedNames')?.remove();wb.querySelector('calcPr')?.remove();
 for(const x of [...rel.documentElement.children])if(/externalLink|calcChain/.test(x.getAttribute('Type')||''))x.remove();
 for(const k of Object.keys(files))if(k.startsWith('xl/externalLinks/')||k==='xl/calcChain.xml')delete files[k];
 for(const x of [...types.documentElement.children])if(/externalLink|calcChain/.test(x.getAttribute('PartName')||''))x.remove();
 const sheets=wb.querySelector('sheets')!;sheets.replaceChildren();
 for(let start=0,index=1;start<days.length;start+=30,index++){
  const chunk=days.slice(start,start+30),doc=parse(original),sd=doc.querySelector('sheetData')!;
  const cell=(address:string,value:any,formula?:string)=>{
   const rowNum=address.match(/\d+/)![0];let row=[...sd.children].find(x=>x.getAttribute('r')===rowNum);
   if(!row){row=doc.createElementNS(ns,'row');row.setAttribute('r',rowNum);const next=[...sd.children].find(x=>Number(x.getAttribute('r'))>Number(rowNum));sd.insertBefore(row,next||null)}
   let c=[...row.children].find(x=>x.getAttribute('r')===address);
   if(!c){c=doc.createElementNS(ns,'c');c.setAttribute('r',address);const rank=(a:string)=>a.replace(/\d+/,'').split('').reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);const next=[...row.children].find(x=>rank(x.getAttribute('r')!)>rank(address));row.insertBefore(c,next||null)}
   c.removeAttribute('t');c.replaceChildren();
   if(typeof value==='string'){c.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.textContent=value;is.appendChild(t);c.appendChild(is)}
   else if(value!==null){if(formula){const f=doc.createElementNS(ns,'f');f.textContent=formula;c.appendChild(f)}const v=doc.createElementNS(ns,'v');v.textContent=String(value);c.appendChild(v)}
  };
  for(const c of [...sd.querySelectorAll('c')]){const a=c.getAttribute('r')!,r=Number(a.match(/\d+/)![0]),cl=a.replace(/\d+/,'');if(r>=6&&r!==14&&cl.length<3&&((cl.length===1&&cl>='E')||(cl.length===2&&cl<='AJ')))cell(a,null)}
  for(const r of [...sd.children])r.removeAttribute('hidden');doc.querySelector('autoFilter')?.remove();
  cell('A2','PROJECT NAME: '+contractor.project);cell('A3','NAME OF FEEDER: '+contractor.feeder);cell('A4','NAME OF DEPT. LABOUR TEAM: '+contractor.name);cell('A5','NAME OF ENGINEER/SUPERVISOR: '+contractor.engineer);
  chunk.forEach((date,i)=>{const c=col(i+4),r=reports.find(x=>x.date===date),m=r?.manpower||{};
   cell(c+'7',Math.round((Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000));
   cell(c+'6',r?(m.leader||0)+(m.skilled||0)+(m.unskilled||0):null);
   ['leader','skilled','unskilled','tractor','augur','room'].forEach((k,j)=>cell(c+(8+j),r?m[k]||0:null));
   seed.items.forEach(it=>{const q=r?.quantities[it.id];if(q)cell(c+it.row,q)});
  });
  seed.items.forEach((it,i)=>{cell('A'+it.row,i+1);const total=chunk.reduce((sum,d)=>sum+(reports.find(r=>r.date===d)?.quantities[it.id]||0),0);cell('AI'+it.row,total,`SUM(E${it.row}:AH${it.row})`)});
  cell('AJ8',chunk.map(d=>{const r=reports.find(x=>x.date===d);return r?.remarks?d+': '+r.remarks:''}).filter(Boolean).join('\n'));
  const name=`Progress ${index}`,sheet=wb.createElementNS(ns,'sheet');sheet.setAttribute('name',name);sheet.setAttribute('sheetId',String(index));sheet.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','r:id',index===1?'rId1':'progress'+index);sheets.appendChild(sheet);
  files[`xl/worksheets/sheet${index}.xml`]=serialize(doc);
  if(index>1){const rr=rel.createElementNS(rel.documentElement.namespaceURI,'Relationship');rr.setAttribute('Id','progress'+index);rr.setAttribute('Type','http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');rr.setAttribute('Target',`worksheets/sheet${index}.xml`);rel.documentElement.appendChild(rr);const ct=types.createElementNS(types.documentElement.namespaceURI,'Override');ct.setAttribute('PartName',`/xl/worksheets/sheet${index}.xml`);ct.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');types.documentElement.appendChild(ct);if(files['xl/worksheets/_rels/sheet1.xml.rels'])files[`xl/worksheets/_rels/sheet${index}.xml.rels`]=files['xl/worksheets/_rels/sheet1.xml.rels']}
 }
 files['xl/workbook.xml']=serialize(wb);files['xl/_rels/workbook.xml.rels']=serialize(rel);files['[Content_Types].xml']=serialize(types);
 const blob=new Blob([zipSync(files) as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${contractor.name.replace(/[^a-z0-9 -]/gi,'')}_${from}_${to}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}

