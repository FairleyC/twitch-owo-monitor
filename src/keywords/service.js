const { isDevMode } = require("../utility/dev/service");
const { generateTrigger, cancelTrigger } = require("../queue/trigger/service");
const { shouldKeywordTriggerRedemption, getRedemptionByKeyword } = require("../redemptions/service");
const { randomUUID } = require('crypto');

let keywords = [];

const getKeywords = () => keywords;

const resetKeywords = () => {
    keywords = [];
}

const addKeyword = (message, instances) => {
    keywords.unshift(Object.assign({}, message, { type: 'keyword', keywords: instances, messageParts: message.messageParts }))
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

const markKeywordInstanceAsErrored = (triggeringId) => {
    const keywordInstance = findKeywordInstanceByTrigger(triggeringId);
    if (keywordInstance) {
        keywordInstance.triggered = true;
        keywordInstance.errored = true;
    }
}

const generateKeywordHtml = (keyword) => {
    return `<span style="color: gold">⚡${keyword.number}</span>`
}

const generateMessagePartsForDevModeKeywords = (message) => {
    const keywordName = "owo"
    const keywordPattern = new RegExp(String.raw`\b${keywordName}\d+\b`)
    if (keywordPattern.test(message.text)) {
        const reprocessedMessageParts = message.messageParts.reduce((acc, part) => {
            if (part.type === 'text' && keywordPattern.test(part.text)) {
                acc.push.apply(acc, processDevModeMessagePart(part))
            } else {
                acc.push(part)
            }
            return acc
        }, [])
        return reprocessedMessageParts;
    }
}

const processDevModeMessagePart = (part) => {
    const words = part.text.split(' ')

    // Break words apart into an array of text parts (newText)
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

    // If there is any leftover text, add it to the newText array
    if (currentText.length > 0) {
        newText.push(currentText.join(' '))
    }

    // Go through the newText array and generate parts for each text part
    const parts = [];
    const digits = /\d+/
    newText.forEach(text => {
        if (keywordPattern.test(text)) {
            const [number] = text.match(digits)
            parts.push(Object.assign({}, part, { type: 'keyword', text, prefix: keywordName, number, description: "This is a dev mode test." }))
        } else {
            parts.push(Object.assign({}, part, { text }))
        }
    });
    return parts;
}

const generateMessagePartsForKeywords = (message) => {
    return message.messageParts.map(part => {
        if (part.type === 'cheermote' && shouldKeywordTriggerRedemption(part.cheermote.prefix + part.cheermote.bits)) {
            const description = getRedemptionByKeyword(part.cheermote.prefix + part.cheermote.bits).description;
            return Object.assign({}, part, { id: randomUUID(), type: 'keyword', prefix: part.cheermote.prefix, number: part.cheermote.bits, description })
        }
        return part;
    })
}

const findKeywordInstances = (parts) => {
    return parts.filter(part => part.type === 'keyword');
}

const processMessageForKeywords = (message) => {
    let parts;
    if (isDevMode()) {
        parts = generateMessagePartsForDevModeKeywords(message)
    } else {
        parts = generateMessagePartsForKeywords(message)
    }

    const instances = findKeywordInstances(parts);
    if (instances.length > 0) {
        addKeyword(message, instances);
        instances.forEach(keywordInstance => generateTrigger(keywordInstance, () => markKeywordInstanceAsTriggered(keywordInstance.id), () => markKeywordInstanceAsErrored(keywordInstance.id)));
    }
}

const retriggerKeywordInstance = (instance) => {
    instance.triggered = false;
    instance.errored = false;
    generateTrigger(instance, () => markKeywordInstanceAsTriggered(instance.id), () => markKeywordInstanceAsErrored(instance.id));
}

const cancelKeywordInstance = (instance) => {
    instance.triggered = true;
    cancelTrigger(instance.id);
}

const generateTestMessageForRedemption = (redemption) => {
    const text = `This keyword was manually triggered.`
    const message = {
        user: "Twitch Monitor",
        color: '#cfbcff',
        badges: [],
        messageParts: [{type: 'text', text}, {type: 'cheermote', text: `${redemption.prefix}${redemption.cost}`, cheermote: {prefix: redemption.prefix, bits: redemption.cost, tier: 1}}],
        text,
        when: Date.now(),
    }

    return message;
}



module.exports = { getKeywords, resetKeywords, addKeyword, markKeywordInstanceAsTriggered, markKeywordInstanceAsErrored, generateKeywordHtml, findKeywordInstanceByTrigger, processMessageForKeywords, retriggerKeywordInstance, cancelKeywordInstance, generateTestMessageForRedemption };