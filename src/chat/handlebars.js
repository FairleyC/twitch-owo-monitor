
let chatStreamTemplate;

const configureChatHandlebars = (handlebars) => {
    handlebars.registerPartial('chatStreamPartial', `
        <div class="s6" id="chat">
          {{ placeholderIfEmpty "messages" messages }}
          {{#each messages}}
            {{chatMessage this userId}}
          {{/each}}
        </div>
      `);
      
      handlebars.registerHelper('chatMessage', function (message, userId) {
        let output = '';
        const badgeString = generateBadgeHtml(message.badges)
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

      chatStreamTemplate = handlebars.compile(`
        {{> chatStreamPartial}}
      `);
}

module.exports = { configureChatHandlebars, chatStreamTemplate };