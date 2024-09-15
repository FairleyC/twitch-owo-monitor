const { getSocketIoServer } = require("../notifications/service");
const { stopQueueProcessing } = require("../queue/processor");
const { getPathToRedemptionsFile } = require("../redemptions/service");
const run_script = require('../utility/run');

let owoProcess = undefined;
let owoConnection = false;

const sensationFileOption = `--sensation-file`

const closeOwoApplication = () => {
    getSocketIoServer().emit('stop', 'Monitor Stopping, Cleanup in Progress');
};

const restartOwoApplication = () => {
    const timeout = 10 * 1000;
    owoTimeout = setTimeout(() => {
        console.log('[Node] OwO Timeout Reached');
        owoProcess.kill('SIGKILL');
    }, timeout);

    // Setup exit listener to restart once the process exits.
    owoProcess.on('exit', () => {
        console.log('[Node] OwO Restarting');
        clearTimeout(owoTimeout);
        setTimeout(startOwoApplication, 1000);
    });

    // Send the signal to closed the process.
    closeOwoApplication();
}

const startOwoApplication = () => {
    owoProcess = run_script('OwoApp.exe', [sensationFileOption, getPathToRedemptionsFile()], owoExitFunction)
}

const owoExitFunction = (output, code) => {
    owoProcess = undefined;
    owoConnection = false;
    stopQueueProcessing();
    console.log("[Child Process (OwoApp.exe)] Exited with status:", code)
}

const markVestAsConnected = () => owoConnection = true;
const markVestAsDisconnected = () => owoConnection = false;

const isOwoApplicationRunning = () => !!owoProcess;
const isOwoVestConnected = () => owoConnection;

module.exports = { closeOwoApplication, restartOwoApplication, startOwoApplication, markVestAsConnected, markVestAsDisconnected, isOwoApplicationRunning, isOwoVestConnected };