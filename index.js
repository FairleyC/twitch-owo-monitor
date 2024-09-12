/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

*/

// Define our dependencies
var express = require('express');
var session = require('express-session');

var dotenvx = require('@dotenvx/dotenvx');
var handlebars = require('handlebars');

dotenvx.config();

// Define our constants, you will change these with your own
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3000;

// Initialize Express and middlewares
var app = express();
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(express.static('public'));
app.use(express.json());

// Configure Twitch
const { checkAuthentication, applyTwitchAuth } = require('./src/twitch/auth/service');
applyTwitchAuth(app);
app.use('/auth/twitch', require('./src/twitch/auth/api.routes'));
app.use('/app/auth/twitch', require('./src/twitch/auth/app.routes'));

app.use('/api/twitch', require('./src/twitch/api.routes'));
app.use('/app/twitch', require('./src/twitch/app.routes'));

// Redemption
const { initializeRedemptions } = require('./src/redemptions/service');
require('./src/redemptions/handlebars').configureRedemptionsHandlebars(handlebars);
app.use('/app/redemptions', require('./src/redemptions/app.routes'));
app.use('/api/redemptions', require('./src/redemptions/api.routes'));

// Keyword
require('./src/keywords/handlebars').configureKeywordsHandlebars(handlebars);
app.use('/app/keywords', require('./src/keywords/app.routes'));
app.use('/api/keywords', require('./src/keywords/api.routes'));

// Chat Messages
require('./src/chat/handlebars').configureChatHandlebars(handlebars);
app.use('/app/chat', require('./src/chat/app.routes'));
app.use('/api/chat', require('./src/chat/api.routes'));

// Utility
require('./src/utility/handlebars').configureUtilityHandlebars(handlebars);

// Queue
const { startQueueProcessing, stopQueueProcessing, getQueueStatus } = require('./src/utility/queue/processor');
app.use('/api/queue', require('./src/utility/queue/api.routes'));
app.use('/api/triggers', require('./src/utility/queue/trigger/api.routes'));

// Test
app.use('/api/test', require('./src/utility/dev/test/api.routes'));

// OwO
const { closeOwoApplication } = require('./src/owo/service');
app.use('/api/owo', require('./src/owo/api.routes'));

const { enableDevMode, isDevMode } = require('./src/utility/dev/service');
const { isOwoApplicationRunning, isOwoVestConnected } = require('./src/owo/status.service');

const server = require('./src/notifications/socketio').configureSocketIo(app);

app.get('/health', checkAuthentication, async function (req, res) {
  res.send({ node: true, owo: isOwoApplicationRunning(), queue: getQueueStatus(), vest: isOwoVestConnected(), dev: isDevMode() });
});

//
//
// Process Management
const cleanup = () => {
  // TODO: sent kill command to socket io
  closeOwoApplication();
  stopQueueProcessing();
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
})

//
//
// Application Startup
server.listen(PORT, function () {
  console.log(`Twitch auth sample listening on port ${PORT}!`)

  initializeRedemptions();

  process.argv.forEach(arg => {
    switch (arg) {
      case '-d':
        enableDevMode();
        break;
      default:
        break;
    }
  })

  // bad name, not enough context to know it is starting.
  // starts the queue processor.
  startQueueProcessing();
});
