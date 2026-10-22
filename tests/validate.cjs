const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const read=(path)=>JSON.parse(fs.readFileSync(path,'utf8'));
const html=fs.readFileSync('index.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/);
assert(js,'Inline project script must exist');
new vm.Script(js[1],{filename:'project-cinema.js'});
for(const id of ['libraryGrid','playerDialog','videoWrap','closePlayer','heroPlay','search','chips','experienceChips','focusChoices','mood-hub','spectacleRail','dramaRail','funRail','heroDots','heroPause','addForm','watchLink','sourceLink','heroArt','navSaved','noResults']){
 assert(html.includes('id="'+id+'"'),'Missing UI element '+id);
}
assert(!html.includes('external-12-angry-men'));
assert(!html.includes('mosfilm-candidates.json'));
assert(!html.includes('rt-collection'));
assert(!html.includes('youtube.com/results'));
assert(html.includes('autoplay=1'),'User-initiated YouTube embed should request autoplay');
assert(html.includes('replaceChildren()'),'Player should remove iframe when closed');

const archive=read('catalog.json').movies;
const additions=read('new-features.json').movies;
const editorial=read('cinema-experiences.json');
const movies=[...archive,...additions];
assert.equal(archive.length,36,'Archive catalog should stay at 36 while research expands');
assert.equal(additions.length,4,'Four vetted publisher leads should be separately tracked');
assert.equal(movies.length,40);
assert.equal(new Set(movies.map(m=>m.id)).size,40,'No duplicate YouTube IDs');
assert.equal(new Set(movies.map(m=>m.title.toLowerCase()+'|'+m.year)).size,40,'No duplicate film/title');
const allowed=new Set(editorial.experiences);
assert(allowed.has('Visual Spectacle')&&allowed.has('High-Stakes Drama')&&allowed.has('Laugh-Out-Loud'));
assert.equal(Object.keys(editorial.movies).length,40,'All titles must have editorial experience profiles');
for(const m of movies){
 assert.match(m.id,/^[A-Za-z0-9_-]{11}$/,'Invalid YouTube ID '+m.title);
 assert(m.title&&typeof m.title==='string','Missing title');
 assert(Number.isInteger(m.year)&&m.year>=1888&&m.year<=2026,'Invalid year '+m.title);
 assert(/^https:\/\//.test(m.source_url),'Missing source link '+m.title);
 assert.equal(m.embed_status,'requires_browser_test','Do not misrepresent YouTube playback verification');
 const metadata=editorial.movies[m.title];
 assert(metadata,'Missing experience mapping for '+m.title);
 assert(Array.isArray(metadata.genres)&&metadata.genres.length>0,'Missing genres '+m.title);
 assert(Array.isArray(metadata.experiences)&&metadata.experiences.length>0,'Missing experience labels '+m.title);
 assert(metadata.experiences.every(x=>allowed.has(x)),'Unknown experience '+m.title);
 for(const k of ['spectacle','story','entertainment'])assert(Number.isInteger(metadata.appeal[k])&&metadata.appeal[k]>=1&&metadata.appeal[k]<=5,'Bad subjective appetite value '+k+' '+m.title);
}
const check=read('research/feature-film-lead-checks.json');
assert.equal(check.summary.publisher_matches,9,'All 9 research leads should match uploader metadata');
for(const m of additions){
 const matched=check.results.find(x=>x.id===m.id);
 assert(matched&&matched.status==='publisher_matches','New addition must have independently checked source channel: '+m.title);
}
const research=read('rt-free-movies.json');
assert.equal(research.movies.length,100,'Preserve earlier research file');
console.log('PASS: syntax, source identity, 40 titles, 3-axis editorial classification, audience genres and independent publisher metadata.');
