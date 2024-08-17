import React, { useState } from 'react';
// import './App.css';
import { Canvas } from '@react-three/fiber';
import { Color, Euler } from 'three';
import Avatar from './avatar';
import FaceLandmarkRenderer from './face-landmark-renderer';

interface PeerAvatarProps {
  blendshapes: any[];
  rotation: Euler | null;
}

const PeerComponent: React.FC<PeerAvatarProps> = ({ blendshapes, rotation }) => {
  const [peerBlendshapes, setPeerBlendshapes] = useState<any[]>([]);
  const [peerRotation, setPeerRotation] = useState<Euler | null>(null);

  const handleFaceUpdate = (newBlendshapes: any[], newRotation: Euler) => {
    setPeerBlendshapes(newBlendshapes);
    setPeerRotation(newRotation);
  };

  return (
    <div id='peer' style={{backgroundColor: 'pink'}}>
      <FaceLandmarkRenderer onFaceUpdate={handleFaceUpdate} />
      <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
        <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
        <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
        <Avatar url="https://models.readyplayer.me/669411f67a0772243cfc9cd2.glb?morphTargets=ARKit&textureAtlas=1024" blendshapes={blendshapes} rotation={rotation} />
      </Canvas>
    </div>
  );
}

export default PeerComponent;