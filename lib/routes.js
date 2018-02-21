const express = require('express')
const routes = express.Router()
const path = require('path')
const passport = require('passport')

routes.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

routes.get('/login', function (req, res, next) {
  if (req.isAuthenticated()) {
    res.redirect('/home')
  } else {
    next()
  }
}, passport.authenticate('google', {
  scope: ['profile', 'openid']
}))

routes.get('/redirect', passport.authenticate('google', {successRedirect: '/home', failureRedirect: '/'}))

routes.get('/home', (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(path.join(__dirname, '../public/index.html'))
  } else {
    res.redirect('/')
  }
})

routes.get('/logout', (req, res) => {
  //clear the session
  res.redirect('/')
})

routes.get('/api/me', function(req, res) {
  //only send name, picture,id as json
  //also send when user not logged in
  if (req.isAuthenticated()) {
    let response = {}
    response.id = req.user.id
    response.name = req.user.name.givenName
    response.picture = req.user.photos[0].value
    res.json(response)
  } else {
    res.json({status:"failure",error:"User not logged in"})
  }
})

module.exports = routes
