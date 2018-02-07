let socket = io.connect()
let currRoom, currClient, myId, myName, group = false
let listOfClients = document.querySelector('#clientsList')

let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let callBtn = document.getElementById('callButton')
let hangBtn = document.getElementById('hangupButton')
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let localStream, remoteStream = {}
let isChannelReady = false
let isInitiator = false
let pcDictionary = {}, peersInCurrRoom = [], candidates = [], allClients = {}
let grpMembers = []
let constraints = {
  audio: true,
  video: true
}
sendBtn.disabled = true
callBtn.disabled = true
hangBtn.disabled = true
sendBtn.addEventListener('click', sendMsgOverChannel)
callBtn.addEventListener('click', () => {
  isInitiator = true
  hangBtn.disabled = false
  sendMessage('call invitation')
})
document.querySelector('#newRoom').addEventListener('click', toggleClientList)
document.querySelector('#newGroup').addEventListener('click', () => {
  if (!group) {
    group = true
    grpMembers = []
    document.querySelector('#newGroup').innerText = 'Create'
    toggleClientList()
  } else {
    document.querySelector('#newGroup').innerText = 'New Group'
    toggleClientList()
    createRoom(grpMembers)
  }
})
document.getElementById('accept').addEventListener('click', () => {
  document.getElementById('callInvite').style.display = 'none'
  sendMessage('accept call', currClient)
})
document.getElementById('decline').addEventListener('click', () => {
  document.getElementById('callInvite').style.display = 'none'
  sendMessage('decline call', currClient)
})
//temporary login
document.querySelector('button#enterName').addEventListener('click', () => {
   ('Logging in as ', document.querySelector('input#clientName').value)
  socket.emit('set active', document.querySelector('input#clientName').value)
})

socket.on('active', (id, name, clientsList) => {
  myId = id
  myName = name
  updateClientList(clientsList)
})

function updateClientList (clientsList) {
  for (client in clientsList) {
    if (!allClients.hasOwnProperty(client) && client !== myId) {
      let clientDiv = document.createElement('div')
      clientDiv.innerText = clientsList[client].clientName
      clientDiv.id = client
      clientDiv.addEventListener('click', () => {
        if (!group) {
          currClient = clientDiv.id
          toggleClientList()
          createRoom(clientDiv.id)
        } else {
          grpMembers.push(clientDiv.id)
        }
      })
      listOfClients.appendChild(clientDiv)
      listOfClients.style.display = 'none'
      allClients[client] = clientsList[client].clientName
    }
  }
}

function toggleClientList () {
  listOfClients.style.display = (listOfClients.style.display === 'block') ? 'none' : 'block'
}

function createRoom (id) {
  socket.emit('create', id)
}

socket.on('new peer', clients => {
  updateClientList(clients)
})

socket.on('created', (room, id) => {
  currRoom = room
  updateChatHead(id)
  if (group) {
    id.forEach(client => socket.emit('init', room, client))
  } else {
    socket.emit('init', room, id)
  }
  sendBtn.disabled = false
  callBtn.disabled = false
})
socket.on('init', room => {
  isInitiator = false
  currRoom = room
  socket.emit('join', room)
})
socket.on('chat text', (room, msg, from) => {
  currClient = from
  updateChatHead(from)
  acceptIncomingMsg(msg)
  sendBtn.disabled = false
  callBtn.disabled = false
})

socket.on('joined', clients => {
  console.log('Joined room ')
})

socket.on('accepted', clients => {
  isInitiator = true
})

function updateChatHead (client) {
  if (Array.isArray(client)) {
    let str = client.reduce((string, id) => string + allClients[id], '')
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
  socket.emit('message', message, currRoom, id)
}

socket.on('message', (message, id) => {
  if (message === 'got user media') {
    if(localStream === undefined) {
      isInitiator = false
      getLocalStream()
    } else {
      isChannelReady = true
      start(id, message)
    }
  } else if (message.type === 'offer' && peersInCurrRoom.indexOf(id) === -1) {
    if (!isInitiator) {
      start(id, message)
    }
  } else if (message.type === 'answer') {
    pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
    callPeers()
  } else if (message.type === 'candidate') {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    })
    pcDictionary[id].addIceCandidate(candidate)
  } else if (message === 'bye') {
    handleRemoteHangup(id)
  } else if (message === 'call invitation') {
    callBtn.disabled = true
    document.getElementById('callInvite').style.display = 'block'
    document.getElementById('caller').innerText = allClients[id] + ' is calling'
    currClient = id
  } else if (message === 'accept call') {
    getLocalStream()
  }
})

