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

module.exports = { getKeywords, resetKeywords, addKeyword, markKeywordInstanceAsTriggered, markKeywordInstanceAsErrored, generateKeywordHtml, findKeywordInstanceByTrigger };