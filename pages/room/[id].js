import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useSocket from '../../hooks/useSocket';

import { FaceLandmarker, FaceLandmarkerOptions, FilesetResolver } from "@mediapipe/tasks-vision";
import { Color, Euler, Matrix4 } from 'three';
import { Canvas, useFrame, useGraph } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    }
  ],
};

let video;
let faceLandmarker;
let lastVideoTime = -1;
let blendshapes = [];
let rotation;
let headMesh = [];

const options = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: "GPU"
  },
  numFaces: 1,
  runningMode: "VIDEO",
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
};

function Avatar({ url }) {
  const { scene } = useGLTF(url);
  const { nodes } = useGraph(scene);

  useEffect(() => {
    if (nodes.Wolf3D_Head) headMesh.push(nodes.Wolf3D_Head);
    if (nodes.Wolf3D_Teeth) headMesh.push(nodes.Wolf3D_Teeth);
    if (nodes.Wolf3D_Beard) headMesh.push(nodes.Wolf3D_Beard);
    if (nodes.Wolf3D_Avatar) headMesh.push(nodes.Wolf3D_Avatar);
    if (nodes.Wolf3D_Head_Custom) headMesh.push(nodes.Wolf3D_Head_Custom);
  }, [nodes, url]);

  useFrame(() => {
    if (blendshapes.length > 0) {
      blendshapes.forEach(element => {
        headMesh.forEach(mesh => {
          let index = mesh.morphTargetDictionary[element.categoryName];
          if (index >= 0) {
            mesh.morphTargetInfluences[index] = element.score;
          }
        });
      });

      nodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
      nodes.Neck.rotation.set(rotation.x / 5 + 0.3, rotation.y / 5, rotation.z / 5);
      nodes.Spine2.rotation.set(rotation.x / 10, rotation.y / 10, rotation.z / 10);
    }
  });

  return <primitive object={scene} position={[0, -1.75, 3]} />
}

