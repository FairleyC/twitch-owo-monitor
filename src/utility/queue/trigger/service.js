const { io } = require("../../../notifications/service");

let triggers = [];

const findNextTrigger = () => {
    triggerCount = triggers.length;
    currentIndex = 0;
    while (currentIndex < triggerCount) {
        const currentTrigger = triggers[currentIndex];
        const shouldRemoveTrigger = currentTrigger.attempts >= 3;
        if (shouldRemoveTrigger) {
            currentTrigger.failure('Attempt Limit of 3 Reached.');
            triggers.shift();
        } else {
            return currentTrigger;
        }
    }
    return undefined;
}

const generateTrigger = (keywordDetails) => {
    const trigger = {
        triggeringId: keywordDetails.id,
        trigger: () => {
            io.emit('trigger', `${keywordDetails.prefix}${keywordDetails.number}`, keywordDetails.id)
        },
        resolution: () => {
            markKeywordInstanceAsTriggered(keywordDetails.id);
        },
        failure: (error) => {
            console.error(`[Error] Trigger (${keywordDetails.id}) failed to resolve: ${error}`)
            markKeywordInstanceAsTriggered(keywordDetails.id);
        },
        attempts: 0
    }

    triggers.push(trigger)
}

const getTriggers = () => triggers;



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

module.exports = { generateTrigger, findNextTrigger, getTriggers, processTriggerError, processTriggerResponse };