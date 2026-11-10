import fs from 'node:fs/promises';
const user = 'Juani-Alvares';
const headers = {Accept:'application/vnd.github+json', 'User-Agent':'profile-assets'};
if(process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function api(path) {
  const response = await fetch(`https://api.github.com${path}`, {headers, signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`GitHub returned ${response.status} for ${path}`);
  return response.json();
}
const repos=[];
for(let page=1;;page++) {
  const batch=await api(`/users/${user}/repos?type=owner&per_page=100&page=${page}`);
  repos.push(...batch.filter(r=>!r.fork && !r.private));
  if(batch.length<100) break;
}
const languages={};
for(const repo of repos) {
  const data=await api(`/repos/${user}/${repo.name}/languages`);
  for(const [name,bytes] of Object.entries(data)) languages[name]=(languages[name]||0)+bytes;
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const ranked=Object.entries(languages).sort((a,b)=>b[1]-a[1]);
const total=ranked.reduce((sum,[,n])=>sum+n,0);
const top=ranked.slice(0,5);
if(ranked.length>5) top.push(['Other',ranked.slice(5).reduce((sum,[,n])=>sum+n,0)]);
const colors=['#67e8f9','#a78bfa','#f5c97a','#7dd3a8','#f0a6d5','#aab8d0'];
let body='';
top.forEach(([name,bytes],i)=>{
  const y=128+i*35;
  body+=`<text x="28" y="${y}" fill="#dbe7fa" font-size="16">${escape(name)}</text><rect x="180" y="${y-12}" width="420" height="12" rx="5" fill="#243049"/><rect x="180" y="${y-12}" width="${(420*bytes/total).toFixed(2)}" height="12" rx="5" fill="${colors[i]}"/><text x="620" y="${y}" fill="#dbe7fa" font-size="15">${(100*bytes/total).toFixed(1)}%</text>`;
});
const height=160+top.length*35;
const date=new Date().toISOString().slice(0,10);
const stars=repos.reduce((s,r)=>s+r.stargazers_count,0);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 ${height}" role="img"><title>Public GitHub activity, updated ${date}</title><rect width="740" height="${height}" rx="12" fill="#0e1425"/><g font-family="Arial,Helvetica,sans-serif"><text x="28" y="35" font-size="16" letter-spacing="2" fill="#67e8f9">ON GITHUB</text><text x="28" y="76" font-size="22" fill="#f3f6ff">${repos.length} original public repos · ${stars} stars</text>${body}<text x="28" y="${height-22}" fill="#aab8d0" font-size="13">Public code by bytes · Updated ${date} UTC</text></g></svg>\n`;
await fs.writeFile('assets/activity.svg',svg);
console.log(`Generated statistics: ${repos.length} repositories, ${ranked.length} languages.`);
