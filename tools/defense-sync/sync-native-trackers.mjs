import { writeFile } from 'node:fs/promises';
const sources=[
 {name:'Vivo',url:'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.vivo.txt',output:new URL('../../ruleset/native-vivo.txt',import.meta.url)},
 {name:'Huawei',url:'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.huawei.txt',output:new URL('../../ruleset/native-huawei.txt',import.meta.url)},
];
function parseList(name,text){
 const expected=Number(text.match(/^! Number of entries: (\d+)$/m)?.[1]);
 const entries=text.split(/\r?\n/).map(line=>line.match(/^\|\|([a-z0-9.-]+)\^$/i)?.[1]).filter(Boolean).map(d=>d.toLowerCase());
 if(!expected||entries.length!==expected)throw new Error(name+': upstream entry count mismatch; refusing update');
 if(new Set(entries).size!==entries.length)throw new Error(name+': duplicate domains; refusing update');
 if(entries.some(d=>d.length>253||d.startsWith('.')||d.endsWith('.')))throw new Error(name+': invalid domain; refusing update');
 return entries.join('\n')+'\n';
}
const pending=[];
for(const source of sources){
 const response=await fetch(source.url,{headers:{'user-agent':'MyClash-Defense-Sync/1.0'}});
 if(!response.ok)throw new Error(source.name+': upstream HTTP '+response.status);
 pending.push({...source,outputText:parseList(source.name,await response.text())});
}
for(const item of pending){await writeFile(item.output,item.outputText,'utf8');console.log('✓ '+item.name+': '+item.outputText.trim().split('\n').length+' domains');}
