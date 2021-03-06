const express = require('express')
const shortid = require('shortid')
const fs = require('fs')
const level = require('level')
const renderQ = level('./hashtagRenderQ')
const PORT = process.env.PORT || 8090
const app = express();
const cors = require('cors')
const browserPagePool = require('./services/browserPagePool.js')
const Cache = require('async-disk-cache')
const hashtagCache = new Cache('hashtagCache')
hashtagCache.clear()
/** EXPRESS */
/** Set the port */
app.listen(PORT, function() {
    console.log(`App is listening on port ${PORT}`);
});

/** Open up the /shots directory so the html page can use it */
app.use(express.static('hashtags'))

/** Origin = everybody! */
app.use(cors({
    origin: '*'
}));

/** Resolve the shortlink to the html page on disk */
app.get('/r/:item', async (request, response) => {
    console.log(`/r/ item `, request.params.item);
    const short = request.params.item
    response.sendFile(__dirname + '/hashtags/'+short+'.html', function(err, res){
        if(err) {
          response.status(404).send('Not found (yet)');
        }
    })
})

/** Request a shareable url for an item */
app.get('/s/:url', async (request, response) => {
    console.log(`/s/ url `, request.params.url);
    const url = decodeURIComponent(request.params.url)
    requestShareableLink(url, function(shareableLink) {
        console.log(shareableLink)
        response.type('text').send(shareableLink)
    })
})

/** Main functionality */
/** requestShareableLink(url, short) */
async function requestShareableLink(url, cb) {
    console.log(`requestShareableLink `, url);
    hashtagCache.get(url).then((cacheEntry) => {
        if (cacheEntry.isCached) {
            console.log(`requestShareableLink found in cache `, url);
            const shareableLink = 'https://i.swarm.city/r/' + cacheEntry.value
            cb(shareableLink)
        } else {
            console.log(`requestShareableLink not in cache `, url);
            const short = shortid.generate()
            addToRenderCache(url, short)
            const shareableLink = 'https://i.swarm.city/r/' + short
            cb(shareableLink)
        }
    })
}
        
/** resolveShareableLink(url) */
async function resolveShareableLink(short) {
    console.log(`resolveShareableLink `, short);
    hashtagCache.get(short).then(function(cacheEntry) {
        if (cacheEntry.isCached) {
            console.log(`hashtagCache: is cached `, short);
            const shortLink = 'https://i.swarm.city/r/' + cacheEntry.value
            return shortLink
        } else {
            console.log(`hashtagCache: is err `, short);
            return 'error'
        }
    })
}

/** Partial functionality */
/** createShareableLink(url, short) */
async function createShareableLink(url, short) {
    await removeFromRenderCache(url)
    console.log(`createShareableLink `, url, short);
    const page = await browserPagePool.acquire();

    const viewport = {
      width: 375,
      height: 662,
      deviceScaleFactor: 2
    };
  
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await createImage(page, short)
    await createPage(page, short, url)
    await hashtagCache.set(url, short)
    return true
} 

/** createImage(element) */
async function createImage(page, short) {
    console.log(`createImage `, page, short);

    // click 
    // document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#infolink')
    const infoButton = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#infolink')`);

    await infoButton.click()
    
    const isolatedCardHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#about')`);
    //const closebox = await isolatedCardHandle.$eval(`.arrowup-icon`, e => e.children[0].hidden = true);
    //const linkbox = await isolatedCardHandle.$eval(`.linkbox`, e => e.children[1].hidden = true);
    const isolatedCardBuffer = await isolatedCardHandle.screenshot()
    fs.writeFile('hashtags/'+short+'.png', isolatedCardBuffer, function (err) {
        if (err) throw err;
    });
    return true 
}

/** createPage(element, short) */
async function createPage(page, short, url) {
    console.log(`createPage `, page, short);
    const descriptionHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#about').shadowRoot.querySelector('div > div:nth-child(1) > div.content')`);
    const descriptionElement = await (await descriptionHandle.getProperty('textContent'));
    var description = descriptionElement._remoteObject.value
    description = description.replace(/\s+/g,' ').trim() // results in 'white space'

    const hashtagHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#about').shadowRoot.querySelector('div > div:nth-child(1) > div.title')`);
    const hashtagElement = await (await hashtagHandle.getProperty('textContent'));
    var hashtag = hashtagElement._remoteObject.value
    hashtag = hashtag.replace(/\s+/g,' ').trim() // results in 'white space'

    const swtHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-hashtag').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('#about').shadowRoot.querySelector('div > div:nth-child(2) > div.content')`);
    const swtElement = await (await swtHandle.getProperty('textContent'));
    var swt = swtElement._remoteObject.value

    var prettyDescription = description;
    var prettyTitle = hashtag;

    var image = short+`.png`
    
    var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>`+prettyTitle+`</title>

      <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta http-equiv="Pragma" content="no-cache" />
      <meta http-equiv="Expires" content="0" />

        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:description" content="`+prettyDescription+`"/>
        <meta name="twitter:title" content="`+prettyTitle+`"/>
        <meta name="twitter:widgets:csp" content="on"/>
        <meta name="twitter:site" content="@SwarmCityDapp"/>
        <meta name="twitter:image" content="https://i.swarm.city/hashtags/`+image+`"/>


        <meta property="og:title" content="`+prettyTitle+`">
        <meta property="og:description" content="`+prettyDescription+`"/>
        <meta property="og:url" content="https://i.swarm.city/r/`+short+`"/>
        <meta property="og:image" content="https://i.swarm.city/hashtags/`+image+`"/>

        <meta property="og:type" content="article"/>
        <meta property="og:site_name" content="Swarm.city"/>

        <meta name="description" content="`+prettyDescription+`" />
        <meta http-equiv="refresh" content="0; URL=`+url+`">

    </head>
    <body>
    <img src="https://i.swarm.city/hashtags/`+image+`" width="1" height="1">
    </body>
    </html>
  `
    fs.writeFile('hashtags/'+short+'.html', html, function (err) {
      if (err) throw err;
    });
}
/** iteraterenderQ() */
async function iterateRenderQueue() {
    renderQ.createReadStream({
        keys: true,
        values: true
    })
    .on("data", asyncMiddleware(async item => {
        await createShareableLink(item.key, item.value)
        return true
    }))
}

/** removeFromRenderCache(url) */
async function removeFromRenderCache(url) {
    await renderQ.del(url)
    return true
}

/** addToRenderCache(url, short) */
async function addToRenderCache(url, short) {
    await renderQ.put(url, short)
    return true
}

/** HELPERS */
const asyncMiddleware = fn =>
    (req, res, next) => {
    Promise.resolve(fn(req, res, next))
        .catch(next);
    };

/** HEARTBEAT */
async function runShareableLinkService() {
    setInterval(() => {
        iterateRenderQueue();
    }, 2000);
}

/** START */
runShareableLinkService()