let handshake = {
  currRoom: null,
  currClient: null,
  myId: null,
  onCall: false,
  group:  false,
  localStream: null,
  remoteStream: {},
  isInitiator: false,
  pcDictionary: {},
  peersInCurrRoom: [],
  candidates: [],
  constraints: {
    audio: true,
    video: true
  },
  gotStream: function (stream) {
    this.localStream = stream
    return this.localStream
  },
  getLocalStream: function (callback) {
    let mediaConstraints = this.constraints
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then((stream) => this.gotStream(stream))
    .then(callback)
    .catch((e) => {
      alert('getUserMedia() error: ' + e.name + e.message)
    })
  },
  onUsrMedia: function (id, message, callback, sendMessage, remStreamHandler) {
    if (this.localStream === null) { // receiver
      this.isInitiator = false
      this.getLocalStream(callback)
    } else if (this.peersInCurrRoom.indexOf(id) === -1) { // sender
      this.isInitiator = true
      this.start(id, message, sendMessage, remStreamHandler)
    }
  },
  createPeerConnection: function (id, sendMessage, remStreamHandler) {
    try {
      let peer = new RTCPeerConnection(null)
      peer.onicecandidate = event => {
        this.handleIceCandidate(event, id, sendMessage)
      }
      peer.onaddstream = event => {
        this.handleRemoteStreamAdded(event, id, remStreamHandler)
      }
      peer.addStream(this.localStream)
      peer.onremovestream = this.handleRemoteStreamRemoved
      this.pcDictionary[id] = peer
    } catch (e) {
      console.log('Failed to create PeerConnection, exception: ' + e.message)
      alert('Cannot create RTCPeerConnection object.')
    }
  },
  handleIceCandidate: function (event, id, sendMessage) {
    if (event.candidate) {
      this.candidates.push({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
      foundation: event.candidate.foundation
      })
    } else {
      this.sendCandidates(id, sendMessage)
    }
  },
  sendCandidates: function (client, sendMessage) {
    this.candidates.forEach(candidate => {
      sendMessage(candidate, client)
    })
    this.candidates = []
  },
  handleRemoteStreamAdded: function (event, id, remStreamHandler) {
    this.remoteStream[id] = event.stream
    remStreamHandler(this.remoteStream[id], id)
  },
  handleRemoteStreamRemoved: function (event) {
    console.log('Remote stream removed. Event: ', event)
  },
  doCall: function (id, sendMessage) {
    this.pcDictionary[id].createOffer()
    .then((sd) => this.setLocalAndSendMessage(sd, id, sendMessage))
    .catch((e) => this.handleCreateOfferError(e))
  },
  doAnswer: function (id, sendMessage) {
    this.pcDictionary[id].createAnswer()
    .then((sd) => this.setLocalAndSendMessage(sd, id, sendMessage))
    .catch((e) => this.onCreateSessionDescriptionError(e))
  },
  setLocalAndSendMessage: function (sessionDescription, id, sendMessage) {
    this.pcDictionary[id].setLocalDescription(sessionDescription)
    this.peersInCurrRoom.push(id)
    sendMessage(sessionDescription, id)
  },
  handleCreateOfferError: function (event) {
    console.log('createOffer() error: ', event)
  },
  onCreateSessionDescriptionError: function (error) {
    console.log('Failed to create session description: ' + error.toString())
  },
  start: function (id, message, sendMessage, remStreamHandler) {
    this.createPeerConnection(id, sendMessage, remStreamHandler)
    if (this.isInitiator) {
      this.doCall(id, sendMessage)
    } else {
      this.pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
      this.doAnswer(id, sendMessage)
    }
  },
  onOffer: function (id, message, sendMessage, remStreamHandler) {
    if (!this.isInitiator) {
      this.start(id, message, sendMessage, remStreamHandler)
    }
  },
  onAnswer: function (id, message) {
    this.pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
  },
  onCandidate: function (id, message) {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    })
    this.pcDictionary[id].addIceCandidate(candidate)
  }
}

export {handshake}
