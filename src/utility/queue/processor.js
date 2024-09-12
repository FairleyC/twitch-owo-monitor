const { ToadScheduler, SimpleIntervalJob, Task } = require('toad-scheduler');
const { findNextTrigger } = require('./trigger/service');

let queueCanProcess = false;
let lastProcessedMessageTime = undefined
let scheduled = undefined;

const secondsToForcedRestartQueue = 30;

const startQueueProcessing = async () => {
    const scheduler = new ToadScheduler()
    const task = new Task('TriggerQueueProcessor', () => {
        const nothingHasBeenProcessedBefore = !lastProcessedMessageTime
        const theLastProcessedTriggerHasBeenLongAgo = lastProcessedMessageTime && Date.now() - lastProcessedMessageTime > 1000 * secondsToForcedRestartQueue

        if (nothingHasBeenProcessedBefore || theLastProcessedTriggerHasBeenLongAgo) {
            const currentTrigger = findNextTrigger();
            if (currentTrigger && queueCanProcess) {
                currentTrigger.trigger();
                currentTrigger.attempts++;

                lastProcessedMessageTime = Date.now();
                console.log(`[Queue (scheduled)] Triggering ${currentTrigger.triggeringId} attempt ${currentTrigger.attempts} at ${lastProcessedMessageTime}`)
            }
        }
    })
    const job = new SimpleIntervalJob({ seconds: 3 }, task)

    scheduler.addSimpleIntervalJob(job)
}

const stopQueueProcessing = () => {
    if (scheduled) {
        scheduled.stop();
    }
}

const getQueueStatus = () => queueCanProcess;

const enableQueue = () => queueCanProcess = true;
const disableQueue = () => queueCanProcess = false;

module.exports = { startQueueProcessing, stopQueueProcessing, getQueueStatus, enableQueue, disableQueue };