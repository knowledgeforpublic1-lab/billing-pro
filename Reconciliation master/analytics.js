/** Read-only dashboard calculations. Quantity units are never added together. */
(function(root){
 const num=x=>Number.isFinite(Number(x))?Number(x):0;
 root.MasterAnalytics={build(data,selected=''){
  const contractors=(data.Contractors||[]).filter((c,i)=>selected===''||String(i)===String(selected));
  const out={contractors:contractors.length,rows:0,issue:0,consumed:0,wip:0,balance:0,deficit:0,missingRates:0,negativeRows:0,updated:0,materials:[],ranking:[]};
  const materials=new Map();
  for(const c of contractors){let liability=0;if(c.IssueStockSource)out.updated++;
   for(const row of c.Items||[]){out.rows++;const rate=num(row.DebitRate),bal=num(row.BalanceQty);if(rate<=0&&(num(row.NetIssue)||num(row.Consumption)||bal))out.missingRates++;
    out.issue+=num(row.NetIssue)*rate;out.consumed+=num(row.Consumption)*rate;out.wip+=num(row.WIP)*rate;
    if(bal>0){out.balance+=bal*rate;liability+=bal*rate;}if(bal<0){out.deficit+=-bal*rate;out.negativeRows++;}
    const key=String(row.ItemCode||row.ItemDescription)+'|'+String(row.UOM||'').toUpperCase();
    if(!materials.has(key))materials.set(key,{code:String(row.ItemCode||''),label:row.ItemDescription||row.ItemCode||'Unnamed',unit:row.UOM||'',consumed:0,balance:0});
    const m=materials.get(key);m.consumed+=num(row.Consumption)*rate;m.balance+=Math.max(0,bal)*rate;
   }out.ranking.push({name:c.ContractorName,index:(data.Contractors||[]).indexOf(c),value:liability});
  }out.materials=[...materials.values()].sort((a,b)=>b.consumed-a.consumed);out.ranking.sort((a,b)=>b.value-a.value);return out;
 }};
})(typeof window!=='undefined'?window:globalThis);
