var handlebars = require('handlebars');
const { generateBadgeHtml } = require('../twitch/service');
const { generateMessageHtml } = require('../chat/service');

const configureKeywordsHandlebars = (handlebars) => {
    handlebars.registerPartial('keywordsStreamPartial', `
        <div class="s6" id="keywords">
          {{ placeholderIfEmpty "keywords" keywords }}
          {{#each keywords}}
            {{keywordMessage this userId}}
          {{/each}}
        </div>
      `);

    handlebars.registerHelper('keywordMessage', function (keyword, userId) {
        let output = '';
        const badgeString = generateBadgeHtml(keyword.badges)
        const content = generateMessageHtml(keyword.messageParts, userId)

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
            const description = keyword.description
            line += `<hr class="s12"><div class="s3 middle-align center-align"><span style="color: gold">⚡${keyword.number}</span></div><div class="s6 middle-align left-align ${keyword.errored ? 'error-text' : ''}">${description}</div><div class="s3">${buttons}</div>`
        })

        let classValue = { color: "", size: "" };
        if (keyword.new) {
            classValue.color = 'surface-bright'
            classValue.size = 'large-text'
        }

        output = `<article class="${classValue.color} ${classValue.size}"><div class="grid">${line}</div></article>`

        return new handlebars.SafeString(output);
    });
}

var keywordsStreamTemplate = handlebars.compile(`
    {{> keywordsStreamPartial}}
  `);

module.exports = { configureKeywordsHandlebars, keywordsStreamTemplate };