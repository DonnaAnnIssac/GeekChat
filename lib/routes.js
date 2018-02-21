const express = require('express')
const routes = express.Router()
const path = require('path')
const passport = require('passport')

routes.get('/', (req, res) => {
  console.log("path /")
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

routes.get('/login', passport.authenticate('google', {
  scope: ['profile', 'openid']
}))

routes.get('/redirect', passport.authenticate('google', {failureRedirect: '/'}), (req, res) => {
  console.log("path /redirect")
  console.log('Successfully authenticated')
  //res.sendFile(path.join(__dirname, '../public/index.html'))
  res.redirect('/home')
})

routes.get('/home', isLoggedIn, (req, res) => {
  console.log("path /home")
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

routes.get('/logout', (req, res) => {
  //clear the session
  console.log("path /logout")
  res.redirect('/')
})

function isLoggedIn (req, res, next) {
  if (req.isAuthenticated()) {
    console.log("isAuthenticated success")
    next()
  } else {
    console.log("isAuthenticated failure")
    res.redirect('/')
  }
}

module.exports = routes
