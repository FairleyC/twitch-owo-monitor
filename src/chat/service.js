const { loadEmotes } = require("../twitch/service");
const { generateCheermoteHtml, generateEmoteHtml, generateMentionHtml } = require("../twitch/service");
const { generateKeywordHtml, addKeyword } = require("../keywords/service");
const { isDevMode } = require("../utility/dev/service");
const { shouldKeywordTriggerRedemption, getRedemptionByKeyword } = require("../redemptions/service");
const { randomUUID } = require('crypto');
const { generateTrigger } = require("../utility/queue/trigger/service");

let messages = [];
const limit = 25;

const generateMessageHtml = (messageParts, userId) => {
    return messageParts.map(part => {
        switch (part.type) {
            case 'text':
                return `<span>${part.text}</span>`
            case 'cheermote':
                console.log(part.cheermote)
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
    const newDuration = 15;
    const refresh = 5;

    const message = {
        user: event.chatterDisplayName,
        color: event.color || '#888888',
        badges: event.badges,
        messageParts: event.messageParts,
        text: event.messageText,
        new: Math.ceil(newDuration / refresh),
    }

    if (isDevMode()) {
        processDevModeKeyword(message);
    } else {
        if (event.isCheer) {
            processCheerKeyword(message);
        }
    }
    event.messageParts.filter(part => part.type === 'emote')
      .map(part => loadEmotes(part.emote.owner_id))

    addMessage(message);
}

const processCheerKeyword = (message) => {
    const keywordInstances = message.messageParts
        .filter(part => part.type === 'cheermote')
        .filter(part => shouldKeywordTriggerRedemption(part.cheermote.prefix + part.cheermote.bits))
        .map(part => ({ id: randomUUID(), prefix: part.cheermote.prefix, number: part.cheermote.bits, triggered: false, description: getRedemptionByKeyword(part.cheermote.prefix + part.cheermote.bits).description }))

    if (keywordInstances.length > 0) {
        addKeyword(message, keywordInstances);
        keywordInstances.forEach(keywordInstance => generateTrigger(keywordInstance))
    }
}

const processDevModeKeyword = (message) => {
    const keywordName = "owo"
    const keywordPattern = new RegExp(String.raw`\b${keywordName}\d+\b`)
    if (keywordPattern.test(message.text)) {
        const keywordInstances = [];
        const reprocessedMessageParts = message.messageParts.reduce((acc, part) => {
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
                        keywordInstances.push({ id: randomUUID(), prefix: keywordName, number, triggered: false, description: "this is a test" })
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
        message.messageParts = reprocessedMessageParts;
        addKeyword(message, keywordInstances);
        keywordInstances.forEach(keywordInstance => generateTrigger(keywordInstance))
    }
}

module.exports = { generateMessageHtml, getMessages, addMessage, processMessage, resetMessages };