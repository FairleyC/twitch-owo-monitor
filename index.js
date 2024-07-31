/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

*/

// Define our dependencies
var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var handlebars     = require('handlebars');
const res          = require('express/lib/response');
var dotenvx        = require('@dotenvx/dotenvx').config()
const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { EventSubWsListener} = require('@twurple/eventsub-ws');

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
var template = handlebars.compile(`
<html><head><title>Twitch Auth Sample</title></head>
<table>
    <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
    <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
    <tr><th>Display Name</th><td>{{display_name}}</td></tr>
    <tr><th>Bio</th><td>{{bio}}</td></tr>
    <tr><th>Image</th><td>{{logo}}</td></tr>
</table></html>`);

// If user has an authenticated session, display it, otherwise display link to authenticate
app.get('/', checkAuthentication, async function (req, res) {
  res.send(template(req.session.passport.user));
});

let currentListener = null;

app.get('/channel/:channel', checkAuthentication, async function (req, res) {
  if (currentListener && currentListener !== req.params.channel) {
    currentListener.stop();
  }

  const { auth, api, listener } = await connectToTwitch(req.session.passport.user.accessToken);
  
  const userId = req.session.passport.user.data[0].id
  const broadcaster = await api.users.getUserByName(req.params.channel);

  listener.start();
  currentListener = req.params.channel;
  listener.onChannelChatMessage(broadcaster.id, userId, async event => {
    if (event.isCheer) {
      console.log(`[Alert]: ${event.chatterDisplayName} cheered ${event.bits} bits`)
    } 
    if (event.isRedemption) {
      const reward = await api.channelPoints.getCustomRewardById(broadcaster.id, event.rewardId)
      console.log(`[Alert]: ${event.chatterDisplayName} redeemed ${reward.rewardTitle} - ${reward.rewardPrompt} for ${reward.rewardCost} points`)
    }
    console.log(`${event.chatterDisplayName}: ${event.messageText}`)
  })

  listener.onChannelChatNotification(broadcaster.id, userId, event => {
    switch (event.type) {
      case 'community_sub_gift':
        console.log(`[Alert]: ${event.chatterDisplayName} gifted ${event.amount}, they have gifted ${event.cumulativeAmount} to the channel`)
        break;
      default:
        console.log(`[Alert]: Unhandled notification type: ${event.type}`)
        break;
    }
  })

  res.send(`listening to chat messages from ${broadcaster.displayName} (${req.params.channel})`);
});

app.listen(3000, function () {
  console.log('Twitch auth sample listening on port 3000!')
});
