const { spawn } = require('child_process');

function run_script(command, args, callback) {
    const child = spawn(command, args)
  
    let scriptOutput = ""
  
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function (data) {
      console.log(`[Child Process (${command}, stdout)] ${data.toString().trim()}`)
      data = data.toString()
      scriptOutput += data
    })
  
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', function (data) {
      data = data.toString()
      scriptOutput += data
    })
  
    child.on('close', function (code) {
      callback(scriptOutput, code)
    })
  
    return child
}

module.exports = run_script;