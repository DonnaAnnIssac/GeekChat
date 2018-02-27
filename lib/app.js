const express = require('express')
const uuid = require('uuid/v4')
const routes = require('./routes')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20')
const session = require('express-session')
const dotenv = require('dotenv')
dotenv.load()
let userProfiles = {}
const app = express()

app.use(
  session({
    secret: 'shhhhhhhhh',
    resave: true,
    saveUninitialized: true
  })
)
app.use(passport.initialize())
app.use(passport.session())

passport.use(
  new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  }, (accessToken, refreshToken, profile, done) => {
    userProfiles[profile.id] = profile
    return done(null, profile)
  })
)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser((id, done) => {
  done(null, userProfiles[id])
})

app.use('/', routes)
app.use(express.static('node_modules/socket.io-client'))
app.use(express.static('public'))

const server = require('http').createServer(app)
server.listen(process.env.PORT, '0.0.0.0', () => {
})

const io = require('socket.io')(server)
let clients = {}
let clientSocks = {}
let rooms = {}

io.on('connection', client => {
  console.log('Connected')
  client.on('active', (id, name) => {
    clients[id] = name
    clientSocks[id] = client.id
    client.emit('clients', clients)
    client.broadcast.emit('new peer', clients)
  })
  client.on('message', (message, room, id) => {
    let clientid
    for (let clientSockId in clientSocks) {
      if (clientSocks[clientSockId] === client.id) {
        clientid = clientSockId
      }
    }
    if (!id) {
      client.to(room).emit('message', message, clientid)
    } else {
      client.to(clientSocks[id]).emit('message', message, clientid)
    }
  })
  client.on('create', members => {
    let room = uuid()
    rooms[room] = members
    client.join(room)
    client.emit('created', room, members)
  })
  client.on('init', (room, id) => {
    io.sockets.connected[clientSocks[id]].emit('init', room, rooms[room])
  })
  client.on('join', room => {
    client.join(room)
  })
  client.on('group chat', (msg, ids, room, from) => {
    ids.forEach(id => {
      io.sockets.connected[clientSocks[id]].emit('group chat text', rooms[room], msg, from, room)
    })
  })
  client.on('call', (room) => {
    client.emit('members', rooms[room])
  })
  client.on('disconnect', () => {
    let clientid
    for (let clientId in clients) {
      for (let id in clientSocks) {
        if (clientId === id && clientSocks[id] === client.id) {
          clientid = clientId
          delete clientSocks[id]
          delete clients[clientId]
        }
      }
    }
    for (let room in rooms) {
      rooms[room] = rooms[room].filter((id) => id !== clientid)
    }
    io.emit('disconnected', clientid)
  })
})
