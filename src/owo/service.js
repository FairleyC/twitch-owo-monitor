const { getPathToRedemptionsFile } = require("../redemptions/service");
const run_script = require('../utility/run');
const { io } = require("../notifications/service");
const { markOwoApplicationAsStopped, markOwoApplicationAsRunning } = require("./status.service");

let owoProcess = undefined;
const sensationFileOption = `--sensation-file`

const closeOwoApplication = () => {
    io.emit('stop', 'Monitor Stopping, Cleanup in Progress');
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
        owoProcess = run_script('OwoApp.exe', [sensationFileOption, getPathToRedemptionsFile()], owoExitFunction)
    });

    // Send the signal to closed the process.
    closeOwoApplication();
}

const startOwoApplication = () => {
    owoProcess = run_script('OwoApp.exe', [sensationFileOption, getPathToRedemptionsFile()], owoExitFunction)
    markOwoApplicationAsRunning();
}

const owoExitFunction = (output, code) => {
    owoProcess = undefined;
    markOwoApplicationAsStopped();
    console.log("[Child Process (OwoApp.exe)] Exited with status:", code)
}

module.exports = { closeOwoApplication, restartOwoApplication, startOwoApplication };