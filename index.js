'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const apiai = require('apiai')

const VERIFY_TOKEN = process.env.VERIFY_TOKEN


const apiaiApp = apiai(process.env.APIAI_TOKEN);

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
	res.send('Hello world, I am a chat bot')
})


// Spin up the server
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})

/* Handling all messenges */
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message && event.message.text) {
          receivedMessage(event);
        }
      });
    });
    res.status(200).end();
  }
});


// get messages from apia 
function receivedMessage(event) {
  let sender = event.sender.id;
  let text = event.message.text;

  let apiai = apiaiApp.textRequest(text, {
    sessionId: 'tabby_cat'
  });

  apiai.on('response', (response) => {
    let aiText = response.result.fulfillment.speech;
    console.log(aiText);

    switch (aiText) {
      case 'SHOW_BIOGRAPHY':
        prepareSendBio(sender);
        break;

      default:
        prepareSendAiMessage(sender, aiText);
    }

  });

  apiai.on('error', (error) => {
    console.log(error);
  });

  apiai.end();
}

function sendMessage(messageData) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
    method: 'POST',
    json: messageData
  }, (error, response) => {
    if (error) {
        console.log('Error sending message: ', error);
    } else if (response.body.error) {
        console.log('Error: ', response.body.error);
    }
  });
}

function prepareSendAiMessage(sender, aiText) {
  let messageData = {
    recipient: {id: sender},
    message: {text: aiText}
  };
  sendMessage(messageData);
}

function prepareSendBio(sender) {
  let messageData = {
    recipient: {
      id: sender
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: 'Twitter',
            subtitle: '@girlie_mac',
            item_url: 'https://www.twitter.com/girlie_mac',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-twitter.png',
            buttons: [{
              type: 'web_url',
              url: 'https://www.twitter.com/girlie_mac',
              title: 'View Twitter Bio'
            }],
          }, {
            title: 'Work History',
            subtitle: 'Tomomi\'s LinkedIn',
            item_url: 'https://www.linkedin.com/in/tomomi',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-linkedin.png',
            buttons: [{
              type: 'web_url',
              url: 'https://www.linkedin.com/in/tomomi',
              title: 'View LinkedIn'
            }]
          }, {
            title: 'GitHub Repo',
            subtitle: 'girliemac',
            item_url: 'https://github.com/girliemac',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-github.png',
            buttons: [{
              type: 'web_url',
              url: 'https://github.com/girliemac',
              title: 'View GitHub Repo'
            }]
          }]
        }
      }
    }
  };
  sendMessage(messageData);
}


/* Webhook for API.ai to get response from the 3rd party API */
app.post('/ai', (req, res) => {
  console.log('*** Webhook for api.ai query ***');
  console.log(req.body.result);

  if (req.body.result.action === 'movies') {
    console.log('*** movies ***');
    let movie = req.body.result.parameters['movie-title'];
    let restUrl = 'http://www.omdbapi.com/?t='+movie+'&apikey='+process.env.API_KEY;

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200) {
        let json = JSON.parse(body);
        console.log(json);
        let msg = json.Title + 'is directed by' + json.Director + 'shot in year ' +json.Year+ ', Released in ' +json.Released
        return res.json({
          speech: msg,
          displayText: msg,
          source: 'movies'
        });
      } else {
        let errorMessage = 'No movie with this title in our database.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    })
  }

});