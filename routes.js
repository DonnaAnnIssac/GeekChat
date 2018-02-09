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
  redirectUri: 'http://localhost:9999/home',
  responseType: 'code',
  audience: 'https://' + process.env.AUTH0_DOMAIN + '/',
  scope: 'openid profile'}),
  (req, res) => {
    res.redirect('/home')
  }
)
routes.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'))
})

routes.get('/logout', (req, res) => {
  res.redirect('/')
})
// add logout route
module.exports = routes
