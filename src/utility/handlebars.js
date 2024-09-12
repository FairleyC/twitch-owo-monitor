const configureUtilityHandlebars = (handlebars) => {
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

    handlebars.registerHelper('placeholderIfEmpty', function (type, list) {
        if (list.length === 0) {
            return new handlebars.SafeString(`<article><i class="tiny">${infoSvg}</i> <span>No ${type} to display.</span></article>`);
        }
        return '';
    });
}

const infoSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`

module.exports = { configureUtilityHandlebars, infoSvg };