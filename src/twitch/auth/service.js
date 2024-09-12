var passport = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request = require('request');

const { StaticAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const { EventSubWsListener } = require('@twurple/eventsub-ws');

const scope = ['user_read', 'channel:read:redemptions', 'user:read:chat'];

let connection = {};

const connectToTwitch = async (accessToken) => {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const authProvider = new StaticAuthProvider(TWITCH_CLIENT_ID, accessToken, scope);
    const apiClient = new ApiClient({ authProvider });
    const listener = new EventSubWsListener({ apiClient });

    connection = { auth: authProvider, api: apiClient, listener: listener };

    return connection;
}

const getConnection = () => connection;
const isConnectedToTwitch = () => !!(connection && connection.listener && connection.api);

const checkAuthentication = (req, res, next) => {
    if (req.session && req.session.passport && req.session.passport.user) {
        return next();
    }
    const path = Buffer.from(req.originalUrl).toString('base64');
    res.redirect('/auth/twitch?state=' + path);
}

const includeRedirectInState = (req, res, next) => {
    passport.authenticate('twitch', { scope, state: req.query.state })(req, res, next);
}

const redirectAfterAuthentication = (req, res, next) => {
    const path = Buffer.from(req.query.state, 'base64').toString('ascii')
    passport.authenticate('twitch', { successRedirect: path, failureRedirect: '/' })(req, res, next);
}

const applyTwitchAuth = (app) => {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const TWITCH_SECRET = process.env.TWITCH_SECRET;
    const CALLBACK_URL = process.env.CALLBACK_URL;  // You can run locally with - http://localhost:3000/auth/twitch/callback

    app.use(passport.initialize());
    app.use(passport.session());

    OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
        // Override passport profile function to get user profile from Twitch API
        var options = {
            url: 'https://api.twitch.tv/helix/users',
            method: 'GET',
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Accept': 'application/vnd.twitchtv.v5+json',
                'Authorization': 'Bearer ' + accessToken
            }
        };

        request(options, function (error, response, body) {
            if (response && response.statusCode == 200) {
                done(null, JSON.parse(body));
            } else {
                done(JSON.parse(body));
            }
        });
    }

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, user);
    });

    passport.use('twitch', new OAuth2Strategy({
        authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
        tokenURL: 'https://id.twitch.tv/oauth2/token',
        clientID: TWITCH_CLIENT_ID,
        clientSecret: TWITCH_SECRET,
        callbackURL: CALLBACK_URL,
        state: false
    },
        function (accessToken, refreshToken, profile, done) {
            profile.accessToken = accessToken;
            profile.refreshToken = refreshToken;

            // Securely store user profile in your DB
            //User.findOrCreate(..., function(err, user) {
            //  done(err, user);
            //});

            done(null, profile);
        }
    ));
}

const isAuthenticated = (req) => {
    if (req && req.session && req.session.passport && req.session.passport.user) {
        return true;
    }
    return false;
}

module.exports = { applyTwitchAuth, connectToTwitch, getConnection, checkAuthentication, includeRedirectInState, redirectAfterAuthentication, isAuthenticated, isConnectedToTwitch };