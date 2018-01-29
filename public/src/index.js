let isInitiator

window.room = prompt("Enter room name:")

let socket = io.connect()

if (room !== "") {
  console.log('Message from client: Asking to join room ' + room)
  socket.emit('create or join', room)
}

socket.on('created', (room, clientId) => {
  isInitiator = true
})

socket.on('full', (room) => {
  console.log('Message from client: Room ' + room + ' is full :^(')
})

socket.on('ipaddr', (ipaddr) => {
  console.log('Message from client: Server IP address is ' + ipaddr)
})

socket.on('joined', (room, clientId) => {
  isInitiator = false
})

socket.on('log', (array) => {
  console.log(console, array)
})
