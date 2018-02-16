const express = require('express')
const routes = express.Router()
const path = require('path')
const passport = require('passport')

routes.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

routes.get('/login', passport.authenticate('google', {
  scope: ['profile', 'openid']
}))

routes.get('/redirect', passport.authenticate('google'), (req, res) => {
  if (!req.user) {
    throw new Error('user null')
  }
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

routes.get('/logout', (req, res) => {
  res.redirect('/')
})

module.exports = routes
