/*
 * main.js
 */

'use strict';

const audio = document.querySelector('audio#audio');
const callButton = document.querySelector('button#callButton');
const hangupButton = document.querySelector('button#hangupButton');

hangupButton.disabled = true;
callButton.onclick = start_call;
hangupButton.onclick = hangup_call;

const remoteVideo = document.getElementById('remoteVideo');


remoteVideo.addEventListener('loadedmetadata', function() {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});


let pc1;
let localStream;


const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
};


/*
 * This function is called first.
 */
function start_call() {
  callButton.disabled = true;

  console.log('Starting call');

  const configuration = {
    'iceServers': [
      {
        'url': 'stun:stun.l.google.com:19302'
      }
    ],
    iceTransportPolicy: 'all'
  };

  console.log('configuration: ', configuration);

  pc1 = new RTCPeerConnection(configuration);
  console.log('Created local peer connection object pc1');
  pc1.onicecandidate = e => onIceCandidate(pc1, e);
  pc1.ontrack = gotRemoteStream;

  pc1.oniceconnectionstatechange = function(event) {
    console.log(`ice state changed: ${pc1.iceConnectionState}`);
  };

  console.log('Requesting local stream');
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: { width:320, height:240, framerate:15 }
    })
    .then(gotStream)
    .catch(e => {
      alert(`getUserMedia() error: ${e.name}`);
    });
}


function gotStream(stream) {
  hangupButton.disabled = false;

  console.log('Received local stream');
  console.log(stream)

  localStream = stream;

  const audioTracks = localStream.getAudioTracks();

  console.log('audio tracks: ' + audioTracks.length);
  if (audioTracks.length > 0) {
    console.log(`Using Audio device: ${audioTracks[0].label}`);
  }

  localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
  console.log('Adding Local Stream to peer connection');

  pc1.createOffer(offerOptions)
    .then(gotDescription1, onCreateSessionDescriptionError);
}


function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}


/*
 * Send the SDP offer to the server via HTTP request
 *
 * format:
 *
 * {
 *   "type" : "offer",
 *   "sdp"  : "v=0\r\ns=-\r\n..."
 * }
 */
function send_offer(sdp) {
  var xhr = new XMLHttpRequest();

  console.log('send offer: ' + self.location);

  xhr.open("POST", '' + self.location + 'call', true);

  //Send the proper header information along with the request
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function() { // Call a function when the state changes.
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      var body = xhr.response;

      console.log('HTTP Request complete');

      const contentType = xhr.getResponseHeader("Content-Type");

      console.log('content-type: ' + contentType);

      if (contentType != "application/json") {
        console.log('unsupported content-type from server');
	xhr.abort();
      }

      var answer = JSON.parse(body);

      console.log(`set remote description -- SDP Answer`);

      pc1.setRemoteDescription(answer).then(() => {
        console.log('set remote description -- success');
      }, onSetSessionDescriptionError);
    }
  }

  xhr.send(sdp);
}


/*
 * ${desc.sdp}
 */
function gotDescription1(desc) {
  console.log(`Offer from pc1`);

  pc1.setLocalDescription(desc)
    .then(() => {
    }, onSetSessionDescriptionError);
}


function hangup_call() {
  console.log('Ending call');

  localStream.getTracks().forEach(track => track.stop());

  pc1.close();
  pc1 = null;

  hangupButton.disabled = true;
  callButton.disabled = false;

  // send a message to the server
  var xhr = new XMLHttpRequest();
  xhr.open("POST", '' + self.location + 'hangup', true);
  xhr.send();
}


function gotRemoteStream(e) {

  console.log('got remote stream (track)');
  console.log(e);

  if (audio.srcObject !== e.streams[0]) {
    audio.srcObject = e.streams[0];
    console.log('Received remote stream');
  }

  if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
         console.log('pc2 received remote stream');
  }
}


function onIceCandidate(pc, event) {

//  console.log(`ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);

  if (event.candidate) {
	    // Send the candidate to the remote peer
  } else {
     // All ICE candidates have been sent

    var sd = pc.localDescription;
    const json = JSON.stringify(sd);

    // send SDP offer to the server
    send_offer(json);
  }
}


function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}
