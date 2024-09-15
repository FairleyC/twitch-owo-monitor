const { getMessages } = require("../../chat/service");
const { getKeywords } = require("../../keywords/service");
const { getRedemptions } = require("../../redemptions/service");
const { isDevMode } = require("../../utility/dev/service");
const { getQueueStatus } = require("../../queue/processor");
const handlebars = require('handlebars');

var channelTemplate = handlebars.compile(`
    <html>
      <head>
        <link href="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.css" rel="stylesheet">
        <script type="module" src="https://cdn.jsdelivr.net/npm/beercss@3.6.12/dist/cdn/beer.min.js"></script>
        <script type="module" src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.2/dist/cdn/material-dynamic-colors.min.js"></script>
        <title>Channel Feed: {{channel}}</title>
      </head>
      <body class="dark">
        <header class="no-padding">
          <nav class="primary">
            <a href="https://www.twitch.tv/{{channel}}" target="_blank">
              <img src="https://cdn.icon-icons.com/icons2/3042/PNG/512/twitch_logo_icon_189276.png" width="64" height="64" alt="Twitch Logo" />
            </a>
            <h5 class="max bold">Twitch Monitor</h5>
            {{#if options.devMode}}
              {{> developmentToolbar}}
            {{/if}}
          </nav>
          <div class="error no-margin center-align bold" id="error" style="display: none">No Error Found</div>
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

const channelTemplateOptions = (channel, userId) => { return { channel, messages: getMessages(), keywords: getKeywords(), refresh: 5, userId, redemptions: getRedemptions(), queue: getQueueStatus(), options: { devMode: isDevMode() } } }

module.exports = { channelTemplate, channelTemplateOptions };