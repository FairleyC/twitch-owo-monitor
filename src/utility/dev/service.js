let devMode = process.env.DEV_MODE || false;

const isDevMode = () => devMode;

const enableDevMode = () => { 
    devMode = true
    console.log(`Dev Mode Enabled`)
}

if (isDevMode()) {
    console.log(`Dev Mode Enabled`)
}

module.exports = { isDevMode, enableDevMode };