const Room = () => {
  useSocket();
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  const router = useRouter();
  const userVideoRef = useRef();
  const peerVideoRef = useRef();
  const rtcConnectionRef = useRef(null);
  const socketRef = useRef();
  const userStreamRef = useRef();
  const hostRef = useRef(false);

  const { id: roomName } = router.query;

  const urls = [
    "https://models.readyplayer.me/6694131434432ca7ede8f974.glb?morphTargets=ARKit&textureAtlas=1024",
    "https://models.readyplayer.me/66940e7534432ca7ede8e1fd.glb?morphTargets=ARKit&textureAtlas=1024",
    "https://models.readyplayer.me/6694114b878f8e58dc31a86b.glb?morphTargets=ARKit&textureAtlas=1024",
    "https://models.readyplayer.me/669411f67a0772243cfc9cd2.glb?morphTargets=ARKit&textureAtlas=1024"
  ];

  const [url, setUrl] = useState(urls[Math.floor(Math.random() * urls.length)]);

  const predict = async () => {
    let nowInMs = Date.now();
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      const faceLandmarkerResult = faceLandmarker.detectForVideo(video, nowInMs);

      if (faceLandmarkerResult.faceBlendshapes && faceLandmarkerResult.faceBlendshapes.length > 0 && faceLandmarkerResult.faceBlendshapes[0].categories) {
        blendshapes = faceLandmarkerResult.faceBlendshapes[0].categories;

        const matrix = new Matrix4().fromArray(faceLandmarkerResult.facialTransformationMatrixes[0].data);
        rotation = new Euler().setFromRotationMatrix(matrix);
      }
    }

    window.requestAnimationFrame(predict);

  }

  const setup = async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, options);

    video = document.getElementById("video");
    navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    }).then(function (stream) {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predict);
    });
  }

  useEffect(() => {
    setup();

    socketRef.current = io();

    // First we join a room
    socketRef.current.emit('join', roomName);

    socketRef.current.on('joined', handleRoomJoined);

    // If the room didn't exist, the server would emit the room was 'created'
    socketRef.current.on('created', handleRoomCreated);

    // Whenever the next person joins, the server emits 'ready'
    socketRef.current.on('ready', initiateCall);

    // Emitted when a peer leaves the room
    socketRef.current.on('leave', onPeerLeave);

    // If the room is full, we show an alert
    socketRef.current.on('full', () => {
      window.location.href = '/';
    });

    // Event called when a remote user initiating the connection and
    socketRef.current.on('offer', handleReceivedOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);

    // clear up after
    return () => socketRef.current.disconnect();
  }, [roomName]);

  const handleRoomJoined = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStreamRef.current = stream;
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.onloadedmetadata = () => {
          userVideoRef.current.play();
        };
        socketRef.current.emit('ready', roomName);
      })
      .catch((err) => {
        /* handle the error */
        console.log('error', err);
        console.error('Error accessing media devices.', err);

        // Check for specific error codes and provide feedback
        switch (err.name) {
          case 'NotAllowedError':
            alert('Permissions to access the camera and microphone are required.');
            break;
          case 'NotFoundError':
            alert('No camera or microphone found on this device.');
            break;
          case 'NotReadableError':
            alert('The device hardware is not accessible. Please try again.');
            break;
          default:
            alert('An unknown error occurred: ' + err.message);
            break;
        }
      });
  };

  const handleRoomCreated = () => {
    hostRef.current = true;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStreamRef.current = stream;
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.onloadedmetadata = () => {
          userVideoRef.current.play();
        };
      })
      .catch((err) => {
        /* handle the error */
        console.log(err);
      });
  };

  const initiateCall = () => {
    if (hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current,
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      );
      rtcConnectionRef.current
        .createOffer()
        .then((offer) => {
          rtcConnectionRef.current.setLocalDescription(offer);
          socketRef.current.emit('offer', offer, roomName);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const onPeerLeave = () => {
    // This person is now the creator because they are the only person in the room.
    hostRef.current = true;
    if (peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of Peer.
    }

    // Safely closes the existing connection established with the peer who left.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
  }

  /**
   * Takes a userid which is also the socketid and returns a WebRTC Peer
   *
   * @param  {string} userId Represents who will receive the offer
   * @returns {RTCPeerConnection} peer
   */

  const createPeerConnection = () => {
    // We create a RTC Peer Connection
    const connection = new RTCPeerConnection(ICE_SERVERS);

    // We implement our onicecandidate method for when we received a ICE candidate from the STUN server
    connection.onicecandidate = handleICECandidateEvent;

    // We implement our onTrack method for when we receive tracks
    connection.ontrack = handleTrackEvent;
    return connection;

  };

  const handleReceivedOffer = (offer) => {
    if (!hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current,
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      );
      rtcConnectionRef.current.setRemoteDescription(offer);

      rtcConnectionRef.current
        .createAnswer()
        .then((answer) => {
          rtcConnectionRef.current.setLocalDescription(answer);
          socketRef.current.emit('answer', answer, roomName);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const handleAnswer = (answer) => {
    rtcConnectionRef.current
      .setRemoteDescription(answer)
      .catch((err) => console.log(err));
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      socketRef.current.emit('ice-candidate', event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    // We cast the incoming candidate to RTCIceCandidate
    const candidate = new RTCIceCandidate(incoming);
    rtcConnectionRef.current
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  };

  const handleTrackEvent = (event) => {
    // eslint-disable-next-line prefer-destructuring
    peerVideoRef.current.srcObject = event.streams[0];
  };

  const toggleMediaStream = (type, state) => {
    userStreamRef.current.getTracks().forEach((track) => {
      if (track.kind === type) {
        // eslint-disable-next-line no-param-reassign
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
    socketRef.current.emit('leave', roomName); // Let's the server know that user has left the room.

    if (userVideoRef.current.srcObject) {
      userVideoRef.current.srcObject.getTracks().forEach((track) => track.stop()); // Stops receiving all track of User.
    }
    if (peerVideoRef.current.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving audio track of Peer.
    }

    // Checks if there is peer on the other side and safely closes the existing connection established with the peer.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
    router.push('/')
  };

  return (
    <div>
      {/* <video autoPlay ref={userVideoRef} hidden /> */}
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
      <div>
        <video className='camera-feed' ref={userVideoRef} id="video" hidden autoPlay></video>
        <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
          <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
          <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
          <Avatar url={url} />
        </Canvas>
      </div>
    </div>
  );
};

export default Room;
