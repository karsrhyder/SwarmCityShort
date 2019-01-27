const express = require('express')
const shortid = require('shortid')
const fs = require('fs')
const level = require('level')
const renderQueue = level('./queue')
const PORT = process.env.PORT || 8080
const app = express();
const cors = require('cors')
const browserPagePool = require('./browserPagePool.js')
const Cache = require('async-disk-cache')
const shortCache = new Cache('shortCache')
//shortCache.clear();
/** EXPRESS */
/** Set the port */
app.listen(PORT, function() {
    console.log(`App is listening on port ${PORT}`);
});

/** Open up the /shots directory so the html page can use it */
app.use(express.static('shots'))

/** Origin = everybody! */
app.use(cors({
    origin: '*'
}));

/** Resolve the shortlink to the html page on disk */
app.get('/r/:item', async (request, response) => {
    console.log(`/r/ item `, request.params.item);
    const short = request.params.item
    response.sendFile(__dirname + '/shots/'+short+'.html', function(err, res){
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
    shortCache.get(url).then((cacheEntry) => {
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
    shortCache.get(short).then(function(cacheEntry) {
        if (cacheEntry.isCached) {
            console.log(`shortCache: is cached `, short);
            const shortLink = 'https://i.swarm.city/r/' + cacheEntry.value
            return shortLink
        } else {
            console.log(`shortCache: is err `, short);
            return 'error'
        }
    })
}



/** Partial functionality */
/** createShareableLink(url, short) */
async function createShareableLink(url, short) {
    await removeFromRenderCache(url)
    // strip url only get after /detail/hashtag/itemhash
    var pathname = new URL(url).pathname;
    console.log('pathname: ', pathname)
    var arraypath = await pathname.split("/");
    console.log(arraypath);
    var newURL = 'https://agitated-brown-a9878f.netlify.com/' + arraypath[2] + '/' + arraypath[3];
    console.log(arraypath[0],arraypath[1],arraypath[2]);
    //console.log()
    console.log(`createShareableLink `, url, short);
    const page = await browserPagePool.acquire();

    const viewport = {
      width: 662,
      height: 675,
      deviceScaleFactor: 2
    };
  
    await page.setViewport(viewport);
    await page.goto(newURL);
    await page.evaluateHandle(`document.querySelector('.hashtagName')`);
    await page.waitForFunction(`document.querySelector('.hashtagName').innerHTML !== '#unknown'`);
    await createImage(page, short)
    await createPage(page, short, url)
    await shortCache.set (url, short)
    return true
} 

/** createImage(element) */
async function createImage(page, short) {
    //console.log(`createImage `, page, short);
    const isolatedCardHandle = await page.evaluateHandle(`document.querySelector('.App')`);
    //const closebox = await isolatedCardHandle.$eval(`.closebox`, e => e.children[0].hidden = true);
    //const linkbox = await isolatedCardHandle.$eval(`.linkbox`, e => e.children[1].hidden = true);
    const isolatedCardBuffer = await isolatedCardHandle.screenshot()
    fs.writeFile('shots/'+short+'.png', isolatedCardBuffer, function (err) {
        if (err) throw err;
    });
    return true 
}

/** createPage(element, short) */
async function createPage(page, short, url) {
    //console.log(`createPage `, page, short);
    const descriptionHandle = await page.evaluateHandle(`document.querySelector('.description')`);
    const descriptionElement = await (await descriptionHandle.getProperty('textContent'));
    var description = descriptionElement._remoteObject.value
    description = description.replace(/\s+/g,' ').trim() // results in 'white space'

    const hashtagHandle = await page.evaluateHandle(`document.querySelector('.hashtagName')`);
    const hashtagElement = await (await hashtagHandle.getProperty('textContent'));
    var hashtag = hashtagElement._remoteObject.value
    hashtag = hashtag.replace(/\s+/g,' ').trim() // results in 'white space'

    const swtHandle = await page.evaluateHandle(`document.querySelector('.value')`);
    const swtElement = await (await swtHandle.getProperty('textContent'));
    var swt = swtElement._remoteObject.value

    var prettyDescription = 'Reply to this request for ' + swt + ' SWT, posted on hashtag ' + hashtag;
    var prettyTitle = hashtag + ': ' + description + ' for ' +swt+ ' SWT';

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
        <meta name="twitter:image" content="https://i.swarm.city/shots/`+image+`"/>


        <meta property="og:title" content="`+prettyTitle+`">
        <meta property="og:description" content="`+prettyDescription+`"/>
        <meta property="og:url" content="https://i.swarm.city/r/`+short+`"/>
        <meta property="og:image" content="https://i.swarm.city/shots/`+image+`"/>

        <meta property="og:type" content="article"/>
        <meta property="og:site_name" content="Swarm.city"/>

        <meta name="description" content="`+prettyDescription+`" />
        <meta http-equiv="refresh" content="0; URL=`+url+`">

    </head>
    <body>
    <img src="https://i.swarm.city/shots/`+image+`" width="1" height="1">
    </body>
    </html>
  `
    fs.writeFile('shots/'+short+'.html', html, function (err) {
      if (err) throw err;
    });
}
/** iterateRenderQueue() */
async function iterateRenderQueue() {
    renderQueue.createReadStream({
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
    await renderQueue.del(url)
    return true
}

/** addToRenderCache(url, short) */
async function addToRenderCache(url, short) {
    await renderQueue.put(url, short)
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