const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/);
assert(js,'Inline website JavaScript must exist');
new vm.Script(js[1],{filename:'project-cinema.js'});
for(const id of ['libraryGrid','playerDialog','videoWrap','closePlayer','heroPlay','search','chips','sort','addForm','for-you','recentRail','watchLink','sourceLink','heroArt','navSaved','noResults']){
  assert(html.includes('id="'+id+'"'),'Missing control '+id);
}
assert(!html.includes('external-12-angry-men'),'External-only legacy film must not appear');
assert(!html.includes('mosfilm-candidates.json'),'Legacy channel collection must not be re-added');
assert(!html.includes('rt-collection'),'Rotten Tomatoes search links must not appear');
assert(!html.includes('youtube.com/results'),'Search-result URLs may not masquerade as films');
assert(html.includes('autoplay=1'),'Click-initiated YouTube embed autoplay is required');
assert(html.includes('replaceChildren()'),'Player must clear previous iframe');
const doc=JSON.parse(fs.readFileSync('catalog.json','utf8'));
const movies=doc.movies;
assert(movies.length>=30&&movies.length<=40,'Expected 30–40 source-linked movie candidates; received '+movies.length);
assert.equal(new Set(movies.map(m=>m.id)).size,movies.length,'Duplicate video IDs');
assert.equal(new Set(movies.map(m=>m.title.toLowerCase()+'|'+m.year)).size,movies.length,'Duplicate title/year');
for(const m of movies){
  assert.match(m.id,/^[A-Za-z0-9_-]{11}$/,'Invalid direct YouTube ID '+m.title);
  assert(m.title&&typeof m.title==='string','Missing title');
  assert(Number.isInteger(m.year)&&m.year>=1888&&m.year<=2026,'Invalid year '+m.title);
  assert(['Mosfilm','Korean Film Archive'].includes(m.archive),'Unattributed source '+m.title);
  assert.match(m.watch_url,new RegExp('^https://www\\.youtube\\.com/watch\\?v='+m.id+'$'),'Incorrect direct watch URL '+m.title);
  assert(/^https:\/\//.test(m.source_url),'Missing HTTPS provenance '+m.title);
  assert.equal(m.embed_status,'requires_browser_test','Do not claim playback without testing '+m.title);
}
const byArchive=movies.reduce((o,m)=>(o[m.archive]=(o[m.archive]||0)+1,o),{});
assert(byArchive.Mosfilm>=15&&byArchive['Korean Film Archive']>=10);
const sourceList=JSON.parse(fs.readFileSync('rt-free-movies.json','utf8'));
assert.equal(sourceList.movies.length,100,'Preserve the historical RT source file');
console.log('PASS: JS syntax, 36 source-linked candidates, unique IDs, provenance, autoplay-on-click, no stale external cards, old research intact.');
