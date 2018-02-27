let handshake = {
  currRoom: null,
  currClient: null,
  myId: null,
  onCall: false,
  group: false,
  localStream: null,
  remoteStream: {},
  isInitiator: false,
  pcDictionary: {},
  peersInCurrRoom: [],
  candidates: [],
  remoteCandidates: [],
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
    console.log(stream === null)
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
      let peer = new RTCPeerConnection(this.configuration)
      peer.onicecandidate = event => {
        console.log('Got ice candidate')
        this.handleIceCandidate(event, id, sendMessage)
      }
      // peer.oniceconnectionstatechange = event => {
      //   console.log(this.pcDictionary[id].iceConnectionState)
      //   if (this.pcDictionary[id] === 'new' || this.pcDictionary[id] === 'completed') {
      //     this.onCandidate(id)
      //   }
      // }
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
    console.log('ID is ' + id)
    console.log(event.stream === null)
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
    if (this.pcDictionary[id].localDescription.type === '') {
      this.pcDictionary[id].setLocalDescription(sessionDescription)
      this.peersInCurrRoom.push(id)
    }
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
    if (this.isInitiator) {
      this.doCall(id, sendMessage)
    } else {
      console.log(message)
      if (this.pcDictionary[id].remoteDescription.type === '') {
        this.pcDictionary[id].setRemoteDescription(new RTCSessionDescription(message))
      }
      this.doAnswer(id, sendMessage)
    }
  },
  onOffer: function (id, message, sendMessage, remStreamHandler) {
    if (!this.isInitiator) {
      console.log('Got offer from ' + id)
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
    // if (this.pcDictionary[id].remoteDescription &&
    //     (this.pcDictionary[id].iceConnectionState === 'completed' ||
    //     this.pcDictionary[id].iceConnectionState === 'new')) {
    //   console.log('Adding ice candidate')
    //   this.remoteCandidates.forEach(message => {
        let candidate = new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate
        })
        this.pcDictionary[id].addIceCandidate(candidate).then(() => {
          console.log('Added candidate to ice agent')
        }).catch(e => {
          console.log('Error: Failure during addIceCandidate(): ' + e)
        })
    //     this.remoteCandidates = []
    //   })
    // } else {
    //   this.remoteCandidates.push(message)
    // }
  }
}

export {handshake}