function getLocalStream () {
  navigator.mediaDevices.getUserMedia(constraints)
  .then(gotStream)
  .catch((e) => {
    alert('getUserMedia() error: ' + e.name)
  })
}

function gotStream (stream) {
  localStream = stream
  localVideo.srcObject = localStream
  sendMessage('got user media')
}

function start (id, message) {
  createPeerConnection(id)
  if (isInitiator) {
    doCall(id)
  } else {
    pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
    doAnswer(id)
  }
}

window.onbeforeunload = function () {
  sendMessage('bye')
}

function createPeerConnection (id) {
  try {
    pcDictionary[id] = new RTCPeerConnection(null)
    pcDictionary[id].onicecandidate = event => {
      handleIceCandidate(event, id)
    }
    pcDictionary[id].onaddstream = event => {
      handleRemoteStreamAdded(event, id)
    }
    pcDictionary[id].addStream(localStream)
    pcDictionary[id].onremovestream = handleRemoteStreamRemoved
    pcDictionary[id].sendChannel = pcDictionary[id].createDataChannel(currRoom)
    pcDictionary[id].sendChannel.onopen = () => {
      handleSendChannelStateChange(pcDictionary[id].sendChannel)
    }
    pcDictionary[id].sendChannel.onclose = () => {
      handleSendChannelStateChange(pcDictionary[id].sendChannel)
    }
    pcDictionary[id].ondatachannel = event => {
      receiveChannelCallback(event, id)
    }
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message)
    alert('Cannot create RTCPeerConnection object.')
  }
}

function handleIceCandidate (event, id) {
  if (event.candidate) {
    candidates.push({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      foundation: event.candidate.foundation
    })
  } else {
    sendCandidates(id)
  }
}

function sendCandidates (client) {
  candidates.forEach(candidate => {
    sendMessage(candidate, client)
  })
  candidates = []
}

function handleRemoteStreamAdded (event, id) {
  remoteStream[id] = event.stream
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.setAttribute('id', id)
  remoteVideo.srcObject = remoteStream[id]
  remoteFeeds.appendChild(remoteVideo)
}

function handleRemoteStreamRemoved (event) {
  console.log('Remote stream removed. Event: ', event)
}

function handleSendChannelStateChange (sendChannel) {
  if (sendChannel.readyState === 'open') {
    sendData.disabled = false
    sendData.focus()
    sendBtn.disabled = false
    callBtn.disabled = false
  } else {
    sendData.disabled = true
    sendBtn.disabled = true
    callBtn.disabled = true
  }
}

function receiveChannelCallback (event, id) {
  pcDictionary[id].receiveChannel = event.channel
  pcDictionary[id].receiveChannel.onmessage = onReceiveCallback
  pcDictionary[id].receiveChannel.onopen = () => {
    handleReceiveChannelStateChange(id)
  }
  pcDictionary[id].receiveChannel.onclose = () => {
    handleReceiveChannelStateChange(id)
  }
}

function onReceiveCallback (event) {
  acceptIncomingMsg(event.data)
}

function handleReceiveChannelStateChange (id) {
  console.log(pcDictionary[id].receiveChannel.readyState)
}

function sendMsgOverChannel () {
  acceptIncomingMsg(sendData.value)
  socket.emit('chat', sendData.value, currClient, currRoom)
}

function doCall (id) {
  pcDictionary[id].createOffer()
  .then((sd) => setLocalAndSendMessage(sd, id))
  .catch(handleCreateOfferError)
}

function doAnswer (id) {
  pcDictionary[id].createAnswer()
  .then((sd) => setLocalAndSendMessage(sd, id))
  .catch(onCreateSessionDescriptionError)
}

function setLocalAndSendMessage (sessionDescription, id) {
  pcDictionary[id].setLocalDescription(sessionDescription)
  peersInCurrRoom.push(id)
  sendMessage(sessionDescription, id)
}

function handleCreateOfferError (event) {
  console.log('createOffer() error: ', event)
}

function onCreateSessionDescriptionError (error) {
  console.log('Failed to create session description: ' + error.toString())
}

function handleRemoteHangup (id) {
  console.log('Session terminated.')
  socket.emit('disconnect', currRoom)
  stop(id)
  isInitiator = false
}

function stop (id) {
  pcDictionary[id].close()
  let disconnectedPeer = document.getElementById(id)
  disconnectedPeer.parentNode.removeChild(disconnectedPeer)
  sendNotifications(id, 'left')
}

function sendNotifications (id, action) {
  document.getElementById('notifications').innerText = 'Client ' + id + ' ' + action
}

function  callPeers () {
  if (localStream !== undefined && isChannelReady) {
    console.log('Initiating call to peers')
  }
}
