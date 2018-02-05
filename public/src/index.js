let socket = io.connect()
let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let callBtn = document.getElementById('callButton')
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let isChannelReady = false
let isInitiator = false
let localStream, myId, myName
let pcDictionary = {}, peersInCurrRoom = [], candidates = [], clients = {}

let constraints = {
  audio: true,
  video: true
}

sendBtn.disabled = true
callBtn.disabled = true
sendBtn.addEventListener('click', sendMsgOverChannel)

document.querySelector('button#enterName').addEventListener('click', () => {
  socket.emit('set active', document.querySelector('input#clientName').value)
})

socket.on('active', (id, name, clientsList) => {
  myId = id
  myName = name
  clients = clientsList
})

// let room = prompt('Enter room name:')

// if (room) {
//   callBtn.disabled = false
//   callBtn.addEventListener('click', () => {
//     callBtn.disabled = true
//     socket.emit('create or join', room)
//   })
// }

socket.on('created', room => {
  isInitiator = true
  getLocalStream()
})

socket.on('joined', room => {
  isInitiator = false
  getLocalStream()
})

socket.on('new peer', room => {
  isInitiator = true
})

function sendMessage (message, id) {
  socket.emit('message', message, room, id)
}

socket.on('message', (message, id) => {
  if (message === 'got user media') {
    isChannelReady = true
    sendNotifications(id, 'joined')
    maybeStart(id)
  } else if (message.type === 'offer' && peersInCurrRoom.indexOf(id) === -1) {
    if (!isInitiator) {
      isChannelReady = true
      maybeStart(id, message)
    }
  } else if (message.type === 'answer') {
    pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
  } else if (message.type === 'candidate') {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    })
    pcDictionary[id].addIceCandidate(candidate)
  } else if (message === 'bye') {
    handleRemoteHangup(id)
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
  localVideo.srcObject = stream
  // sendMessage('got user media')
}

function  maybeStart (id, message) {
  if (typeof localStream !== undefined && isChannelReady) {
    createPeerConnection(id)
    if (isInitiator) {
      doCall(id)
    } else {
      pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
      doAnswer(id)
    }
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
    pcDictionary[id].onremovestream = handleRemoteStreamRemoved
    pcDictionary[id].addStream(localStream)
    pcDictionary[id].sendChannel = pcDictionary[id].createDataChannel(room, null)
    pcDictionary[id].sendChannel.onopen = () => {
      handleSendChannelStateChange(pcDictionary[id].sendChannel)
    }
    pcDictionary[id].sendChannel.onclose = () => {
      handleSendChannelStateChange(pcDictionary[id].sendChannel)
    }
    pcDictionary[id].ondatachannel = event => {
      receiveChannelCallback(event, id)
    }
    sendBtn.disabled = false
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
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.setAttribute('id', id)
  remoteVideo.srcObject = event.stream
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
  } else {
    sendData.disabled = true
    sendBtn.disabled = true
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
  let msg = document.createElement('div')
  msg.innerText = event.data
  incomingMsg.appendChild(msg)
}

function handleReceiveChannelStateChange (id) {
  console.log(pcDictionary[id].receiveChannel.readyState)
}

function sendMsgOverChannel () {
  let data = sendData.value
  let msg = document.createElement('div')
  msg.innerText = event.data
  incomingMsg.appendChild(msg)
  for (key in pcDictionary) {
    pcDictionary[key].sendChannel.send(data)
  }
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
