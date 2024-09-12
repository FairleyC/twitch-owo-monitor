const configureDevHandlebars = (handlebars) => {
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
}

module.exports = { configureDevHandlebars };