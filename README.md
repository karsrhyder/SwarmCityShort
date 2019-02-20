# SwarmCityShortShare

This API / webserver generates and serves shortcodes for social media sharing

## Generate short link

To generate a short link, the front end has to do a POST request to "/" with json data:

```js
{
  title: `${hashtagName}: ${itemDescription} for ${swtAmount} SWT`,
  description: `Reply to this request for ${swtAmount} SWT, posted on hashtag ${hashtagName}`,
  redirectUrl: `https://swarm.city/detail/${hashtagAddress}/${itemHash}`,
}
```

The API will reply with json:

```js
{
  id: "da49j0uB4umlgHSLf7n9";
}
```

## Query short link

Just do a regular GET request to the url ${host}/${id}, i.e. i.swarm.city/da49j0uB4umlgHSLf7n9
It will return an HTML with meta tags to be properly displayed in social media
The HTML will trigger an immediate redirect to \${redirectUrl} via the http-equiv="refresh" mechanism
