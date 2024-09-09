/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

*/

// Define our dependencies
var express = require('express');
var session = require('express-session');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('request');
var handlebars = require('handlebars');
const fs = require('fs');
var dotenvx = require('@dotenvx/dotenvx');
const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { EventSubWsListener } = require('@twurple/eventsub-ws');
const { createServer } = require('http');
const { spawn } = require('child_process');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');
const { ToadScheduler, SimpleIntervalJob, Task } = require('toad-scheduler');


dotenvx.config();

// Define our constants, you will change these with your own
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;  // You can run locally with - http://localhost:3000/auth/twitch/callback
const PORT = process.env.PORT || 3000;
let DEV_MODE = process.env.DEV_MODE || false;
const filename = process.env.REDEMPTIONS_FILE || './redemptions.json';

// Initialize Express and middlewares
var app = express();
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

var server = createServer(app);
var io = new Server(server);

//
//
// Authentication Support
OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
  // Override passport profile function to get user profile from Twitch API
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

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
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
  function (accessToken, refreshToken, profile, done) {
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

//
//
// Webpage HTML Templates
var authTemplate = handlebars.compile(`
  <html><head><title>Twitch Auth Sample</title></head>
  <table>
      <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
      <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
      <tr><th>Display Name</th><td>{{display_name}}</td></tr>
      <tr><th>Bio</th><td>{{bio}}</td></tr>
      <tr><th>Image</th><td>{{logo}}</td></tr>
  </table></html>
`);

var redemptionsTableTemplate = handlebars.compile(`
    {{> redemptionsTablePartial}}
`);

var channelTemplate = handlebars.compile(`
  <html>
    <head>
      <link href="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.css" rel="stylesheet">
      <script type="module" src="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.js"></script>
      <script type="module" src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.2/dist/cdn/material-dynamic-colors.min.js"></script>
      <title>Channel Feed: {{channel}}</title>
    </head>
    <body class="dark">
      <header class="primary">
        <nav>
          <a href="https://www.twitch.tv/{{channel}}" target="_blank">
            <img src="https://cdn.icon-icons.com/icons2/3042/PNG/512/twitch_logo_icon_189276.png" width="64" height="64" alt="Twitch Logo" />
          </a>
          <h5 class="max bold">Twitch Monitor</h5>
          {{#if options.devMode}}
            {{> developmentToolbar}}
          {{/if}}
        </nav>
      </header>
      <main class="responsive" id="content" style="scrollbar-gutter: stable;">
        <div class="grid padding">
          {{controlBar}}
          {{> chatStreamPartial}}
          {{> informationColumn}}
          {{> keywordsStreamPartial}}
        </div>
      </main>
      <script>
        document.getElementById('chat').style.display = 'none';
      </script>
      <script>
        setInterval(function() {
          refreshKeywords();
          if (document.getElementById('chat-checkbox').checked) {
            refreshChat();
          }
        }, {{refresh}} * 1000)

        function refreshKeywords() {
          fetch('/app/keywords').then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('keywords').outerHTML = text;
              });
            } else {
              console.error(response);
            }
          });
        }

        function refreshChat() {
          fetch('/app/chat').then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('chat').outerHTML = text;
                if (!document.getElementById('chat-checkbox').checked) {
                  document.getElementById('chat').style.display = 'none';
                }
              });
            } else {
              console.error(response);
            }
          });
        }
      </script>
      <script>
        function replayKeyword(uuid) {
          fetch('/app/keywords/' + uuid, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ replay: uuid})
          }).then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('keywords').innerHTML = text;
              });
            } else {
              console.error(response);
            }
          });
        }
        function cancelKeyword(uuid) {
          fetch('/app/keywords/' + uuid, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cancel: uuid})
          }).then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('keywords').innerHTML = text;
              });
            } else {
              console.error(response);
            }
          });
        }
      </script>
    </body>
  </html>
`);

const channelTemplateOptions = (channel, userId) => { return { channel, messages, keywords, refresh, userId, redemptions, queue: queueCanProcess, options: { devMode: DEV_MODE } } }

var keywordsStreamTemplate = handlebars.compile(`
  {{> keywordsStreamPartial}}
`);

var chatStreamTemplate = handlebars.compile(`
  {{> chatStreamPartial}}
`);

handlebars.registerHelper('controlBar', function () {
  let output = `
    <div class="s2 middle-align left-align">
      <label class="switch icon">
        <input type="checkbox" id="chat-checkbox">
        <span>
          <i>chat</i>
        </span>
      </label>
    </div>
    <div class="s8"></div>
    <div class="s2 middle-align right-align">
      <button class="small circle" id ="launch-owo">
        <i>publish</i>
      </button>
      <label class="switch icon">
        <input type="checkbox" ${this.queue && "checked"} id="queue-checkbox">
        <span>
          <i>bolt</i>
        </span>
      </label>
    </div>
    <script>
      const chatCheckbox = document.getElementById('chat-checkbox');
      chatCheckbox.addEventListener('change', function() {
        if (chatCheckbox.checked) {
          refreshChat();
          document.getElementById('chat').style.display = 'block';
          document.getElementById('information').style.display = 'none';
        } else {
          document.getElementById('chat').style.display = 'none';
          document.getElementById('information').style.display = 'block';
        }
      });
      
      const queueCheckbox = document.getElementById('queue-checkbox');
      const queueRefreshDelay = 5000;

      setInterval(function() {
        fetch('/api/queue', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }).then(function(response) {
          if (!response.ok) {
            console.error(response);
          } else {
            response.json().then(function(json) {
              queueCheckbox.checked = json.queue;
            })
          }
        });
      }, queueRefreshDelay);

      queueCheckbox.addEventListener('change', function() {
        if (queueCheckbox.checked) {
          fetch('/api/queue', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ queue: 'on' })
          }).then(function(response) {
            if (!response.ok) {
              queueCheckbox.checked = false;
              console.error(response);
            }
          });
        } else {
          fetch('/api/queue', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ queue: 'off' })
          }).then(function(response) {
            if (!response.ok) {
              queueCheckbox.checked = true;
              console.error(response);
            }
          });
        }
      });

      const launchOwoButton = document.getElementById('launch-owo');
      launchOwoButton.addEventListener('click', function() {
        fetch('/api/owo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }).then(function(response) {
          if (!response.ok) {
            console.error(response);
          }
        });
      });

    </script>
  `
  return new handlebars.SafeString(output);
})

handlebars.registerPartial('chatStreamPartial', `
  <div class="s6" id="chat">
    {{ placeholderIfEmpty "messages" messages }}
    {{#each messages}}
      {{chatMessage this userId}}
    {{/each}}
  </div>
`);

// rename to reflect redemptions?
handlebars.registerPartial('informationColumn', `
    <div class="s6" id="information">
      <article>
        <h3>Redemptions</h3>
        <div id="redemptions-table">
          {{> redemptionsTablePartial}}
        </div>
        <fieldset>
          <legend>New Redemption</legend>
          <div class="row">
            <div class="max">
              <div class="field label">
                <input type="text" name="prefix" id="new-sensation-prefix">
                <label>Prefix</label>
              </div>
            </div>
            <div class="max">
              <div class="field label">
                <input type="number" name="cost" id="new-sensation-cost">
                <label>Cost</label>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="max">
              <div class="field label">
                <input type="text" name="description" id="new-sensation-description">
                <label>Description</label>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="max">
              <div class="field textarea border label">
                <textarea name="sensation" id="new-sensation-code"></textarea>
                <label>Sensation</label>
              </div>
            </div>
          </div>
          <div class="row right-align">
            <nav class="no-space">
              <button class="transparent circle" onclick="addRedemption()">
                <i>save</i>
              </button>
              <button class="transparent circle" onclick="clearRedemptionForm()">
                <i>cancel</i>
              </button>
            </nav>
          </div>
        </fieldset>
      </article>
      <script>
        function addRedemption() {
          const prefix = document.getElementById('new-sensation-prefix').value;
          const cost = document.getElementById('new-sensation-cost').value;
          const description = document.getElementById('new-sensation-description').value;
          const sensation = document.getElementById('new-sensation-code').value;

          const redemption = {
            prefix,
            cost,
            description,
            sensation
          }

          fetch('/app/redemption', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(redemption)
          }).then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('redemptions-table').innerHTML = text;
                clearRedemptionForm();
              });
            } else {
              console.error(response);
            }
          });
        }

        function clearRedemptionForm() {
          document.getElementById('new-sensation-prefix').value = '';
          document.getElementById('new-sensation-cost').value = '';
          document.getElementById('new-sensation-description').value = '';
          document.getElementById('new-sensation-code').value = '';
        }

        function deleteRedemption(uuid) {
          fetch('/app/redemption/' + uuid, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          }).then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('redemptions-table').innerHTML = text;
              });
            } else {
              console.error(response);
            }
          });
        }

        function editRedemption(uuid) {
          fetch('/api/redemption/' + uuid).then(function(response) {
            if (response.ok) {
              response.json().then(function(json) {
                document.getElementById('new-sensation-prefix').value = json.prefix;
                document.getElementById('new-sensation-cost').value = json.cost;
                document.getElementById('new-sensation-description').value = json.description;
                document.getElementById('new-sensation-code').value = json.sensation;
              });
            } else {
              console.error(response);
            }
          });
        }

        function refreshRedemptions() {
          fetch('/app/redemptions').then(function(response) {
            if (response.ok) {
              response.text().then(function(text) {
                document.getElementById('redemptions-table').innerHTML = text;
              });
            } else {
              console.error(response);
            }
          });
        }

        const redemptionRefreshDelay = 5000;
        setInterval(function() {
          refreshRedemptions();
        }, redemptionRefreshDelay);
      </script>
    </div>
`)

handlebars.registerPartial('keywordsStreamPartial', `
  <div class="s6" id="keywords">
    {{ placeholderIfEmpty "keywords" keywords }}
    {{#each keywords}}
      {{keywordMessage this userId}}
    {{/each}}
  </div>
`);

handlebars.registerPartial('redemptionsTablePartial', `
    <hr>
    <div class="grid middle-align padding"> 
      <span class="s2 bold">Prefix</span>
      <span class="s2 bold">Cost</span>
      <span class="s8 bold">Description</span>
      
      {{#each redemptions.list}}
        <div class="s12 grid no-space middle-align no-margin">
          <span class="s2">{{this.prefix}}</span>
          <span class="s2">{{this.cost}}</span>
          <span class="s6">{{this.description}}</span>

          <nav class="s2 right-align no-space no-margin">
            <button class="transparent circle" onclick="editRedemption('{{this.uuid}}')">
              <i>edit</i>
            </button>
            <button class="transparent circle" onclick="deleteRedemption('{{this.uuid}}')">
              <i>delete</i>
            </button>
          </nav>

          {{redemptionsTableMetadata this}}
        </div>
      {{/each}}
    </div>
`);

handlebars.registerHelper('redemptionsTableMetadata', function (redemption) {
  let output = '';
  const metadata = redemptions.metadataMap[redemption.uuid];

  if (!metadata.valid) {
    output = `<div class="s12 error-text small-text">Sensation was parsed and rejected.</div>`
  } else if (!metadata.usable) {
    output = `<div class="s12 secondary-text small-text">Sensation hasn't been sent to OwO yet.</div>`
  }

  return new handlebars.SafeString(output);
});

handlebars.registerPartial('developmentToolbar', `
  <div>
    <span class="bold">Development Controls:</span>
    <button class="border small-round primary" onclick="setTestSignal()"><p class="large-text">Test</p></button>
    <script>
      function setTestSignal() {
        fetch('/api/test', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: ""
        });
      }
    </script>
  </div>
`);

handlebars.registerHelper('placeholderIfEmpty', function (type, list) {
  if (list.length === 0) {
    return new handlebars.SafeString(`<article><i class="tiny">${infoSvg}</i> <span>No ${type} to display.</span></article>`);
  }
  return '';
});

handlebars.registerHelper('keywordMessage', function (keyword, userId) {
  let output = '';
  const badgeString = formatBadgeContent(keyword.badges)
  const content = formatMessageContent(keyword.messageParts, userId)

  let line = `<div class="s12"><span>${badgeString}</span><span style="color:${keyword.color}">${keyword.user}</span>: ${content}</div>`
  keyword.keywords.forEach(keyword => {
    const buttons = `
      <nav class="no-space">
        <button class="border left-round" ${keyword.triggered ? '' : 'disabled'} onclick="replayKeyword('${keyword.id}')">
          <i>refresh</i>
        </button>
        <button class="border right-round" ${keyword.triggered ? 'disabled' : ''} onclick="cancelKeyword('${keyword.id}')">
          <i>cancel</i>
        </button>
      </nav>
    `
    const description = "Description Goes Here"
    line += `<hr class="s12"><div class="s3 middle-align center-align"><span style="color: gold">⚡${keyword.number}</span></div><div class="s6 middle-align left-align">${description}</div><div class="s3">${buttons}</div>`
  })

  let classValue = { color: "", size: "" };
  if (keyword.new) {
    classValue.color = 'surface-bright'
    classValue.size = 'large-text'
  }

  output = `<article class="${classValue.color} ${classValue.size}"><div class="grid">${line}</div></article>`

  return new handlebars.SafeString(output);
});

handlebars.registerHelper('chatMessage', function (message, userId) {
  let output = '';
  const badgeString = formatBadgeContent(message.badges)
  const content = formatMessageContent(message.messageParts, userId)
  const line = `<span>${badgeString}</span><span style="color:${message.color}">${message.user}</span>: ${content}`

  let classValue = { color: "", size: "" };
  if (message.new) {
    classValue.color = 'surface-bright'
    classValue.size = 'large-text'
  }

  const mentioned = message.messageParts.filter(part => part.type === 'mention').findIndex(part => part.mention.user_id === userId) !== -1
  if (mentioned) {
    classValue.color = 'primary-container'
  }

  output = `<article class="${classValue.color} ${classValue.size}">${line}</article>`

  return new handlebars.SafeString(output);
});

const formatBadgeContent = (chatterBadges) => {
  return Object.entries(chatterBadges)
    .filter(([id, version]) => Object.hasOwn(badges, id) && Object.hasOwn(badges[id], version))
    .map(([id, version]) => `<img src="${badges[id][version].getImageUrl(1)}" alt="${badges[id][version].title}" class="square"></image> `)
    .join('');
}

const formatMessageContent = (messageParts, userId) => {
  return messageParts.map(part => {
    switch (part.type) {
      case 'text':
        return `<span>${part.text}</span>`
      case 'cheermote':
        const displayProps = cheermotes.getCheermoteDisplayInfo(part.cheermote.prefix, part.cheermote.bits, { background: 'dark', scale: 1, state: 'animated' })
        return `<img src="${displayProps.url}" alt="${part.cheermote.prefix}" class="square"></image><span style="color:${displayProps.color}">${part.cheermote.bits}</span>`
      case 'emote':
        if (Object.hasOwn(emotes, part.emote.id)) {
          const emote = emotes[part.emote.id]
          const format = emote.formats.slice(-1)[0]
          const scale = emote.scales[0]
          const theme = emote.themeModes.slice(-1)[0]
          let src = emote.getFormattedImageUrl(scale, format, theme)
          return `<img src="${src}" alt="${part.text}" width="28" class="square"></image>`
        } else {
          return `<span>${part.text}</span>`
        }
      case 'mention':
        let classValue = 'surface-variant square'
        if (part.mention.user_id === userId) {
          classValue = 'inverse-surface square'
        }
        return `<span class="${classValue}" style="padding: 4px">${part.text}</span>`
      case 'keyword':
        return `<span style="color: gold">⚡${part.keyword.number}</span>`
      default:
        return ``
    }
  }).join(' ')
}

const infoSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`

//
//
// Application State
let current = {};
let messages = [];
let keywords = [];
let emotes = {};
let badges = {};
let cheermotes = {};
let redemptions = {};
let triggers = [];
let owoProcess = undefined;
let owoConnection = false;
const limit = 25;
const refresh = 5;
const newDuration = 15;

//
//
// Redemption Management

const parseRedemptions = () => {
  if (fs.existsSync(filename)) {
    parseRedemptionsFromFile();
  } else {
    parseRedemptionsFromStaticCode();
  }
}

const writeRedemptionsToFile = () => {
  fs.writeFileSync(filename, JSON.stringify(redemptions.list));
}

const parseRedemptionsFromFile = () => {
  const data = fs.readFileSync(filename, 'utf8');
  // TODO: validate data before creating maps.
  redemptions = createRedemptionMaps(JSON.parse(data));
}

const parseRedemptionsFromStaticCode = () => {
  staticRedemptions = [
    { uuid: crypto.randomUUID(), description: "10 Description", cost: 10, prefix: "cheer", sensation: "10 Description"},
    { uuid: crypto.randomUUID(), description: "20 Description", cost: 20, prefix: "cheer", sensation: "20 Description"},
    { uuid: crypto.randomUUID(), description: "30 Description", cost: 30, prefix: "cheer", sensation: "30 Description"},
  ]

  redemptions = createRedemptionMaps(staticRedemptions);
  writeRedemptionsToFile();
}

const createRedemptionMaps = (list) => {
  const cheermoteMap = list.reduce((acc, redemption, index) => {
    acc[redemption.prefix + redemption.cost] = Object.assign({ index }, redemption);
    return acc;
  }, {});

  const idMap = list.reduce((acc, redemption, index) => {
    acc[redemption.uuid] = Object.assign({ index }, redemption);
    return acc;
  }, {});

  const oldMetadata = redemptions.metadataMap || {};
  const newMetadata = {};
  list.forEach(redemption => {
    let redemptionMetadata = {};
    if (Object.hasOwn(oldMetadata, redemption.uuid)) {
      redemptionMetadata = oldMetadata[redemption.uuid];
    } else {
      // generate new metadata
      // codes are assumed valid until proven otherwise by OwO parsing errors.
      // codes are unusable until the OwoApp is restarted.
      redemptionMetadata = { valid: true, usable: false };
    }
    newMetadata[redemption.uuid] = redemptionMetadata;
  });

  const validMessagePatterns = list.map(redemption => function(message, metadata) {
    const regex = new RegExp(String.raw`\b${redemption.prefix}${redemption.cost}\b`)
    return regex.test(message) && metadata[redemption.uuid].usable && metadata[redemption.uuid].valid;
  });

  return {
    cheermoteMap,
    idMap,
    list,
    metadataMap: newMetadata,
    patterns: validMessagePatterns
  }
}

const removeRedemption = (uuid) => {
  const redemptionIndex = redemptions.idMap[uuid].index
  const newList = redemptions.list.toSpliced(redemptionIndex, 1)
  redemptions = createRedemptionMaps(newList)
  writeRedemptionsToFile();
}

const addRedemption = (newRedemption) => {
  const newList = [...redemptions.list, newRedemption]
  redemptions = createRedemptionMaps(newList)
  writeRedemptionsToFile();
}

//
//
// Application Endpoints
app.get('/', checkAuthentication, async function (req, res) {
  res.send(authTemplate(req.session.passport.user));
});

// Set route to start OAuth link, this is where you define scopes to request
app.get('/auth/twitch', includeRedirectInState);

// Set route for OAuth redirect
app.get('/auth/twitch/callback', redirectAfterAuthentication);

app.get('/app/keywords', checkAuthentication, async function (req, res) {
  const userId = req.session.passport.user.data[0].id
  res.send(keywordsStreamTemplate({ keywords, userId }))
});

app.get('/app/redemptions', checkAuthentication, async function (req, res) {
  res.send(redemptionsTableTemplate({ redemptions }))
});

app.post('/app/keywords/:uuid', checkAuthentication, async function (req, res) {
  const uuid = req.params.uuid
  const userId = req.session.passport.user.data[0].id

  let instance = findKeywordInstanceByTrigger(uuid)
  if (!instance) {
    return res.status(404).send('Keyword Instance not found');
  }

  if (req.body.cancel && req.body.replay) {
    return res.status(400).send('Cannot cancel and replay at the same time');
  }

  if (!req.body.cancel && !req.body.replay) {
    return res.status(400).send('Must specify either replay or cancel');
  }

  if (req.body.replay) {
    generateTrigger(instance)
    instance.triggered = false;
  }

  if (req.body.cancel) {
    triggers = triggers.filter(trigger => trigger.triggeringId !== uuid)
    instance.triggered = true;
  }

  res.send(keywordsStreamTemplate({ keywords, userId }))
});

app.get('/app/chat', checkAuthentication, async function (req, res) {
  const userId = req.session.passport.user.data[0].id
  res.send(chatStreamTemplate({ messages, userId }))
});

// TODO: check if the path needs 'app' prefix
app.delete('/app/redemption/:uuid', checkAuthentication, async function (req, res) {
  const uuid = req.params.uuid
  if (!Object.hasOwn(redemptions.idMap, uuid)) {
    return res.status(404).send('Redemption not found');
  }
  removeRedemption(uuid)
  res.status(200).send(redemptionsTableTemplate({ redemptions }))
});

// TODO: check if the path needs 'app' prefix
app.post('/app/redemption', checkAuthentication, async function (req, res) {
  const { prefix, cost, description, sensation } = req.body
  // need to validate fields.
  //   prefix needs to be a valid cheermote prefix
  //   cost needs to be a number
  //   description needs to be a string
  //   sensation needs to be a valid sensation *cry*

  const newRedemption = {
    uuid: crypto.randomUUID(),
    prefix,
    cost,
    description,
    sensation
  }

  addRedemption(newRedemption);
  res.status(200).send(redemptionsTableTemplate({ redemptions }))
});

app.get('/api/redemption/:uuid', checkAuthentication, async function (req, res) {
  const uuid = req.params.uuid
  const redemption = redemptions.idMap[uuid]
  if (!redemption) {
    return res.status(404).send('Redemption not found');
  }
  res.send(redemption);
});

app.post('/api/owo', checkAuthentication, async function (req, res) {
  const owoExitFunction = (output, code) => {
    owoProcess = undefined;
    console.log("[Child Process (OwoApp.exe)] Exited with status:", code)
  }
  const sensationFileOption = `--sensation-file`

  if (owoProcess) {
    // Setup a timeout for the process if it doesn't finish in the allotted time.
    const timeout = 10 * 1000;
    owoTimeout = setTimeout(() => {
      console.log('[Node] OwO Timeout Reached');
      owoProcess.kill('SIGKILL');
    }, timeout);

    // Setup exit listener to restart once the process exits.
    owoProcess.on('exit', () => {
      console.log('[Node] OwO Restarting');
      clearTimeout(owoTimeout);
      owoProcess = run_script('OwoApp.exe', [sensationFileOption, filename], owoExitFunction)
    });

    // Send the signal to closed the process.
    closeOwoApplication();
  } else {
    owoProcess = run_script('OwoApp.exe', [sensationFileOption, filename], owoExitFunction)
  }
  res.status(200).send('OwO Launched');
});

app.get('/health', checkAuthentication, async function (req, res) {
  res.send({ node: true, owo: owoProcess !== undefined, queue: queueCanProcess, vest: owoConnection });
});

app.get('/api/keywords', checkAuthentication, async function (req, res) {
  res.send(keywords);
});

app.get('/api/redemptions', checkAuthentication, async function (req, res) {
  res.send(redemptions);
});

app.get('/api/messages', checkAuthentication, async function (req, res) {
  res.send(messages);
});

app.get('/api/triggers', checkAuthentication, async function (req, res) {
  res.send(triggers);
});

app.get('/api/emotes', checkAuthentication, async function (req, res) {
  res.send(emotes);
});

app.get('/api/badges', checkAuthentication, async function (req, res) {
  res.send(badges);
});

app.get('/api/cheermotes', checkAuthentication, async function (req, res) {
  res.send(cheermotes);
});

app.get('/api/channel', checkAuthentication, async function (req, res) {
  res.send(current);
});

app.get('/api/queue', checkAuthentication, async function (req, res) {
  res.send({ queue: queueCanProcess });
});

app.post('/api/queue', checkAuthentication, async function (req, res) {
  const status = req.body.queue
  if (!status) {
    return res.status(400).send('Must specify queue status');
  }
  if (!owoConnection) {
    return res.status(502).send('OwO is not currently connected, queue cannot be started until OwO is available');
  }
  if (status === 'on') {
    queueCanProcess = true;
  } else if (status === 'off') {
    queueCanProcess = false;
  } else {
    return res.status(400).send('Invalid queue status, must be either "on" or "off"');
  }

  res.send('Queue Status Updated: ' + status);
});

app.post('/api/test', checkAuthentication, async function (req, res) {
  if (!DEV_MODE) {
    return res.status(400).send('Test is only available in development mode');
  }
  io.emit('test', 'Test Triggered');
  res.send('Test Triggered');
});

app.get('/channel/:channel', checkAuthentication, async function (req, res) {
  const channel = req.params.channel;
  const userId = req.session.passport.user.data[0].id

  //
  //
  // Channel not provided.
  if (!channel) {
    // return 400, no channel specified
    return res.status(400).send('No channel specified');
  }

  //
  //
  // Shortcut
  const isRefreshCurrentChannel = current.channel === channel
  if (isRefreshCurrentChannel) {
    // return the web page, all listeners are already started.
    res.send(channelTemplate(channelTemplateOptions(current.channel, userId)));
    messages.filter(m => m.new > 0).map(m => m.new--);
    keywords.filter(m => m.new > 0).map(m => m.new--);
    return;
  }

  //
  //
  // Changing channels
  const isAlreadyConnectedToChannel = current.listener
  const isNotTheSameAsCurrentChannel = current.channel !== channel
  if (isAlreadyConnectedToChannel && isNotTheSameAsCurrentChannel) {
    current.listener.stop();
    current = {};
    messages = [];
    keywords = [];
    badges = {};
  }

  const { auth, api, listener } = await connectToTwitch(req.session.passport.user.accessToken);

  //
  //
  // lookup channel to find broadcaster
  // 404 if channel not found
  let broadcaster = null;
  try {
    broadcaster = await api.users.getUserByName(req.params.channel);
  } catch (e) {
    // return 404, the channel was not found
    return res.status(404).send(`Channel ${channel} not found`);
  }

  //
  //
  // emotes
  let globalEmotes = [];
  let channelEmotes = [];
  try {
    globalEmotes = await api.chat.getGlobalEmotes();
    channelEmotes = await api.chat.getChannelEmotes(broadcaster.id);
  } catch (e) {
    console.error(`Failed to get emotes: ${e}`);
  }

  globalEmotes.forEach(emote => emotes[emote.id] = emote);
  channelEmotes.forEach(emote => emotes[emote.id] = emote);



  //
  //
  // cheermotes
  let globalCheermoteList = {};
  try {
    globalCheermoteList = await api.bits.getCheermotes();
  } catch (e) {
    console.error(`Failed to get cheermotes: ${e}`);
  }
  cheermotes = globalCheermoteList;


  //
  //
  // badges
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

  //
  //
  // setup eventsub listener
  listener.start();
  current.listener = listener;
  current.channel = broadcaster.name;

  listener.onChannelChatMessage(broadcaster.id, userId, async event => {
    const message = {
      user: event.chatterDisplayName,
      color: event.color || '#888888',
      badges: event.badges,
      messageParts: event.messageParts,
      new: Math.ceil(newDuration / refresh),
    }

    //
    //
    // Identify keyword instances.
    if (DEV_MODE) {
      const keywordName = "owo"
      const keywordPattern = new RegExp(String.raw`\b${keywordName}\d+\b`)
      if (keywordPattern.test(event.messageText)) {
        const keywordInstances = [];
        const reprocessedMessageParts = event.messageParts.reduce((acc, part) => {
          if (part.type === 'text' && keywordPattern.test(part.text)) {
            const words = part.text.split(' ')

            let newText = [];
            let currentText = [];
            words.forEach(word => {
              if (keywordPattern.test(word)) {
                if (currentText.length > 0) {
                  currentText.push('')
                  newText.push(currentText.join(' '))
                }
                currentText = ['']
                newText.push(word)
              } else {
                currentText.push(word)
              }
            });
            if (currentText.length > 0) {
              newText.push(currentText.join(' '))
            }

            const digits = /\d+/
            newParts = newText.forEach(text => {
              if (keywordPattern.test(text)) {
                const [number] = text.match(digits)
                acc.push(Object.assign({}, part, { type: 'keyword', text, keyword: { prefix: keywordName, number } }))
                keywordInstances.push({ id: randomUUID(), prefix: keywordName, number, triggered: false })
              } else {
                acc.push(Object.assign({}, part, { text }))
              }
            });
          } else {
            acc.push(part)
          }
          return acc
        }, [])

        // TODO: should I change "keywords" to "instances"?
        keywords.unshift(Object.assign({}, message, { type: 'keyword', keywords: keywordInstances, messageParts: reprocessedMessageParts }))
        keywordInstances.forEach(keywordInstance => generateTrigger(keywordInstance))
      }
    } else {
      function cheermoteMatchesRedemptionPattern(cheermote) {
        return redemptions.patterns.some(pattern => pattern(cheermote, redemptions.metadataMap));
      }
      if (event.isCheer) {
        const keywordInstances = event.messageParts
          .filter(part => part.type === 'cheermote' && cheermoteMatchesRedemptionPattern(part.cheermote.prefix + part.cheermote.bits))
          .map(part => ({ id: randomUUID(), prefix: part.cheermote.prefix, number: part.cheermote.bits, triggered: false }))
        
        if (keywordInstances.length > 0) {
          keywords.unshift(Object.assign({}, message, { type: 'keyword', keywords: keywordInstances, messageParts: event.messageParts }))
          keywordInstances.forEach(keywordInstance => generateTrigger(keywordInstance))
        }
      }
    }

    //
    //
    // Get emotes for channel if included in message and missing from cache
    event.messageParts.filter(part => part.type === 'emote')
      .filter(part => !Object.hasOwn(emotes, part.emote.id))
      .map(part => api.chat.getChannelEmotes(part.emote.owner_id))
      .map(promise => promise.then(channelEmotes => channelEmotes.forEach(emote => emotes[emote.id] = emote)))

    messages.unshift(message)
    messages.length = limit
  })

  //
  //
  // return template.
  return res.send(channelTemplate(channelTemplateOptions(current.channel, userId)));
});

//
//
// Trigger Support
const findNextTrigger = () => {
  triggerCount = triggers.length;
  currentIndex = 0;
  while (currentIndex < triggerCount) {
    const currentTrigger = triggers[currentIndex];
    const shouldRemoveTrigger = currentTrigger.attempts >= 3;
    if (shouldRemoveTrigger) {
      currentTrigger.failure('Attempt Limit of 3 Reached.');
      triggers.shift();
    } else {
      return currentTrigger;
    }
  }
  return undefined;
}

const generateTrigger = (keywordDetails) => {
  const trigger = {
    triggeringId: keywordDetails.id,
    trigger: () => {
      io.emit('trigger', `${keywordDetails.prefix}${keywordDetails.number}`, keywordDetails.id)
    },
    resolution: () => {
      markKeywordInstanceAsTriggered(keywordDetails.id);
    },
    failure: (error) => {
      console.error(`[Error] Trigger (${keywordDetails.id}) failed to resolve: ${error}`)
      markKeywordInstanceAsTriggered(keywordDetails.id);
    },
    attempts: 0
  }

  triggers.push(trigger)
}

const findKeywordInstanceByTrigger = (triggeringId) => {
  let found = undefined
  keywords.forEach(keyword => {
    keyword.keywords.forEach(instance => {
      if (instance.id === triggeringId && !found) {
        found = instance
      }
    })
  })
  return found;
}

const markKeywordInstanceAsTriggered = (triggeringId) => {
  const keywordInstance = findKeywordInstanceByTrigger(triggeringId);
  if (keywordInstance) {
    keywordInstance.triggered = true;
  }
}

//
//
// Socket IO Configuration
io.on("connection", (socket) => {
  console.log(`[Socket] Client Connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`[Socket] Client Disconnected: ${socket.id}`)
  })

  socket.on('owoConnected', () => {
    owoConnection = true;
    // should this turn on the queue or should it be manually turned on?

    // Mark all redemptions as usable if they didn't return as invalid.
    Object.values(redemptions.metadataMap).forEach((metadata) => {
      metadata.usable = metadata.valid;
    });
  })

  socket.on('sensationParsingError', (uuid) => {
    // flag the redemption as invalid
    redemptions.metadataMap[uuid].valid = false;
  })

  socket.on('triggerResponse', (triggeringId) => {
    console.log(`[Socket] Trigger Response: ${triggeringId}`)
    triggers = triggers.filter(trigger => {
      if (trigger.triggeringId === triggeringId) {
        trigger.resolution()
        return false;
      }
      return true;
    });
    currentTrigger = findNextTrigger();
    if (currentTrigger && queueCanProcess) {
      currentTrigger.trigger();
      currentTrigger.attempts++;
      console.log(`[Queue (socket)] Triggering ${currentTrigger.triggeringId} attempt ${currentTrigger.attempts} at ${Date.now()}`)
    }
  })

  socket.on('triggerError', (error) => {
    switch (error.type) {
      case 'Disconnected':
        owoConnection = false;
        queueCanProcess = false;
        break;
      case 'Unrecognized':
        // For right now we will just retry them but we should probably mark the redemption as invalid.
        // This might happen if a redemption is added after the OwO application is launched.
        // I could avoid this by preventing detection until restart and then flagging all new sensations as valid.
        break;
      default:
        // Do nothing for now
        break;
    }
  })
})

