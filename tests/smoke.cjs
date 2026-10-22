const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');

async function run(){
  const chrome=['/usr/bin/google-chrome','/opt/google/chrome/chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  if(!chrome)throw Error('Chrome or Chromium missing on test runner');
  const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1400,height:900},serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error'&&!/ERR_FAILED|youtube|image/i.test(msg.text()))console.log('BROWSER:',msg.text())});
  // These tests verify our UI, not third-party streaming. The embedded player is mocked.
  await page.route(/i\.ytimg\.com/,route=>route.abort());
  await page.route(/youtube-nocookie\.com/,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Simulated YouTube iframe</title>'}));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#libraryGrid .movie-card').length>=40,null,{timeout:20000});
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),40,'40 licensed publisher-upload film links should populate');
  assert.equal(await page.locator('#totalCount').innerText(),'40 of 40 titles');
  for(const rail of ['personalRail','editorsRail','spectacleRail','dramaRail','funRail','worldRail']){
    assert(await page.locator('#'+rail+' .movie-card').count()>0,'Missing curated row '+rail);
  }
  assert.equal(await page.locator('#heroTitle').innerText(),'Khumba','Featured film must start with a vibrant animation');
  assert.equal(await page.locator('#heroDots button').count(),7);
  await page.locator('#heroDots button').nth(1).click();
  assert.equal(await page.locator('#heroTitle').innerText(),'American Hero');
  assert((await page.locator('#heroArtNext').getAttribute('style')).includes('B_-1AYf3CLU'),'Featured art must change');
  // Regression: pointer over the hero or a slide click must not freeze rotation.
  await page.mouse.move(240,270);
  await page.waitForTimeout(6800);
  assert.equal(await page.locator('#heroTitle').innerText(),'White Tiger','Carousel should auto-advance after 6.5 seconds');
  await page.locator('#heroPause').click();
  assert.equal(await page.locator('#heroPause').getAttribute('aria-pressed'),'true');
  const pausedTitle=await page.locator('#heroTitle').innerText();
  await page.waitForTimeout(6700);
  assert.equal(await page.locator('#heroTitle').innerText(),pausedTitle,'Manual Pause must freeze hero');
  await page.locator('#heroPause').click();
  assert.equal(await page.locator('#heroPause').getAttribute('aria-pressed'),'false');

  // Genre and experience are independent filter dimensions.
  await page.locator('#chips button').filter({hasText:/^Sci-Fi$/}).click();
  assert(await page.locator('#libraryGrid .movie-card').count()>=3,'Sci-Fi filter should include cross-genre films');
  await page.locator('#experienceChips button').filter({hasText:/^Mind-Bending$/}).click();
  const filteredCount=await page.locator('#libraryGrid .movie-card').count();
  assert(filteredCount>0&&filteredCount<10,'Sci-Fi + Mind-Bending should have a focused intersection');
  await page.locator('#experienceChips button').filter({hasText:/^All experiences$/}).click();
  await page.locator('#chips button').filter({hasText:/^All$/}).click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),40);

  await page.locator('#focusChoices button').filter({hasText:'Visual spectacle'}).click();
  assert.equal(await page.locator('#focusChoices button').filter({hasText:'Visual spectacle'}).getAttribute('aria-pressed'),'true');
  await page.locator('#mood-hub .mood-tile[data-experience="High-Stakes Drama"]').click();
  assert(await page.locator('#libraryGrid .movie-card').count()>=5,'Mood card should open filtered movies');
  assert.equal(await page.locator('#experienceChips button').filter({hasText:/^High-Stakes Drama$/}).getAttribute('aria-pressed'),'true');
  await page.locator('#chips button').filter({hasText:/^All$/}).click();
  await page.locator('#experienceChips button').filter({hasText:/^All experiences$/}).click();

  await page.locator('#search').fill('Khumba');
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),1);
  await page.locator('#search').fill('');

  const first=page.locator('#libraryGrid .movie-card').first();
  await first.locator('button.cover').click();
  assert(await page.locator('#playerDialog').evaluate(el=>el.open),'Movie poster must open player');
  let iframe=page.locator('#videoWrap iframe');
  assert.equal(await iframe.count(),1);
  const firstSrc=await iframe.getAttribute('src');
  assert(firstSrc.includes('/embed/')&&firstSrc.includes('autoplay=1'),'Click must request embedded autoplay');
  await page.locator('#closePlayer').click();
  assert.equal(await page.locator('#videoWrap iframe').count(),0,'Close must destroy iframe and stop playback');
  await page.locator('#libraryGrid .movie-card').nth(1).locator('button.cover').click();
  const secondSrc=await page.locator('#videoWrap iframe').getAttribute('src');
  assert.notEqual(firstSrc,secondSrc,'Different movie loads different video');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#videoWrap iframe').count(),0,'Escape must stop the iframe');

  await page.locator('#libraryGrid .movie-card').first().locator('button.mini-action').first().click();
  assert.equal(await page.locator('#listCount').innerText(),'(1)');
  await page.locator('#headerSaved').click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),1,'My List filters saved titles');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#libraryGrid .movie-card').length===40,null,{timeout:20000});
  assert.equal(await page.locator('#listCount').innerText(),'(1)','Saved titles persist on reload');
  assert.equal(await page.locator('#focusChoices button').filter({hasText:'Visual spectacle'}).getAttribute('aria-pressed'),'true','Viewing preference persists');

  await page.locator('#openAdd').click();
  await page.locator('#addUrl').fill('https://www.youtube.com/watch?v=AAAAAAAAAAA');
  await page.locator('#addTitle').fill('Browser test fixture');
  await page.locator('#addYear').fill('1999');
  await page.locator('#addForm button[type=submit]').click();
  assert.equal(await page.locator('#libraryGrid .movie-card').count(),41,'Add film action should work');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#heroPlay').click();
  assert.equal(await page.locator('#videoWrap iframe').count(),1,'Mobile playback modal must work');
  await page.locator('#closePlayer').click();
  const widths=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));
  assert(widths.body<=widths.viewport+5,'Mobile horizontal overflow: '+JSON.stringify(widths));
  assert.deepEqual(errors,[],'No uncaught browser JavaScript errors');
  await browser.close();
  console.log('PASS: 40 source-linked films, genre + experience filters, three-axis taste choice, six rails, rotating hero, pause, persistent favorites, playback-modal, mobile.');
}
run().catch(e=>{console.error(e);process.exit(1)});
