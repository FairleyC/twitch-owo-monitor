const { markKeywordInstanceAsTriggered, markKeywordInstanceAsErrored } = require("../../keywords/service");
const { getSocketIoServer } = require("../../notifications/service");

let triggers = [];
let triggerBeingProcessed = false;
const maxRetries = 3;

const findNextTrigger = () => {
    let currentIndex = 0;
    while (currentIndex < triggers.length) {
        const currentTrigger = triggers[currentIndex];
        const shouldRemoveTrigger = currentTrigger.attempts >= maxRetries;
        if (shouldRemoveTrigger) {
            currentTrigger.failure(`Attempt Limit of ${maxRetries} Reached.`);
            triggers.shift();
        } else {
            return currentTrigger;
        }
        currentIndex++;
    }
    return undefined;
}

const generateTrigger = (keywordDetails) => {
    let attempts = 0;
    const trigger = {
        triggeringId: keywordDetails.id,
        triggeringWord: keywordDetails.prefix + keywordDetails.number,
        trigger: () => {
            attempts++;
            triggerBeingProcessed = true;
            getSocketIoServer().emit('trigger', `${keywordDetails.prefix}${keywordDetails.number}`, keywordDetails.id)
        },
        resolution: () => {
            triggerBeingProcessed = false;
            markKeywordInstanceAsTriggered(keywordDetails.id);
        },
        failure: (error) => {
            triggerBeingProcessed = false;
            console.error(`[Error] Trigger (${keywordDetails.id}) failed to resolve: ${error}`)
            markKeywordInstanceAsErrored(keywordDetails.id);
        },
        attempts: attempts
    }

    triggers.push(trigger)
}

const getTriggers = () => triggers;

const isTriggerBeingProcessed = () => triggerBeingProcessed;

const processTriggerResponse = (triggeringId) => {
    console.log(`[Socket] Trigger Response: ${triggeringId}`)
    triggers = triggers.filter(trigger => {
        if (trigger.triggeringId === triggeringId) {
            trigger.resolution()
            return false;
        }
        return true;
    });
    currentTrigger = findNextTrigger();
    if (currentTrigger && queueCanProcess) {
        currentTrigger.trigger();
        currentTrigger.attempts++;
        console.log(`[Queue (socket)] Triggering ${currentTrigger.triggeringId} attempt ${currentTrigger.attempts} at ${Date.now()}`)
    }
}

const processTriggerError = (error) => {
    switch (error.type) {
        case 'Disconnected':
            owoConnection = false;
            queueCanProcess = false;
            break;
        case 'Unrecognized':
            // For right now we will just retry them but we should probably mark the redemption as invalid.
            // This might happen if a redemption is added after the OwO application is launched.
            // I could avoid this by preventing detection until restart and then flagging all new sensations as valid.
            break;
        default:
            // Do nothing for now
            break;
    }
}

module.exports = { generateTrigger, findNextTrigger, getTriggers, processTriggerError, processTriggerResponse, isTriggerBeingProcessed };