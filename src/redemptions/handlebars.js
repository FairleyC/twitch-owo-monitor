var handlebars = require('handlebars');
const { getRedemptions } = require('./service');

const configureRedemptionsHandlebars = (handlebars) => {
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

        fetch('/app/redemptions', {
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
        fetch('/app/redemptions/' + uuid, {
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
        fetch('/api/redemptions/' + uuid).then(function(response) {
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
    const metadata = getRedemptions().metadataMap[redemption.uuid];

    if (!metadata.valid) {
      output = `<div class="s12 error-text small-text">Sensation was parsed and rejected.</div>`
    } else if (!metadata.usable) {
      output = `<div class="s12 secondary-text small-text">Sensation hasn't been sent to OwO yet.</div>`
    }

    return new handlebars.SafeString(output);
  });
}

var redemptionsTableTemplate = handlebars.compile(`
    {{> redemptionsTablePartial}}
`);

module.exports = { configureRedemptionsHandlebars, redemptionsTableTemplate };