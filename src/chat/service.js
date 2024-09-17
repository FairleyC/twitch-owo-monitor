const { generateCheermoteHtml, generateEmoteHtml, generateMentionHtml, loadEmotes } = require("../twitch/service");
const { generateKeywordHtml, processMessageForKeywords } = require("../keywords/service");

let messages = [];
const limit = 25;

const generateMessageHtml = (messageParts, userId) => {
    return messageParts.map(part => {
        switch (part.type) {
            case 'text':
                return `<span>${part.text}</span>`
            case 'cheermote':
                return generateCheermoteHtml(part.cheermote)
            case 'emote':
                return generateEmoteHtml(part.emote, part.text)
            case 'mention':
                return generateMentionHtml(part.mention, userId, part.text)
            case 'keyword':
                return generateKeywordHtml(part.keyword)
            default:
                return ``
        }
    }).join(' ')
}

const getMessages = () => messages;
const addMessage = (message) => {
    messages.unshift(message)
    messages.length = limit
}
const resetMessages = () => messages = [];

const processMessage = async (event) => {
    const message = {
        user: event.chatterDisplayName,
        color: event.color || '#888888',
        badges: event.badges,
        messageParts: event.messageParts,
        text: event.messageText,
        when: Date.now()
    }

    processMessageForKeywords(message);

    event.messageParts.filter(part => part.type === 'emote')
        .map(part => loadEmotes(part.emote.owner_id))

    addMessage(message);
}

module.exports = { generateMessageHtml, getMessages, addMessage, processMessage, resetMessages };