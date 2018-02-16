import { handshake } from './handshake.js'
let socket = io.connect()
let myId, myName, allClients = {}
let listOfClients = document.querySelector('#clientsList')
let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let callBtn = document.getElementById('callButton')
let hangBtn = document.getElementById('hangupButton')
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let grpMembers = []
let create = false
sendBtn.disabled = true
callBtn.disabled = true
hangBtn.disabled = true

sendBtn.addEventListener('click', sendMsgToRoom)
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
document.querySelector('#newRoom').addEventListener('click', createGroup)
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

socket.on('active', (id, clientsList) => {
  myId = id
  myName = clientsList[myId].clientName
  document.getElementById('welcome').innerText = clientsList[myId].clientName
  document.querySelector('img').src = clientsList[myId].picture
  document.querySelector('img').height = '60'
  document.querySelector('img').weight = '60'
  updateClientList(clientsList)
})

function createGroup () {
  if (!create) {
    create = true
    handshake.group = true
    grpMembers = []
    document.querySelector('#newRoom').innerText = 'Create'
    toggleClientList()
  } else {
    create = false
    document.querySelector('#newRoom').innerText = 'New Room'
    toggleClientList()
    createRoom(grpMembers)
  }
}

function updateClientList (clientsList) {
  for (let client in clientsList) {
    if (!allClients.hasOwnProperty(client) && client !== myId) {
      let clientDiv = document.createElement('div')
      clientDiv.innerText = clientsList[client].clientName
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
    grpMembers.push(id)
}

function createRoom (id) {
  socket.emit('create', id)
}

socket.on('new peer', clients => {
  updateClientList(clients)
})

socket.on('created', (room, id) => {
  updateChatHead(id)
  clearChatWindow(room)
  handshake.currRoom = room
  id.forEach(client => socket.emit('init', room, client))
  sendBtn.disabled = false
  callBtn.disabled = false
})

socket.on('init', room => {
  handshake.isInitiator = false
  socket.emit('join', room)
})

socket.on('group chat text', (clients, msg, from, room) => {
  handshake.group = true
  grpMembers = clients
  if (from !== myId) {
    chatTextHandler(from, clients, msg, room)
  }
})

function chatTextHandler (from, clients, msg, room) {
  sendBtn.disabled = false
  callBtn.disabled = false
  handshake.currClient = from
  updateChatHead(clients)
  clearChatWindow(room)
  handshake.currRoom = room
  acceptIncomingMsg(msg, 'toMe', allClients[from], room)
}

socket.on('accepted', clients => {
  handshake.isInitiator = true
})

function updateChatHead (client) {
  let str = client.map(id => allClients[id]).join(' ')
  document.querySelector('#chatHead').innerText = str
}

function clearChatWindow (room) {
  console.log(handshake.currRoom, room)
  if (handshake.currRoom !== room) {
    while (incomingMsg.firstChild) {
      incomingMsg.removeChild(incomingMsg.firstChild)
    }
  }
}

function acceptIncomingMsg (message, clsName, sender, room) {
  let msg = document.createElement('div')
  msg.innerText = message
  if (handshake.group && sender !== myName) {
    let sentBy = document.createElement('div')
    sentBy.innerText = sender
    let grpMsg = document.createElement('div')
    grpMsg.appendChild(sentBy)
    grpMsg.appendChild(msg)
    grpMsg.className = clsName
    grpMsg.style.backgroundColor = 'white'
    incomingMsg.appendChild(grpMsg)
  } else {
    msg.className = clsName
    msg.style.backgroundColor = 'white'
    incomingMsg.appendChild(msg)
  }
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
  document.querySelector('.videoStreams').style.display = 'block'
  localVideo.srcObject = localStream
  localVideo.style.width = '100%'
  sendMessage('got user media')
}

function onRemoteStream (remoteStream, id) {
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.setAttribute('id', id)
  remoteVideo.srcObject = remoteStream
  remoteVideo.style.flex = '1'
  remoteFeeds.appendChild(remoteVideo)
}

function handleRemoteHangup (id) {
  if (handshake.peersInCurrRoom.length === 1) {
    handshake.group = false
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
  localVideo.srcObject = null
  document.querySelector('.videoStreams').style.display = 'none'
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

function sendMsgToRoom () {
  acceptIncomingMsg(sendData.value, 'fromMe', myName, handshake.currRoom)
  socket.emit('group chat', sendData.value, grpMembers, handshake.currRoom)
}
