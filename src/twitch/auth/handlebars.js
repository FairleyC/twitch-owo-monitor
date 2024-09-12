var handlebars = require('handlebars');

var authTemplate = handlebars.compile(`
    <html><head><title>Twitch Auth Sample</title></head>
    <table>
        <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
        <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
        <tr><th>Display Name</th><td>{{display_name}}</td></tr>
        <tr><th>Bio</th><td>{{bio}}</td></tr>
        <tr><th>Image</th><td>{{logo}}</td></tr>
    </table></html>
  `);

module.exports = { authTemplate };