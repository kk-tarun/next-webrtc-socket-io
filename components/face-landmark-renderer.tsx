// FaceLandmarkRenderer.tsx
import React, { useEffect } from 'react';
import { FaceLandmarker, FaceLandmarkerOptions, FilesetResolver } from '@mediapipe/tasks-vision';
import { Euler, Matrix4 } from 'three';

const faceLandmarkerOptions: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    delegate: 'GPU',
  },
  numFaces: 1,
  runningMode: 'VIDEO',
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
};

let video: HTMLVideoElement;
let faceLandmarker: FaceLandmarker;
let lastVideoTime = -1;

interface FaceLandmarkRendererProps {
  onFaceUpdate: (blendshapes: any[], rotation: Euler) => void;
}

const FaceLandmarkRenderer: React.FC<FaceLandmarkRendererProps> = ({ onFaceUpdate }) => {
  const setup = async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm');
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, faceLandmarkerOptions);

    video = document.getElementById('video') as HTMLVideoElement;
    navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    }).then(function (stream) {
      video.srcObject = stream;
      video.addEventListener('loadeddata', predict);
    });
  };

  const predict = async () => {
    let nowInMs = Date.now();
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      const faceLandmarkerResult = faceLandmarker.detectForVideo(video, nowInMs);

      if (
        faceLandmarkerResult.faceBlendshapes &&
        faceLandmarkerResult.faceBlendshapes.length > 0 &&
        faceLandmarkerResult.faceBlendshapes[0].categories
      ) {
        const blendshapes = faceLandmarkerResult.faceBlendshapes[0].categories;
        const matrix = new Matrix4().fromArray(faceLandmarkerResult.facialTransformationMatrixes![0].data);
        const rotation = new Euler().setFromRotationMatrix(matrix);

        onFaceUpdate(blendshapes, rotation);
      }
    }

    window.requestAnimationFrame(predict);
  };

  useEffect(() => {
    setup();
  }, []);

  return <video className='camera-feed' id='video' autoPlay hidden></video>;
};

export default FaceLandmarkRenderer;
