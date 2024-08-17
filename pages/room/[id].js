import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
// import { Euler } from 'three';
// import { Canvas } from '@react-three/fiber';
// import { Color } from 'three';
// import Avatar from '../../components/avatar';
import FaceLandmarkRenderer from '../../components/face-landmark-renderer';
import { io } from 'socket.io-client';
import useSocket from '../../hooks/useSocket';

import PeerComponent from '../../components/peer-component';
import UserComponent from '../../components/user-component';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
  ],
};

const Room = () => {
  useSocket();
  const router = useRouter();
  const { id: roomName } = router.query;

  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [userBlendshapes, setUserBlendshapes] = useState([]);
  const [userRotation, setUserRotation] = useState(null);
  const [peerBlendshapes, setPeerBlendshapes] = useState([]);
  const [peerRotation, setPeerRotation] = useState(null);

  const userVideoRef = useRef(null);
  const peerVideoRef = useRef(null);
  const rtcConnectionRef = useRef(null);

  const socketRef = useRef();
  
  const userStreamRef = useRef(null);
  const hostRef = useRef(false);

  useEffect(() => {
    socketRef.current = io(); 
    socketRef.current.emit('join', roomName);

    socketRef.current.on('joined', handleRoomJoined);
    socketRef.current.on('created', handleRoomCreated);
    socketRef.current.on('ready', initiateCall);
    socketRef.current.on('leave', onPeerLeave);
    socketRef.current.on('full', () => {
      window.location.href = '/';
    });
    socketRef.current.on('offer', handleReceivedOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);

    // New event for receiving peer's face data
    socketRef.current.on('peer-face-data', handlePeerFaceData);

    // Error logging
    socketRef.current.on("connect_error", (err) => {
      // the reason of the error, for example "xhr poll error"
      console.log(err.message);
    
      // some additional description, for example the status code of the initial HTTP response
      console.log(err.description);
    
      // some additional context, for example the XMLHttpRequest object
      console.log(err.context);
    });

    return () => socketRef.current.disconnect();
  }, [roomName]);

  const handleRoomJoined = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        userStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          userVideoRef.current.onloadedmetadata = () => {
            userVideoRef.current?.play();
          };
        }
        socketRef.current.emit('ready', roomName);
      })
      .catch((err) => console.log('error', err));
  };

  const handleRoomCreated = () => {
    hostRef.current = true;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        userStreamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          userVideoRef.current.onloadedmetadata = () => {
            userVideoRef.current?.play();
          };
        }
      })
      .catch((err) => console.log(err));
  };

  const initiateCall = () => {
    if (hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      userStreamRef.current?.getTracks().forEach((track) =>
        rtcConnectionRef.current?.addTrack(track, userStreamRef.current)
      );
      rtcConnectionRef.current
        .createOffer()
        .then((offer) => {
          rtcConnectionRef.current?.setLocalDescription(offer);
          socketRef.current.emit('offer', offer, roomName);
        })
        .catch((error) => console.log(error));
    }
  };

  const onPeerLeave = () => {
    hostRef.current = true;
    if (peerVideoRef.current?.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }

    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
  };

  const createPeerConnection = () => {
    const connection = new RTCPeerConnection(ICE_SERVERS);
    connection.onicecandidate = handleICECandidateEvent;
    connection.ontrack = handleTrackEvent;
    return connection;
  };

  const handleReceivedOffer = (offer) => {
    if (!hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      userStreamRef.current?.getTracks().forEach((track) =>
        rtcConnectionRef.current?.addTrack(track, userStreamRef.current)
      );
      rtcConnectionRef.current.setRemoteDescription(offer);

      rtcConnectionRef.current
        .createAnswer()
        .then((answer) => {
          rtcConnectionRef.current?.setLocalDescription(answer);
          socketRef.current.emit('answer', answer, roomName);
        })
        .catch((error) => console.log(error));
    }
  };

  const handleAnswer = (answer) => {
    rtcConnectionRef.current?.setRemoteDescription(answer).catch(console.log);
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      socketRef.current.emit('ice-candidate', event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    const candidate = new RTCIceCandidate(incoming);
    rtcConnectionRef.current
      ?.addIceCandidate(candidate)
      .catch((e) => console.log(e));
  };

  const handleTrackEvent = (event) => {
    peerVideoRef.current.srcObject = event.streams[0];
  };

  const toggleMediaStream = (type, state) => {
    userStreamRef.current?.getTracks().forEach((track) => {
      if (track.kind === type) {
        track.enabled = !state;
      }
    });
  };

  const toggleMic = () => {
    toggleMediaStream('audio', micActive);
    setMicActive((prev) => !prev);
  };

  const toggleCamera = () => {
    toggleMediaStream('video', cameraActive);
    setCameraActive((prev) => !prev);
  };

  const leaveRoom = () => {
    socketRef.current.emit('leave', roomName);

    if (userVideoRef.current?.srcObject) {
      userVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    if (peerVideoRef.current?.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }

    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
    router.push('/');
  };

  // New function to handle peer face data
  const handlePeerFaceData = (data) => {
    console.log('Received peer face data:', data);

    // Check if data is valid before applying
    if (data.blendshapes && data.rotation) {
      setPeerBlendshapes(data.blendshapes);
      setPeerRotation(data.rotation);
    } else {
      console.error("Invalid peer face data received:", data);
    }
  };

  // New function to handle user face updates
  const handleUserFaceUpdate = (blendshapes, rotation) => {
    console.log('Sending user face data:', { blendshapes, rotation });

    // Check if data is valid before sending
    if (blendshapes && rotation) {
      setUserBlendshapes(blendshapes);
      setUserRotation(rotation);

      // Send face data to the peer
      socketRef.current.emit('peer-face-data', { blendshapes, rotation }, roomName);
    } else {
      console.error("Invalid user face data:", { blendshapes, rotation });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
        {/* <div id='user' style={{ backgroundColor: 'pink' }}>
          <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
          <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
            <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
            <Avatar url="https://models.readyplayer.me/6694131434432ca7ede8f974.glb?morphTargets=ARKit&textureAtlas=1024" blendshapes={userBlendshapes} rotation={userRotation} />
            </Canvas>
            </div> */}

            <FaceLandmarkRenderer onFaceUpdate={handleUserFaceUpdate} />
          <UserComponent blendshapes={userBlendshapes} rotation={userRotation} />

        {/* <div id='peer' style={{ backgroundColor: 'lavenderblush' }}>
          {/* <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
            <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
            <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
            <Avatar url="https://models.readyplayer.me/669411f67a0772243cfc9cd2.glb?morphTargets=ARKit&textureAtlas=1024" blendshapes={peerBlendshapes} rotation={peerRotation} />
          </Canvas>
        </div> */}

          <FaceLandmarkRenderer onFaceUpdate={handlePeerFaceData} />
        <PeerComponent blendshapes={peerBlendshapes} rotation={peerRotation} />
      </div>

      <video autoPlay ref={userVideoRef} hidden />
      <video autoPlay ref={peerVideoRef} hidden />
      <button onClick={toggleMic} type="button">
        {micActive ? 'Mute Mic' : 'UnMute Mic'}
      </button>
      <button onClick={leaveRoom} type="button">
        Leave
      </button>
      <button onClick={toggleCamera} type="button">
        {cameraActive ? 'Stop Camera' : 'Start Camera'}
      </button>
    </div>
  );
};

export default Room;
