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
  callBtn.disabled = true
  handshake.isInitiator = true
  handshake.onCall = true
  sendMessage('call invitation')
})
hangBtn.addEventListener('click', () => {
  stop()
  sendMessage('bye')
})
document.querySelector('#newRoom').addEventListener('click', toggleClientList)
document.querySelector('#newGroup').addEventListener('click', createGroup)
document.getElementById('accept').addEventListener('click', () => {
  callBtn.disabled = true
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
      // clientDiv.id = client
      clientDiv.addEventListener('click', () => updateCurrOrGroup(client))
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
    hangBtn.disabled = false
    if (handshake.localStream === null) {
      handshake.getLocalStream(onLocalStream)
    } else {
      sendMessage('got user media')
    }
  } else if (message === 'decline call') {
    hangBtn.disabled = true
    callBtn.disabled = false
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
  if (handshake.peersInCurrRoom.length === 1) {
    stop()
  } else {
    removePeer(id)
  }
}

function stop () {
  hangBtn.disabled = true
  handshake.onCall = false
  callBtn.disabled = false
  for (let id in handshake.pcDictionary) {
    removePeer(id)
  }
  document.querySelector('#localVideo').srcObject = null
}

function removePeer (id) {
  let disconnectedPeer = document.getElementById(id)
  disconnectedPeer.srcObject = null
  document.querySelector('#remoteFeeds').removeChild(disconnectedPeer)
  handshake.pcDictionary[id].close()
  delete handshake.pcDictionary[id]
  handshake.peersInCurrRoom.splice(handshake.peersInCurrRoom.indexOf(id), 1)
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
