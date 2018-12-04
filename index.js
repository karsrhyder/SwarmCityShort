const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const {URL} = require('url');
const level = require('level')
const db = level('./db')
const queue = level('./queue')
const shortid = require('shortid');
const PORT = process.env.PORT || 8080;
const app = express();
const cors = require('cors')
const browserPagePool = require('./services/browserPagePool.js');
const RENDER_CACHE = new Map();

const asyncMiddleware = fn =>
    (req, res, next) => {
    Promise.resolve(fn(req, res, next))
        .catch(next);
    };

async function screenShot(url) {
    const page = await browserPagePool.acquire();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    const screenshot = await page.screenshot();
    await browserPagePool.release(page);
    return screenshot;
}

// Adds cors, records analytics hit, and prevents self-calling loops.
// app.use((request, response, next) => {
//   const url = request.query.url;
//   if (url && !isAllowedUrl(url)) {
//     return response.status(500).send({
//       error: 'URL is either invalid or not allowed'
//     });
//   }

//   response.set('Access-Control-Allow-Origin', '*');

//   // Record GA hit.
//   const visitor = ua(GA_ACCOUNT, {https: true});
//   visitor.pageview(request.originalUrl).send();

//   next();
// });

app.use(cors({
    origin: '*'
  }));


// Init code that gets run before all request handlers.
app.use(express.static('shots'))

app.get('/r/:item', async (request, response) => {
  response.sendFile(__dirname + '/shots/'+request.params.item+'.html', function(err, res){
    if(err) {
      response.status(404).send('Not found (yet)');
    }
  })
   

})

app.get('/s/:url', async (request, response) => {
  console.log('asking for short: ', request.params.url)
  const url = request.params.url;
  if (RENDER_CACHE.has(url)) {
    console.log('serving from cache')
    return response.type('text').send('https://i.swarm.city/r/'+RENDER_CACHE.get(url))
  }
  if (!url) {
    return response.status(400).send(
      'Please provide a URL. Example: ?url=https://example.com');
  }
  var shortcode = shortid.generate()
  var data = {
    url: url, 
    short: shortcode,
    time: Date.now()
  }
  var res = await queue.put(shortcode, JSON.stringify(data))
  console.log('sending to queue')
  response.type('text').send('https://i.swarm.city/r/'+shortcode)
});

async function indexItem(url, key) {
  // Default to a reasonably large viewport for full page screenshots.

 console.log(Date.now(), 'Fetching', key, url)
  

  let fullPage = false;

  try {

    
    
    const page = await browserPagePool.acquire();

    const viewport = {
      width: 375,
      height: 662,
      deviceScaleFactor: 2
    };
  

    await page.setViewport(viewport);

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  
    let buffer;

    const descriptionHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-detail').shadowRoot.querySelector('detail-simpledeal').shadowRoot.querySelector('div > div > detail-simpledeal-main').shadowRoot.querySelector('div > div.description')`);
    const descriptionElement = await (await descriptionHandle.getProperty('textContent'));
    var description = descriptionElement._remoteObject.value
    description = description.replace(/\s+/g,' ').trim() // results in 'white space'

    const hashtagHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-detail').shadowRoot.querySelector('display-simpledeal-title').shadowRoot.querySelector('div > div.namebox')`);
    const hashtagElement = await (await hashtagHandle.getProperty('textContent'));
    var hashtag = hashtagElement._remoteObject.value
    hashtag = hashtag.replace(/\s+/g,' ').trim() // results in 'white space'

    const swtHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-detail').shadowRoot.querySelector('detail-simpledeal').shadowRoot.querySelector('div > div > detail-simpledeal-main').shadowRoot.querySelector('div > div.seeker > div.pricebox > div.value')`);
    const swtElement = await (await swtHandle.getProperty('textContent'));
    var swt = swtElement._remoteObject.value

    var prettyDescription = 'Reply to this request for ' + swt + ' SWT, posted on hashtag ' + hashtag;
    var prettyTitle = hashtag + ': ' + description + ' for ' +swt+ ' SWT';

    var image = key+`.png`
    
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
        <meta name="twitter:image" content="https://i.swarm.city/`+image+`"/>


        <meta property="og:title" content="`+prettyTitle+`">
        <meta property="og:description" content="`+prettyDescription+`"/>
        <meta property="og:url" content="https://i.swarm.city/r/`+key+`"/>
        <meta property="og:image" content="https://i.swarm.city/`+image+`"/>

        <meta property="og:type" content="article"/>
        <meta property="og:site_name" content="Swarm.city"/>

        <meta name="description" content="`+prettyDescription+`" />
        <meta http-equiv="refresh" content="0; URL=`+url+`">

    </head>
    <body>
    <img src="https://i.swarm.city/`+image+`" width="1" height="1">
    </body>
    </html>
  `
    fs.writeFile('shots/'+key+'.html', html, function (err) {
      if (err) throw err;
    });

    const isolatedCardHandle = await page.evaluateHandle(`document.querySelector('body > swarm-city').shadowRoot.querySelector('iron-pages > page-detail').shadowRoot.querySelector('detail-simpledeal').shadowRoot.querySelector('div > div > detail-simpledeal-main').shadowRoot.querySelector('div')`);

    const closebox = await isolatedCardHandle.$eval(`.closebox`, e => e.children[0].hidden = true);
    const linkbox = await isolatedCardHandle.$eval(`.linkbox`, e => e.children[1].hidden = true);

    const isolatedCardBuffer = await isolatedCardHandle.screenshot()

    fs.writeFile('shots/'+key+'.png', isolatedCardBuffer, function (err) {
        if (err) throw err;
      });

  
    //response.type('image/png').send(buffer);
    //response.type('text').send(key)


    queue.del(key)
    console.log("Removed item ", key, " from list")
    RENDER_CACHE.set(encodeURIComponent(url), shortcode); 

    db.put(key, Date.now())
      //stream.destroy();
    //return true

  } catch (err) {
    //await queue.del(shortcode)
    //response.status(500).send(err.toString());
    
    console.log(err.toString())
  }

  //await browser.close();
}

async function iterateQueue () {
  console.log(Date.now(), ' Going through queue')
  var stream = queue
  .createReadStream({
  keys: true,
  values: true
  })
  .on("data", asyncMiddleware(async item => {
      //var result = JSON.parse(item)
      //console.log(url)
      var res = await queue.get(item.key)
      var result = JSON.parse(res)
      var url = decodeURIComponent(result.url)
      queue.del(item.key)
      console.log("Removed item ", item.key, " from list")
      await indexItem(url, item.key)
  }))
}




app.listen(PORT, function() {
  console.log(`App is listening on port ${PORT}`);
});

// Make sure node server process stops if we get a terminating signal.
function processTerminator(sig) {
  if (typeof sig === 'string') {
    process.exit(1);
  }
  console.log('%s: Node server stopped.', Date(Date.now()));
}

const signals = [
  'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
  'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'];
signals.forEach(sig => {
  process.once(sig, () => processTerminator(sig));
});


async function runShortService() {
  console.log("Swarm City Short Service")

  

 

  // queue monitor
setInterval(() => {

  iterateQueue();
}, 1000);
}

runShortService()



