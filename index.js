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


const asyncMiddleware = fn =>
    (req, res, next) => {
    Promise.resolve(fn(req, res, next))
        .catch(next);
    };



const isAllowedUrl = (string) => {
  try {
    const url = new URL(string);
    return url.hostname !== 'pptraas.com' && !url.hostname.startsWith('puppeteerexamples');
  } catch (err) {
    return false;
  }
};
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

// Init code that gets run before all request handlers.
app.use(express.static('shots'))

app.get('/r/:item', async (request, response) => {
  response.sendFile(__dirname + '/shots/'+request.params.item+'.html');
})
app.get('/s/:url', async (request, response) => {
  console.log('asking for short: ', request.params.url)
  const url = request.params.url;
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
  response.type('text').send(shortcode)
});

async function indexItem(key) {
  // Default to a reasonably large viewport for full page screenshots.

  var res = await queue.get(key)
  var result = JSON.parse(res)
  var url = decodeURIComponent(result.url)

  var browser = await puppeteer.launch({
    dumpio: true,
    // headless: false,
    // executablePath: 'google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // , '--disable-dev-shm-usage']
  });

  
  const viewport = {
    width: 375,
    height: 662,
    deviceScaleFactor: 2
  };

  let fullPage = false;
 

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(url, {waitUntil: 'networkidle0'});

    // const hashtag = await page.evaluate(() => document.querySelector('.namebox').innerContent);
    // const description = await page.evaluate(() => document.querySelector('.description').innerContent);

    const hashtag = '';
    const description = '';

    const opts = {
      fullPage,
      // omitBackground: true
    };

    if (!fullPage) {
      opts.clip = {
        x: 0,
        y: 90,
        width: 375,
        height: 375
      };
    }

    let buffer;

    buffer = await page.screenshot(opts);


    fs.writeFile('shots/'+key+'.png', buffer, function (err) {
      if (err) throw err;
    });

    var image = key+`.png`
    var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Swarm City `+hashtag+`</title>
      <meta name="description" content="`+description+`" />
      <meta http-equiv="refresh" content="2; URL=`+url+`">
      <meta property="og:title" content="Request for `+key+`">
      <meta property="og:image" content="/`+image+`">
      <meta property="og:description" content="`+description+`">
      <meta property="og:url" content="`+url+`">
      <meta name="twitter:card" content="/`+image+`">
    </head>
    <body><img src="/`+image+`" width="375" height="375"></body>
    </html>
  `
    fs.writeFile('shots/'+key+'.html', html, function (err) {
      if (err) throw err;
    });
    //response.type('image/png').send(buffer);
    //response.type('text').send(key)

    queue.del(key)
    console.log("Removed item ", key, " from list")

    db.put(shortcode, Date.now())
      //stream.destroy();
    //return true

  } catch (err) {
    //await queue.del(shortcode)
    //response.status(500).send(err.toString());
    console.log(err.toString())
  }

  await browser.close();
}

async function iterateQueue () {
  console.log('Going through queue')
  var stream = queue
  .createReadStream({
  keys: true,
  values: true
  })
  .on("data", asyncMiddleware(async item => {
      //var result = JSON.parse(item)
      //console.log(url)
      await indexItem(item.key)
      console.log("item:", item); 
      
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
}, 10 * 1000);
}

runShortService()