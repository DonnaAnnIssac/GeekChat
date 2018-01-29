const os = require('os')
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

app.use(express.static('./node_modules/socket.io-client'))
app.use(express.static('./public'))

server.listen(9999, () => {
  console.log('Listening on 9999')
})

let clientCounter = 0
io.on('connection', client => {
  console.log('Connected')
  client.on('message', message => {
    client.to('test').emit('message', message)
  })
  client.on('create or join', (room) => {
    console.log('Received request to create or join room ' + room)
    let numClients = ++clientCounter
    console.log('Room ' + room + ' now has ' + numClients + ' client(s)')
    if (numClients === 1) {
      client.join(room)
      console.log('Client ID ' + client.id + ' created room ' + room)
      client.emit('created', room, client.id)
    } else if (numClients === 2) {
      console.log('Client ID ' + client.id + ' joined room ' + room)
      io.sockets.in(room).emit('join', room)
      client.join(room)
      client.emit('joined', room, client.id)
      io.sockets.in(room).emit('ready')
    } else { // max two clients
      client.emit('full', room)
    }
  })
  client.on('ipaddr', () => {
    let ifaces = os.networkInterfaces()
    for (let dev in ifaces) {
      ifaces[dev].forEach((details) => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          client.emit('ipaddr', details.address)
        }
      })
    }
  })
})
