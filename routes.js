const express = require('express')
const routes = express.Router()
const path = require('path')
const passport = require('passport')

routes.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/login.html'))
})

routes.get('/login', passport.authenticate('auth0', {
  clientID: process.env.AUTH0_CLIENT_ID,
  domain: process.env.AUTH0_DOMAIN,
  redirectUri: process.env.AUTH0_CALLBACK_URL,
  responseType: 'code',
  scope: 'openid profile'
  }),
  (req, res) => {
    res.redirect('/home')
  }
)

routes.get('/home', passport.authenticate('auth0', {failureRedirect: '/'}),
  (req, res) => {
    if (!req.user) {
      throw new Error('user null')
    }
    res.sendFile(path.join(__dirname, '/public/index.html'))
})

routes.get('/logout', (req, res) => {
  res.redirect('/')
})

module.exports = routes
