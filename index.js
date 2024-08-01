/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

*/

// Define our dependencies
const util         = require('util');
var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var handlebars     = require('handlebars');
const res          = require('express/lib/response');
var dotenvx        = require('@dotenvx/dotenvx');
const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { EventSubWsListener} = require('@twurple/eventsub-ws');

dotenvx.config();

// Define our constants, you will change these with your own
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET    = process.env.TWITCH_SECRET;
const SESSION_SECRET   = process.env.SESSION_SECRET;
const CALLBACK_URL     = process.env.CALLBACK_URL;  // You can run locally with - http://localhost:3000/auth/twitch/callback

// Initialize Express and middlewares
var app = express();
app.use(session({secret: SESSION_SECRET, resave: false, saveUninitialized: false}));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());

// Override passport profile function to get user profile from Twitch API
OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
  var options = {
    url: 'https://api.twitch.tv/helix/users',
    method: 'GET',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Accept': 'application/vnd.twitchtv.v5+json',
      'Authorization': 'Bearer ' + accessToken
    }
  };

  request(options, function (error, response, body) {
    if (response && response.statusCode == 200) {
      done(null, JSON.parse(body));
    } else {
      done(JSON.parse(body));
    }
  });
}

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
    authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
    tokenURL: 'https://id.twitch.tv/oauth2/token',
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_SECRET,
    callbackURL: CALLBACK_URL,
    state: false
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;

    // Securely store user profile in your DB
    //User.findOrCreate(..., function(err, user) {
    //  done(err, user);
    //});

    done(null, profile);
  }
));

const checkAuthentication = (req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user) {
    return next();
  }
  const path = Buffer.from(req.path).toString('base64');
  res.redirect('/auth/twitch?state=' + path);
}

const includeRedirectInState = (req, res, next) => {
  passport.authenticate('twitch', { scope, state: req.query.state })(req, res, next);
}

const redirectAfterAuthentication = (req, res, next) => {
  const path = Buffer.from(req.query.state, 'base64').toString('ascii')
  passport.authenticate('twitch', { successRedirect: path, failureRedirect: '/' })(req, res, next);
}

const scope = ['user_read', 'channel:read:redemptions', 'user:read:chat'];

const connectToTwitch = async (accessToken) => {
  const authProvider = new StaticAuthProvider(TWITCH_CLIENT_ID, accessToken, scope);
  const apiClient = new ApiClient({ authProvider });
  const listener = new EventSubWsListener({ apiClient });

  return {
    auth: authProvider,
    api: apiClient,
    listener: listener
  }
}

// Set route to start OAuth link, this is where you define scopes to request
app.get('/auth/twitch', includeRedirectInState);

// Set route for OAuth redirect
app.get('/auth/twitch/callback', redirectAfterAuthentication);

// Define a simple template to safely generate HTML with values from user's profile
var authTemplate = handlebars.compile(`
<html><head><title>Twitch Auth Sample</title></head>
<table>
    <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
    <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
    <tr><th>Display Name</th><td>{{display_name}}</td></tr>
    <tr><th>Bio</th><td>{{bio}}</td></tr>
    <tr><th>Image</th><td>{{logo}}</td></tr>
</table></html>`);

var channelTemplate = handlebars.compile(`
<html>
  <head>
    <link href="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.css" rel="stylesheet">
    <script type="module" src="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.js"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.2/dist/cdn/material-dynamic-colors.min.js"></script>
    <title>Channel Feed: {{channel}}</title>
    <meta http-equiv="refresh" content="{{refresh}}">
  </head>
  <body class="dark">
    <header class="primary">
      <nav>
        <h5 class="max">Twitch Monitor</h5>
      </nav>
    </header>
    <main class="responsive">
      <div class="grid">
        <div class="s6">
          {{placeholderIfEmpty "messages" messages}}
          {{#each messages}}
            {{chatMessage}}
          {{/each}}
        </div>
        <div class="s6">
          {{placeholderIfEmpty "alerts" alerts}}
          {{#each alerts}}
            <article>
              <p>{{this.message}}</p>
            </article>
          {{/each}}
        </div>
      </div>
    </main>
  </body>
</html>`);

handlebars.registerHelper('alertMessage', function () {
  switch (this.type) {
    default:
      return this.message
  }
});

handlebars.registerHelper('chatMessage', function () {
  let output = '';
  const badgeString = Object.entries(this.badges)
    .filter(([id, version]) => Object.hasOwn(badges, id) && Object.hasOwn(badges[id], version))
    .map(([id, version]) => `<img src="${badges[id][version].getImageUrl(1)}" class="square"/> `)
    .join('');
  const message = `<span>${badgeString}</span><span style="color:${this.color}">${this.user}</span> <span>${this.message}</span>`
  if (this.new) {
    output = `<article class="surface-bright large-text">${message}</article>`
  } else {
    output = `<article>${message}</article>`
  }
  return new handlebars.SafeString(output);
});

const infoSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`

handlebars.registerHelper('placeholderIfEmpty', function (type, list) {
  if (list.length === 0) {
    return new handlebars.SafeString(`<article><i class="tiny">${infoSvg}</i> <span>No ${type} to display.</span></article>`);
  }
  return '';
});

// If user has an authenticated session, display it, otherwise display link to authenticate
app.get('/', checkAuthentication, async function (req, res) {
  res.send(authTemplate(req.session.passport.user));
});

let current = {};
let alerts = [];
let messages = [];
let badges = {};
const limit = 25;
const refresh = 5;
const newDuration = 15;


app.get('/channel/:channel', checkAuthentication, async function (req, res) {
  const channel = req.params.channel;
  if (!channel) {
    // return 400, no channel specified
    return res.status(400).send('No channel specified');
  }

  if (current.channel === channel) {
    // return the web page, all listeners are already started.
    res.send(channelTemplate({ channel: current.channel, alerts, messages, refresh }));
    messages.filter(m => m.new > 0).map(m => m.new--);
    return;
  }

  if (current.listener && current.channel !== channel) {
    current.listener.stop();
    current = {};
    messages = [];
    alerts = [];
    badges = {};
  }

  const { auth, api, listener } = await connectToTwitch(req.session.passport.user.accessToken);
  
  const userId = req.session.passport.user.data[0].id
  let broadcaster = null;
  try {
    broadcaster = await api.users.getUserByName(req.params.channel);
  } catch (e) {
    // return 404, the channel was not found
    return res.status(404).send(`Channel ${channel} not found`);
  }

  let globalBadges = [];
  let channelBadges = [];

  try {
    globalBadges = await api.chat.getGlobalBadges();
    channelBadges = await api.chat.getChannelBadges(broadcaster.id);
  } catch (e) {
    console.error(`Failed to get badges: ${e}`);
  }

  globalBadges.forEach(badge => {
    badges[badge.id] = badge.versions.reduce((acc, version) => { 
      acc[version.id] = version;
      return acc 
    }, {});
  });

  channelBadges.forEach(badge => {
    badges[badge.id] = badge.versions.reduce((acc, version) => { 
      acc[version.id] = version;
      return acc 
    }, {});
  });

  listener.start();
  current.listener = listener;
  current.channel = broadcaster.name;

  listener.onChannelChatMessage(broadcaster.id, userId, async event => {
    if (event.isCheer) {
      alerts.unshift({type: 'cheer', user: event.chatterDisplayName, bits: event.bits, message: `${event.chatterDisplayName} cheered ${event.bits} bits`})
      alerts.length = limit
    } 
    if (event.isRedemption) {
      const reward = await api.channelPoints.getCustomRewardById(broadcaster.id, event.rewardId)
      alerts.unshift({type: 'redemption', user: event.chatterDisplayName, reward: event.rewardId, message: `${event.chatterDisplayName} redeemed ${event.rewardTitle} - ${event.rewardPrompt} for ${event.rewardCost} points`})
      alerts.length = limit
    }
    messages.unshift({user: event.chatterDisplayName, badges: event.badges, color: event.color || '#888888', new: Math.ceil(newDuration / refresh), message: event.messageText})

    // event.messageParts.forEach(part => {
    //   console.log(`${util.inspect(part)}`)
    // })
    
    messages.length = limit
  })

  listener.onChannelChatNotification(broadcaster.id, userId, event => {
    switch (event.type) {
      case 'community_sub_gift':
        alerts.unshift({type: 'community_sub_gift', user: event.chatterDisplayName, amount: event.amount, cumulativeAmount: event.cumulativeAmount, message: `${event.chatterDisplayName} gifted ${event.amount}, they have gifted ${event.cumulativeAmount} to the channel`})
        break;
      case 'announcement':
        alerts.unshift({type: 'announcement', user: event.chatterDisplayName, message: event.messageText})
        break;
      case 'raid':
        alerts.unshift({type: 'raid', user: event.raiderDisplayName, viewerCount: event.viewerCount, message: event.messageText})
        break;
      case 'sub_gift':
        alerts.unshift({type: 'sub_gift', user: event.chatterDisplayName, recipient: event.recipientDisplayName, duration: event.durationMonths, message: `${event.chatterDisplayName} gifted a subscription to ${event.recipientDisplayName} for ${event.durationMonths} months`})
        break;
      default:
        alerts.unshift({type: 'unknown', user: event.chatterDisplayName, message: `Unhandled notification type: ${event.type}`})
        break;
    }
    alerts.length = limit
  })

  return res.send(channelTemplate({ channel: current.channel, alerts, messages, refresh: 2 }));
});

app.listen(3000, function () {
  console.log('Twitch auth sample listening on port 3000!')
});
