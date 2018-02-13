import { handshake } from './handshake.js'
let socket = io.connect()
let myId, allClients = {}
let listOfClients = document.querySelector('#clientsList')
let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let callBtn = document.getElementById('callButton')
let hangBtn = document.getElementById('hangupButton')
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let grpMembers = []

sendBtn.disabled = true
callBtn.disabled = true
hangBtn.disabled = true

sendBtn.addEventListener('click', sendMsgOverChannel)
callBtn.addEventListener('click', () => {
  hangBtn.disabled = false
  handshake.isInitiator = true
  handshake.onCall = true
  sendMessage('call invitation')
})
document.querySelector('#newRoom').addEventListener('click', toggleClientList)
document.querySelector('#newGroup').addEventListener('click', createGroup)
document.getElementById('accept').addEventListener('click', () => {
  callBtn.disabled = false
  sendBtn.disabled = false
  hangBtn.disabled = false
  document.getElementById('callInvite').style.display = 'none'
  handshake.onCall = true
  sendMessage('accept call', handshake.currClient)
})
document.getElementById('decline').addEventListener('click', () => {
  document.getElementById('callInvite').style.display = 'none'
  sendMessage('decline call', handshake.currClient)
})

socket.on('active', (id, name, clientsList) => {
  console.log('Active')
  myId = id
  document.getElementById('welcome').innerText = name
  updateClientList(clientsList)
})

function createGroup () {
  if (!handshake.group) {
    handshake.group = true
    grpMembers = []
    document.querySelector('#newGroup').innerText = 'Create'
    toggleClientList()
  } else {
    document.querySelector('#newGroup').innerText = 'New Group'
    toggleClientList()
    createRoom(grpMembers)
  }
}
function updateClientList (clientsList) {
  for (let client in clientsList) {
    if (!allClients.hasOwnProperty(client) && client !== myId) {
      let clientDiv = document.createElement('div')
      clientDiv.innerText = clientsList[client].clientName
      clientDiv.id = client
      clientDiv.addEventListener('click', () => updateCurrOrGroup(clientDiv.id))
      listOfClients.appendChild(clientDiv)
      listOfClients.style.display = 'none'
      allClients[client] = clientsList[client].clientName
    }
  }
}

function toggleClientList () {
  listOfClients.style.display = (listOfClients.style.display === 'block') ? 'none' : 'block'
}

function updateCurrOrGroup (id) {
  if (!handshake.group) {
    handshake.currClient = id
    toggleClientList()
    createRoom(id)
  } else {
    grpMembers.push(id)
  }
}

function createRoom (id) {
  socket.emit('create', id)
}

socket.on('new peer', clients => {
  updateClientList(clients)
})

socket.on('created', (room, id) => {
  updateChatHead(id)
  console.log('Room ', room)
  handshake.currRoom = room
  if (handshake.group) {
    id.forEach(client => socket.emit('init', room, client))
  } else {
    socket.emit('init', room, id)
  }
  sendBtn.disabled = false
  callBtn.disabled = false
})

socket.on('init', room => {
  handshake.isInitiator = false
  handshake.currRoom = room
  console.log('Room ', room)
  socket.emit('join', room)
})
socket.on('chat text', (msg, from) => {
  chatTextHandler(from, [from], msg)
})

socket.on('group chat text', (clients, msg, from) => {
  chatTextHandler(from, clients, msg)
})

function chatTextHandler (from, clients, msg) {
  sendBtn.disabled = false
  callBtn.disabled = false
  handshake.currClient = from
  updateChatHead(clients)
  acceptIncomingMsg(msg)
}

socket.on('accepted', clients => {
  handshake.isInitiator = true
})

function updateChatHead (client) {
  if (Array.isArray(client)) {
    let str = client.map(id => allClients[id]).join(' ')
    document.querySelector('#chatHead').innerText = str
  } else {
    console.log('Updating chat head')
    document.querySelector('#chatHead').innerText = allClients[client]
  }
}

function acceptIncomingMsg (message) {
  let msg = document.createElement('div')
  msg.innerText = message
  incomingMsg.appendChild(msg)
}

function sendMessage (message, id) {
  socket.emit('message', message, handshake.currRoom, id)
}

socket.on('message', (message, id) => {
  if (message === 'got user media' && handshake.onCall) {
    handshake.onUsrMedia(id, message, onLocalStream, sendMessage, onRemoteStream)
  } else if (message.type === 'offer' && handshake.peersInCurrRoom.indexOf(id) === -1) {
    handshake.onOffer(id, message, sendMessage, onRemoteStream)
  } else if (message.type === 'answer') {
    handshake.onAnswer(id, message)
  } else if (message.type === 'candidate') {
    handshake.onCandidate(id, message)
  } else if (message === 'bye') {
    handleRemoteHangup(id)
  } else if (message === 'call invitation') {
    handshake.isInitiator = false
    callBtn.disabled = true
    document.getElementById('callInvite').style.display = 'block'
    document.getElementById('caller').innerText = allClients[id] + ' is calling'
    this.currClient = id
  } else if (message === 'accept call' && handshake.onCall) {
    if (handshake.localStream === null) {
      handshake.getLocalStream(onLocalStream)
    } else {
      sendMessage('got user media')
    }
  } else if (message === 'decline call') {
    hangBtn.disabled = true
    alert('Call declined')
  }
})

function onLocalStream (localStream) {
  localVideo.srcObject = localStream
  sendMessage('got user media')
}

function onRemoteStream (remoteStream, id) {
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.setAttribute('id', id)
  remoteVideo.srcObject = remoteStream
  remoteFeeds.appendChild(remoteVideo)
}

function handleRemoteHangup (id) {
  console.log('Session terminated.')
  // socket.emit('disconnect', currRoom)
  stop(id)
  this.isInitiator = false
}

function stop (id) {
  this.pcDictionary[id].close()
  let disconnectedPeer = document.getElementById(id)
  disconnectedPeer.parentNode.removeChild(disconnectedPeer)
}

window.onbeforeunload = function () {
  sendMessage('bye')
}

function sendMsgOverChannel () {
  acceptIncomingMsg(sendData.value)
  if (handshake.currClient !== undefined) {
    socket.emit('chat', sendData.value, handshake.currClient, handshake.currRoom)
  } else {
    socket.emit('group chat', sendData.value, grpMembers, handshake.currRoom)
  }
}
