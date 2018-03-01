let handshake = {
  currRoom: null,
  currClient: null,
  onCall: false,
  localStream: null,
  remoteStream: {},
  isInitiator: false,
  pcDictionary: {},
  peersInCurrRoom: [],
  candidates: [],
  status: null,
  currMembers: [],
  queue: [],
  isProcessing: false,
  constraints: {
    audio: true,
    video: {width: 200, height: 200}
  },
  configuration: {
    'iceServers': [{
      'urls': 'stun:stun.l.google.com:19302'
    }]
  },
  gotStream: function (stream) {
    console.log('Got local stream')
    this.localStream = stream
    return this.localStream
  },
  getLocalStream: function (callback, id) {
    let mediaConstraints = this.constraints
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(stream => this.gotStream(stream))
    .then(stream => callback(stream, id))
    .catch((e) => {
      alert('getUserMedia() error: ' + e.name + e.message)
    })
  },
  createPeerConnection: function (id, sendMessage, remStreamHandler) {
    try {
      let peer = new RTCPeerConnection(this.configuration)
      peer.onicecandidate = event => {
        console.log('Got ice candidate')
        this.handleIceCandidate(event, id, sendMessage)
      }
      peer.onaddstream = event => {
        console.log('Got remote stream')
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
      console.log('Candidate')
      console.log(event.candidate)
      console.log('Recipient')
      console.log(id)
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
    console.log('Got remote stream from ' + id)
    this.remoteStream[id] = event.stream
    remStreamHandler(this.remoteStream[id], id)
  },
  handleRemoteStreamRemoved: function (event) {
    console.log('Remote stream removed. Event: ', event)
  },
  doCall: function (id, sendMessage) {
    console.log('Creating offer for ' + id)
    this.pcDictionary[id].createOffer()
    .then((sd) => this.setLocalAndSendMessage(sd, id, sendMessage))
    .catch((e) => this.handleCreateOfferError(e))
  },
  doAnswer: function (id, sendMessage) {
    console.log('Creating answer for ' + id)
    this.pcDictionary[id].createAnswer()
    .then((sd) => this.setLocalAndSendMessage(sd, id, sendMessage))
    .catch((e) => this.onCreateSessionDescriptionError(e))
  },
  setLocalAndSendMessage: function (sessionDescription, id, sendMessage) {
    // if (this.pcDictionary[id].localDescription.type === '') {
      this.pcDictionary[id].setLocalDescription(sessionDescription)
      this.peersInCurrRoom.push(id)
    // }
    console.log('Offer/Answer')
    console.log(this.pcDictionary[id].localDescription)
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
    if (this.status === 'master') {
      console.log('Starting with ' + id)
      this.doCall(id, sendMessage)
    } else {
      console.log('After getting an offer from ' + id)
      if (this.pcDictionary[id].remoteDescription.type === '') {
        console.log('Setting remote sdp')
        this.pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
      }
      this.doAnswer(id, sendMessage)
    }
  },
  onOffer: function (id, message, sendMessage, remStreamHandler) {
    if (this.status !== 'master') {
      console.log('Got offer from ' + id)
      this.status = 'slave'
      this.start(id, message, sendMessage, remStreamHandler)
    }
  },
  onAnswer: function (id, message) {
    console.log('Got answer from ' + id)
    console.log(message)
    this.pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
  },
  onCandidate: function (id, message) {
    console.log('Got candidate from ' + id)
    console.log(this.pcDictionary[id].iceConnectionState)
    console.log(this.pcDictionary[id].remoteDescription)
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    })
    this.pcDictionary[id].addIceCandidate(candidate).then(() => {
      console.log('Added candidate to ice agent')
    }).catch(e => {
      console.log('Error: Failure during addIceCandidate(): ' + e)
    })
  }
}

export {handshake}
