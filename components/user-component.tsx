import React, { useState } from 'react';
// import './App.css';
import { Canvas } from '@react-three/fiber';
import { Color, Euler } from 'three';
import Avatar from './avatar';
import FaceLandmarkRenderer from './face-landmark-renderer';

interface UserAvatarProps {
  blendshapes: any[];
  rotation: Euler | null;
}


const UserComponent: React.FC<UserAvatarProps> = ({ blendshapes, rotation}) => {
  const [userBlendshapes, setUserBlendshapes] = useState<any[]>([]);
  const [userRotation, setUserRotation] = useState<Euler | null>(null);

  const handleFaceUpdate = (newBlendshapes: any[], newRotation: Euler) => {
    setUserBlendshapes(newBlendshapes);
    setUserRotation(newRotation);
  };

  return (
    <div id='user' style={{backgroundColor: 'pink'}}>
      <FaceLandmarkRenderer onFaceUpdate={handleFaceUpdate} />
      <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
        <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
        <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
        <Avatar url="https://models.readyplayer.me/6694131434432ca7ede8f974.glb?morphTargets=ARKit&textureAtlas=1024" blendshapes={blendshapes} rotation={rotation} />
      </Canvas>
    </div>
  );
}

export default UserComponent;