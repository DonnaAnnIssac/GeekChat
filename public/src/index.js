let socket = io.connect()
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let isChannelReady = false
let isInitiator = false
let localStream
let pcDictionary= {}, myPeers = [], candidates = []
let constraints = {
  audio: true,
  video: true
}

let room = prompt('Enter room name:')

if (room || room === '') {
  socket.emit('create or join', room)
}

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
    maybeStart(id)
  } else if (message.type === 'offer' && myPeers.indexOf(id) === -1) {
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
  sendMessage('got user media')
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
    pcDictionary[id].clientId = id
    pcDictionary[id].onicecandidate = event => {
      handleIceCandidate(event, id)
    }
    pcDictionary[id].onaddstream = handleRemoteStreamAdded
    pcDictionary[id].onremovestream = handleRemoteStreamRemoved
    pcDictionary[id].addStream(localStream)
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

function handleRemoteStreamAdded (event) {
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.srcObject = event.stream
  remoteFeeds.appendChild(remoteVideo)
}

function handleRemoteStreamRemoved (event) {
  console.log('Remote stream removed. Event: ', event)
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
  myPeers.push(id)
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

function stop () {
  pcDictionary[id].close()
  pcDictionary[id] = null
}
