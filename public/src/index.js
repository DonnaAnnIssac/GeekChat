let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let isChannelReady = false
let isInitiator = false
let isStarted = false
let localStream
let pc
let remoteStream
let sendChannel, receiveChannel
sendBtn.disabled = true
sendBtn.addEventListener('click', sendMsg())

let room = prompt('Enter room name:')

let socket = io.connect()

if (room !== '') {
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

function sendMessage (message) {
  console.log('Client sending message: ', message)
  socket.emit('message', message)
}

// This client receives a message
socket.on('message', (message) => {
  console.log('Client received message:', message)
  if (message === 'got user media') {
    console.log('got user media')
    isChannelReady = true
    maybeStart()
  } else if (message.type === 'offer') {
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

let localVideo = document.querySelector('#localVideo')
let remoteVideo = document.querySelector('#remoteVideo')

let constraints = {
  audio: true,
  video: true
}
navigator.mediaDevices.getUserMedia(constraints)
.then(gotStream)
.catch((e) => {
  alert('getUserMedia() error: ' + e.name)
})

function gotStream (stream) {
  console.log('Adding local stream.')
  localStream = stream
  localVideo.srcObject = stream
  sendMessage('got user media')
  if (isInitiator) {
    maybeStart()
  }
}

function maybeStart () {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady)
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection')
    createPeerConnection()
    pc.addStream(localStream)
    isStarted = true
    console.log('isInitiator', isInitiator)
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
    sendChannel = pc.createDataChannel('sendDataChannel', null)
    pc.onicecandidate = handleIceCandidate
    pc.onaddstream = handleRemoteStreamAdded
    pc.onremovestream = handleRemoteStreamRemoved
    sendChannel.onopen = handleSendChannelStateChange
    sendChannel.onclose = handleSendChannelStateChange
    pc.ondatachannel = receiveChannelCallback
    sendBtn.disabled = false
    console.log('Created RTCPeerConnnection')
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message)
    alert('Cannot create RTCPeerConnection object.')
  }
}

function handleIceCandidate (event) {
  console.log('icecandidate event: ', event)
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    })
  } else {
    console.log('End of candidates.')
  }
}

function handleCreateOfferError (event) {
  console.log('createOffer() error: ', event)
}

function doCall () {
  console.log('Sending offer to peer')
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError)
}

function doAnswer () {
  console.log('Sending answer to peer.')
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  )
}

function setLocalAndSendMessage (sessionDescription) {
  pc.setLocalDescription(sessionDescription)
  console.log('setLocalAndSendMessage sending message', sessionDescription)
  sendMessage(sessionDescription)
}

function onCreateSessionDescriptionError (error) {
  console.log('Failed to create session description: ' + error.toString())
}

function handleRemoteStreamAdded (event) {
  console.log('Remote stream added.')
  remoteStream = event.stream
  remoteVideo.srcObject = remoteStream
}

function handleRemoteStreamRemoved (event) {
  console.log('Remote stream removed. Event: ', event)
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

function sendMsg () {
  let data = sendData.value
  sendChannel.send(data)
}

function handleSendChannelStateChange () {
  if (sendChannel.readyState === 'open') {
    sendData.disabled = false
    sendData.focus()
    sendBtn.disabled = false
  } else {
    sendData.disabled = true
    sendBtn.disabled = true
  }
}

function receiveChannelCallback (event) {
  receiveChannel = event.channel
  receiveChannel.onmessage = onReceiveCallback
  receiveChannel.onopen = handleReceiveChannelStateChange
  receiveChannel.onclose = handleReceiveChannelStateChange
}

function onReceiveCallback (event) {
  let msg = document.createElement('div')
  msg.innerText = event.data
  incomingMsg.appendChild(msg)
}

function handleReceiveChannelStateChange () {
  console.log(receiveChannel.readyState)
}