//
//
// Process Management
const closeOwoApplication = () => {
  io.emit('stop', 'Monitor Stopping, Cleanup in Progress');
};

const cleanup = () => {
  // TODO: sent kill command to socket io
  closeOwoApplication();
  scheduler.stop();
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
})

//
//
// Child Process Support
function run_script(command, args, callback) {
  const child = spawn(command, args)

  let scriptOutput = ""

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', function (data) {
    console.log(`[Child Process (${command}, stdout)] ${data.toString().trim()}`)
    data = data.toString()
    scriptOutput += data
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', function (data) {
    data = data.toString()
    scriptOutput += data
  })

  child.on('close', function (code) {
    callback(scriptOutput, code)
  })

  return child
}

//
//
// Scheduled Queue Job
let queueCanProcess = false;
const secondsToForcedRestartQueue = 30;
let lastProcessedMessageTime = undefined
const scheduler = new ToadScheduler()
const task = new Task('TriggerQueueProcessor', () => {
  const nothingHasBeenProcessedBefore = !lastProcessedMessageTime
  const theLastProcessedTriggerHasBeenLongAgo = lastProcessedMessageTime && Date.now() - lastProcessedMessageTime > 1000 * secondsToForcedRestartQueue

  if (nothingHasBeenProcessedBefore || theLastProcessedTriggerHasBeenLongAgo) {
    const currentTrigger = findNextTrigger();
    if (currentTrigger && queueCanProcess) {
      currentTrigger.trigger();
      currentTrigger.attempts++;

      lastProcessedMessageTime = Date.now();
      console.log(`[Queue (scheduled)] Triggering ${currentTrigger.triggeringId} attempt ${currentTrigger.attempts} at ${lastProcessedMessageTime}`)
    }
  }
})
const job = new SimpleIntervalJob({ seconds: 3 }, task)

//
//
// Application Startup
server.listen(PORT, function () {
  console.log(`Twitch auth sample listening on port ${PORT}!`)

  parseRedemptions();

  process.argv.forEach(arg => {
    switch (arg) {
      case '-d':
        console.log(`Dev Mode Enabled`)
        DEV_MODE = true;
        break;
      default:
        break;
    }
  })

  scheduler.addSimpleIntervalJob(job)
});
