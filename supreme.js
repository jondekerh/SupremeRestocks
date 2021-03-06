var Twitter = require('twitter');
const rp = require('request-promise');
const cheerio = require('cheerio');
const _ = require('underscore');
const fs = require('fs');
const request = require('request');
const SlackWebhook = require('slack-webhook')
const discord = require('discord.js');

var originalSoldOutItems = [];
var newSoldOutItems = []
const proxyList = [];
const userAgentList = [];
var restockCycles = 0;//do not change
var refreshDelay = 10000//check every 5 mins

var thisProxy = null;

//uncomment for slack configuration
// const slackWebhookURL = ''
// const slack = new SlackWebhook(slackWebhookURL, {
//   defaults: {
//     username: 'Bot',
//     channel: '#supreme-restocks',
//     icon_emoji: ':robot_face:'
//   }
// })

//uncomment if you need discord
const hook = new discord.WebhookClient("522549535029985282", "qAxPDHiZESquoj0F7YqaHAuu7QYDBQexPbORsgHUP2SVo5APP6_URDTPCvxfY7g3KjZ4");


//uncomment if you need twitter
// var client = new Twitter({
//   consumer_key: '',
//   consumer_secret: '',
//   access_token_key: '',
//   access_token_secret: ''
// });

//Uncomment if you need slack or discord or twitter output
//slack.send('Now monitoring for restocks.')
hook.send('Now monitoring for restocks.');
// client.post('statuses/update', {status: 'Now monitoring for restocks.'}, function(error, tweet, response) {
//   if (!error) {
//     console.log(tweet);
//   }
// });

console.log('Now monitoring for restocks.');

function initialize(){
  const proxyInput = fs.readFileSync('proxies.txt').toString().split('\n');
  for (let p = 0; p < proxyInput.length; p++) {
      proxyInput[p] = proxyInput[p].replace('\r', '').replace('\n', '');
      if (proxyInput[p] != '')
          proxyList.push(proxyInput[p]);
  }
  const userAgentInput = fs.readFileSync('useragents.txt').toString().split('\n');
  for (let u = 0; u < userAgentInput.length; u++) {
      userAgentInput[u] = userAgentInput[u].replace('\r', '').replace('\n', '');
      if (userAgentInput[u] != '')
          userAgentList.push(userAgentInput[u]);
  }
  console.log('Found ' + proxyList.length + ' Proxies.');
  console.log('Found ' + userAgentList.length + ' User Agents.');
  scrape(originalSoldOutItems);
}

function scrape(arr) {

  //set thisProxy equal to the proxy we'll be using for this request and the discord one
  thisProxy = formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)]);

  request({
      url: 'https://www.supremenewyork.com/shop/all',
      headers: generateRandomUserAgent(),
      timeout:20000,
      proxy: thisProxy
  }, function(error, response, html) {

      if (response && response.statusCode != 200) {
          console.log('Cannot make the Request, response = ' + response.statusCode);
          scrape(newSoldOutItems);
          return;
      }

      if(!html){
        console.log('Did not get response, this is most likely a bad proxy. Trying again...');
        scrape(newSoldOutItems);
        return;
      }

      var $ = cheerio.load(html);

      $('.inner-article').each(function(i, elm) {
          if (elm.children[0].children[1] != undefined) {
              arr.push(elm.children[0].attribs['href']);
          }
      }); //end of loop jQuery function
      if (restockCycles != 0) {
        console.log(newSoldOutItems.length, originalSoldOutItems.length);
          if (newSoldOutItems.length < originalSoldOutItems.length) {
              console.log('RESTOCK OCCURED!!!');
              var restockedItems = findArrayDifferences(originalSoldOutItems, newSoldOutItems);
              console.log(restockedItems)
              //postToSlack(restockedItems)
              postToDiscord(restockedItems)
              //postToTwitter(restockedItems)
              originalSoldOutItems = newSoldOutItems; //reset the variable
          }

          if(newSoldOutItems.length > originalSoldOutItems.length){ // more items sold out
            originalSoldOutItems = newSoldOutItems; //reset the variable
          }
      }
      restockCycles++;
      console.log('Completed Restock Cycle #' + restockCycles + '\n');
      setTimeout(function() {
          newSoldOutItems = [];
          scrape(newSoldOutItems)
      }, refreshDelay)

  }); //end of request call
}

function findArrayDifferences(arr1, arr2) {
    return _.difference(arr1, arr2)
}

function formatProxy(proxy) {
    if (proxy && ['localhost', ''].indexOf(proxy) < 0) {
        proxy = proxy.replace(' ', '_');
        const proxySplit = proxy.split(':');
        if (proxySplit.length > 3)
            return "http://" + proxySplit[2] + ":" + proxySplit[3] + "@" + proxySplit[0] + ":" + proxySplit[1];
        else
            return "http://" + proxySplit[0] + ":" + proxySplit[1];
    } else
        return undefined;
}

function generateRandomUserAgent(){
  var userAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
  return {'User-Agent': userAgent}
}

function postToSlack(restockedItems){
  for (let i = 0; i < restockedItems.length; i++) {
    slack.send('http://www.supremenewyork.com' + restockedItems[i])
  }
}

function postToDiscord(restockedItems){
  for (let i = 0; i < restockedItems.length; i++) {
    request({
        url: 'http://www.supremenewyork.com' + restockedItems[i],
        headers: generateRandomUserAgent(),
        timeout:20000,
        proxy: thisProxy
    }, function(error, response, html) {

        var itemHTML = cheerio.load(html);

        itemHTML('#container').each(function(i, elm) {
            hook.send({
              embeds: [{
                color: 16723502,
                thumbnail: {url: 'https:' + elm.children[1].children[0].children[0].attribs['src']},
                title: 'SUPREME RESTOCK',
                fields: [
                  {
                    name: 'Item:',
                    value: itemHTML('.protect').not('.style').text()
                  },
                  {
                    name: 'Color:',
                    value: itemHTML('p, .style').eq(0).text()
                  },
                  {
                    name: 'Price:',
                    value: itemHTML('.price').text()
                  },
                  {
                    name: 'Link:',
                    value: 'http://www.supremenewyork.com' + restockedItems[i]
                  }
                ]
              }]
            })//end of discord embed
        })
    })//end of request call
  }
}

function postToTwitter(restockedItems){
   for (let i = 0; i < restockedItems.length; i++) {
      client.post('statuses/update', {status: 'http://www.supremenewyork.com' + restockedItems[i]}, function(error, tweet, response) {
    });
  }
}


initialize()
