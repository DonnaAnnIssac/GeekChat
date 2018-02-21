const express = require('express')
// const uuid = require('uuid/v4')
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

/*
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
    userProfile = undefined
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
  client.on('disconnect', () => {
    delete clients[client.id]
    for (let room in rooms) {
      rooms[room] = rooms[room].filter((id) => id !== client.id)
    }
    io.emit('disconnected', client.id)
  })
})
*/