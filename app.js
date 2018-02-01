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
let rooms = {}
io.on('connection', client => {
  console.log('Connected')
  client.on('message', (message, room, id) => {
    if (id === null) {
      client.to(room).emit('message', message, client.id)
    } else {
      client.to(id).emit('message', message, client.id)
    }
  })
  client.on('create or join', room => {
    console.log('Received request to create or join room ' + room)
    if (!rooms[room]) {
      rooms[room] = [client]
      client.join(room)
      client.emit('created', room)
    }
    else {
      rooms[room].push(client)
      client.join(room)
      client.emit('joined', room)
      client.to(room).emit('new peer', room)
    }
  })
  // client.on('disconnect', room => {
  //   let index = rooms[room].indexOf(client)
  //   if (index !== -1) {
  //     client.to(room).emit('disconnected', client)
  //     rooms[room].splice(index, 1)
  //   }
  // })
})
