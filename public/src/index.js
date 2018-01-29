
let isChannelReady = false
let isInitiator = false
let isStarted = false
let localStream
let pc
let remoteStream
// let turnReady

// let pcConfig = {
//   'iceServers': [{
//     'urls': 'stun:stun.l.google.com:19302'
//   }]
// }

// // Set up audio and video regardless of what devices are present.
// let sdpConstraints = {
//   offerToReceiveAudio: true,
//   offerToReceiveVideo: true
// }

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

// if (location.hostname !== 'localhost') {
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   )
// }

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
    pc.onicecandidate = handleIceCandidate
    pc.onaddstream = handleRemoteStreamAdded
    pc.onremovestream = handleRemoteStreamRemoved
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

// function requestTurn(turnURL) {
//   let turnExists = false
//   for (let i in pcConfig.iceServers) {
//     if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
//       turnExists = true
//       turnReady = true
//       break
//     }
//   }
//   if (!turnExists) {
//     console.log('Getting TURN server from ', turnURL)
//     // No TURN server. Get one from computeengineondemand.appspot.com:
//     let xhr = new XMLHttpRequest()
//     xhr.onreadystatechange = function() {
//       if (xhr.readyState === 4 && xhr.status === 200) {
//         let turnServer = JSON.parse(xhr.responseText)
//         console.log('Got TURN server: ', turnServer)
//         pcConfig.iceServers.push({
//           'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
//           'credential': turnServer.password
//         })
//         turnReady = true
//       }
//     }
//     xhr.open('GET', turnURL, true)
//     xhr.send()
//   }
// }

function handleRemoteStreamAdded (event) {
  console.log('Remote stream added.')
  remoteStream = event.stream
  remoteVideo.srcObject = remoteStream
}

function handleRemoteStreamRemoved (event) {
  console.log('Remote stream removed. Event: ', event)
}

// function hangup() {
//   console.log('Hanging up.')
//   stop()
//   sendMessage('bye')
// }

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

// ///////////////////////////////////////////

// function extractSdp(sdpLine, pattern) {
//   let result = sdpLine.match(pattern)
//   return result && result.length === 2 ? result[1] : null
// }

// // Set the selected codec to the first in m line.
// function setDefaultCodec(mLine, payload) {
//   let elements = mLine.split(' ')
//   let newLine = []
//   let index = 0
//   for (let i = 0; i < elements.length; i++) {
//     if (index === 3) { // Format of media starts from the fourth.
//       newLine[index++] = payload // Put target payload to the first.
//     }
//     if (elements[i] !== payload) {
//       newLine[index++] = elements[i]
//     }
//   }
//   return newLine.join(' ')
// }

// // Strip CN from sdp before CN constraints is ready.
// function removeCN(sdpLines, mLineIndex) {
//   let mLineElements = sdpLines[mLineIndex].split(' ')
//   // Scan from end for the convenience of removing an item.
//   for (let i = sdpLines.length - 1; i >= 0; i--) {
//     let payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i)
//     if (payload) {
//       let cnPos = mLineElements.indexOf(payload)
//       if (cnPos !== -1) {
//         // Remove CN payload from m line.
//         mLineElements.splice(cnPos, 1)
//       }
//       // Remove CN line in sdp
//       sdpLines.splice(i, 1)
//     }
//   }
//   sdpLines[mLineIndex] = mLineElements.join(' ')
//   return sdpLines
// }
