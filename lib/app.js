const express = require('express')
const uuid = require('uuid/v4')
const routes = require('./routes')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session')
const dotenv = require('dotenv')
let userProfile
dotenv.load()

passport.use(
  new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (accessToken, refreshToken, profile, done) => {
    userProfile = profile
    return done(null, profile)
  })
)

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(
  session({
    secret: 'shhhhhhhhh',
    resave: true,
    saveUninitialized: true
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.use('/', routes)
app.use(express.static('node_modules/socket.io-client'))
app.use(express.static('public'))

// Handle auth failure error messages
app.use((req, res, next) => {
  if (req && req.query && req.query.error) {
    req.flash('error', req.query.error)
  }
  if (req && req.query && req.query.error_description) {
    req.flash('error_description', req.query.error_description)
  }
  next()
})

// Check logged in
app.use((req, res, next) => {
  res.locals.loggedIn = false
  if (req.session.passport && typeof req.session.passport.user !== 'undefined') {
    res.locals.loggedIn = true
  }
  next()
})

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

const server = require('http').createServer(app)
server.listen(9999, () => {
  console.log('Listening on 9999')
})

const io = require('socket.io')(server)
let clients = {}
let rooms = {}

io.on('connection', client => {
  console.log('Connected')
  if (userProfile !== undefined) {
    clients[client.id] = {
      clientName: userProfile.name.givenName,
      status: 'active',
      picture: userProfile.photos[0].value
    }
    client.emit('active', client.id, clients)
    client.broadcast.emit('new peer', clients)
  }
  client.on('message', (message, room, id) => {
    if (id === null) {
      client.to(room).emit('message', message, client.id)
    } else {
      client.to(id).emit('message', message, client.id)
    }
  })
  client.on('create', id => {
    let room = uuid()
    rooms[room] = [client.id]
    client.join(room)
    client.emit('created', room, id)
  })
  client.on('init', (room, id) => {
    io.sockets.connected[id].emit('init', room)
  })
  client.on('join', room => {
    rooms[room].push(client.id)
    client.join(room)
    client.to(room).emit('accepted', rooms[room])
  })
  client.on('group chat', (msg, ids, room) => {
    ids.forEach(id => {
      io.sockets.connected[id].emit('group chat text', rooms[room], msg, client.id, room)
    })
  })
  client.on('disconnect', (room, id) => {
    if (rooms[room]) {
      let index = rooms[room].indexOf(id)
      if (index !== -1) {
        client.to(room).emit('disconnected', client)
        rooms[room].splice(index, 1)
      }
    }
  })
})
