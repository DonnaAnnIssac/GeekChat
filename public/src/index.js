let socket = io.connect()
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let isChannelReady = false
let isInitiator = false
let isStarted = false
let localStream, remoteStream
let pc, currentClient, candidates = [], pendingClients = [], myPeers = []
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
  // console.log('Just joined')
  // console.log(myPeers.length)
  // console.log(myPeers)
  getLocalStream()
})

socket.on('new peer', room => {
  isStarted = false
  isInitiator = true
})

function sendMessage (message, id) {
  // console.log('Client sending message: ', message)
  socket.emit('message', message, room, id)
}

socket.on('message', (message, id) => {
  console.log('\n\nClient received message:', message)
  if (myPeers.indexOf(id) === -1) currentClient = id
  console.log('From: ', id)
  console.log(myPeers.indexOf(id))
  console.log('Current Peers: ')
  console.log(myPeers)
  if (message === 'got user media') {
    isChannelReady = true
    maybeStart()
  } else if (message.type === 'offer' && myPeers.indexOf(id) === -1) {
    if (!isInitiator && !isStarted) {
      isChannelReady = true
      maybeStart()
    }
    pc.setRemoteDescription(new RTCSessionDescription(message))
    doAnswer()
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message))
  } else if (message.type === 'candidate' && isStarted) {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    })
    pc.addIceCandidate(candidate)
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup()
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
  // console.log('Adding local stream.')
  localStream = stream
  localVideo.srcObject = stream
  sendMessage('got user media')
}

function  maybeStart () {
  // console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady)
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    // console.log('>>>>>> creating peer connection')
    createPeerConnection()
    pc.addStream(localStream)
    isStarted = true
    // console.log('isInitiator', isInitiator)
    if (isInitiator) {
      doCall()
    }
  }
}

window.onbeforeunload = function () {
  sendMessage('bye')
}

function createPeerConnection () {
  try {
    pc = new RTCPeerConnection(null)
    pendingClients.push(currentClient)
    pc.onicecandidate = handleIceCandidate
    pc.onaddstream = handleRemoteStreamAdded
    pc.onremovestream = handleRemoteStreamRemoved
    // console.log('Created RTCPeerConnnection')
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message)
    alert('Cannot create RTCPeerConnection object.')
  }
}

function handleIceCandidate (event) {
  // console.log('icecandidate event: ', event.candidate)
  // console.log('icecandidate target: ', event.target)
  // console.log('current client: ', currentClient)
  if (event.candidate) {
    candidates.push({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    })
  } else {
    console.log('~~~~~~~~~~~~~~~~~~End of candidates.~~~~~~~~~~~~~~~~~~~~~~~~~')
    sendCandidates()
  }
}

function sendCandidates () {
  let client = pendingClients.shift()
  candidates.forEach(candidate => {
    console.log('Sending candidates to: ', client)
    sendMessage(candidate, client)
  })
  candidates = []
}

function handleRemoteStreamAdded (event) {
  // console.log('Remote stream added.')
  remoteStream = event.stream
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.srcObject = remoteStream
  remoteFeeds.appendChild(remoteVideo)
}

function handleRemoteStreamRemoved (event) {
  console.log('Remote stream removed. Event: ', event)
}

function doCall () {
  // console.log('Sending offer to peer')
  pc.createOffer()
  .then(setLocalAndSendMessage)
  .catch(handleCreateOfferError)
}

function doAnswer () {
  // console.log('Sending answer to peer.')
  pc.createAnswer()
  .then(setLocalAndSendMessage)
  .catch(onCreateSessionDescriptionError)
  // console.log('After answering')
  // console.log(myPeers)
  // myPeers.push(currentClient)
  // console.log(myPeers)
}

function setLocalAndSendMessage (sessionDescription) {
  pc.setLocalDescription(sessionDescription)
  myPeers.push(currentClient)
  // console.log('setLocalAndSendMessage sending message', sessionDescription)
  sendMessage(sessionDescription, currentClient)
}

function handleCreateOfferError (event) {
  console.log('createOffer() error: ', event)
}

function onCreateSessionDescriptionError (error) {
  console.log('Failed to create session description: ' + error.toString())
}

function handleRemoteHangup () {
  console.log('Session terminated.')
  stop()
  isInitiator = false
}

function stop () {
  isStarted = false
  pc.close()
  pc = null
}
