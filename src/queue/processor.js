const { ToadScheduler, SimpleIntervalJob, Task } = require('toad-scheduler');
const { findNextTrigger, isTriggerBeingProcessed } = require('./trigger/service');

let queueCanProcess = false;
let scheduler = undefined;
let lastProcessedMessageTime = undefined
const triggerTimeout = 5;

const startQueueProcessing = async () => {
    scheduler = new ToadScheduler()
    const task = new Task('TriggerQueueProcessor', () => {
        const triggerTimeoutHasElapsed = Date.now() - lastProcessedMessageTime > triggerTimeout * 1000;
        if (!isTriggerBeingProcessed() || triggerTimeoutHasElapsed) {
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
    if (scheduler) {
        scheduler.stop();
    }
}

const getQueueStatus = () => queueCanProcess;

const enableQueue = () => queueCanProcess = true;
const disableQueue = () => queueCanProcess = false;

module.exports = { startQueueProcessing, stopQueueProcessing, getQueueStatus, enableQueue, disableQueue };