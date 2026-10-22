const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
async function run(){
  const browserPath=['/usr/bin/google-chrome','/opt/google/chrome/chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  if(!browserPath)throw new Error('No Chrome/Chromium executable available on CI runner');
  const browser=await chromium.launch({executablePath:browserPath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[];
  const page=await browser.newPage({viewport:{width:1400,height:900},serviceWorkers:'block'});
  page.on('pageerror',error=>errors.push(error.message));
  // Isolate website functional smoke tests from third-party image/video availability.
  await page.route(/i\.ytimg\.com/,route=>route.abort());
  await page.route(/youtube-nocookie\.com/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Simulated host player for UI tests</title>'}));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#libraryGrid .movie-card').length===36,{timeout:20000});
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),36,'All 36 direct ID movies should appear in grid');
  assert(await page.locator('#personalRail .movie-card').count()>=10,'Recommendations rail should populate');
  assert(await page.locator('#worldRail .movie-card').count()>=10,'Korean films rail should populate');
  assert.equal(await page.locator('#totalCount').innerText(),'36 of 36 titles');
  assert.equal(await page.locator('#heroTitle').innerText(),'Solaris','Rotating hero should open on a different film');
  assert(await page.locator('#heroDots button').count()>=5,'Featured carousel should have navigable slides');
  await page.locator('#heroDots button').nth(1).click();
  assert.equal(await page.locator('#heroTitle').innerText(),'The Diamond Arm','Hero carousel should change featured film');
  assert((await page.locator('#heroArtNext').getAttribute('style')).includes('MkHiu9fD820'),'Hero artwork must change with title');
  // Regression: the previous version paused indefinitely whenever the mouse
  // was anywhere over the banner, making the carousel appear static.
  await page.mouse.move(250,270);
  await page.waitForTimeout(7100);
  assert.equal(await page.locator('#heroTitle').innerText(),'The Cranes Are Flying','Hero must auto-rotate even with pointer over banner');

  const first=page.locator('#libraryGrid .movie-card').first();
  await first.locator('button.cover').click();
  assert(await page.locator('#playerDialog').evaluate(el=>el.open),'Clicking a movie must open modal');
  let iframe=page.locator('#videoWrap iframe');
  assert.equal(await iframe.count(),1,'One iframe at a time');
  const firstSrc=await iframe.getAttribute('src');
  assert(firstSrc.includes('/embed/')&&firstSrc.includes('autoplay=1')&&firstSrc.includes('controls=1'),'autoplay-on-click URL must contain supported player params');
  await page.locator('#closePlayer').click();
  assert.equal(await page.locator('#videoWrap iframe').count(),0,'Closing player must stop video by removing iframe');
  await page.locator('#libraryGrid .movie-card').nth(1).locator('button.cover').click();
  const secondSrc=await page.locator('#videoWrap iframe').getAttribute('src');
  assert.notEqual(firstSrc,secondSrc,'Opening a different film must load different video ID');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#videoWrap iframe').count(),0,'Esc must remove the iframe');
  await page.locator('#libraryGrid .movie-card').first().locator('button.mini-action').first().click();
  assert.equal(await page.locator('#listCount').innerText(),'(1)');
  await page.locator('#headerSaved').click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),1,'My List must only show saved movie');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#libraryGrid .movie-card').length===36,{timeout:15000});
  assert.equal(await page.locator('#listCount').innerText(),'(1)','Saved film should survive reload');
  await page.locator('#chips button').filter({hasText:'Comedy'}).click();
  assert(await page.locator('#libraryGrid .movie-card').count()>0,'Comedy filter must find movies');
  await page.locator('#search').fill('Come and See');
  // Search + comedy filter combined should not match.
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),0,'Filters and search must both apply');
  await page.locator('#chips button').filter({hasText:'All'}).click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),1,'Search should narrow to one film');
  await page.locator('#search').fill('');
  await page.locator('#openAdd').click();
  await page.locator('#addUrl').fill('https://www.youtube.com/watch?v=AAAAAAAAAAA');
  await page.locator('#addTitle').fill('Browser test fixture');
  await page.locator('#addYear').fill('1999');
  await page.locator('#addForm button[type=submit]').click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),37,'Add film form must update movie grid');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#heroPlay').click();
  assert.equal(await page.locator('#videoWrap iframe').count(),1,'Mobile must open the movie player');
  await page.locator('#closePlayer').click();
  const widths=await page.evaluate(()=>({viewport:window.innerWidth,body:document.body.scrollWidth}));
  assert(widths.body<=widths.viewport+5,'No unintended horizontal body overflow on mobile: '+JSON.stringify(widths));
  assert.deepEqual(errors,[],'Uncaught browser JavaScript errors');
  await browser.close();
  console.log('PASS: 36 cards, rows, My List persistence, filters, search, add film, responsive mobile, autoplay iframe and clean player teardown.');
}
run().catch(e=>{console.error(e);process.exit(1)});
