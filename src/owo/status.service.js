let owoConnection = false;
let owoProcess = false;

const markVestAsConnected = () => owoConnection = true;
const markVestAsDisconnected = () => owoConnection = false;
const markOwoApplicationAsRunning = () => owoProcess = true;
const markOwoApplicationAsStopped = () => owoProcess = false;
const isOwoApplicationRunning = () => owoProcess;
const isOwoVestConnected = () => owoConnection;

module.exports = { markVestAsConnected, markVestAsDisconnected, markOwoApplicationAsRunning, markOwoApplicationAsStopped, isOwoApplicationRunning, isOwoVestConnected };