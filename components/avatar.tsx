// Avatar.tsx
import React, { useEffect } from 'react';
import { Euler } from 'three';
import { useFrame, useGraph } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

interface AvatarProps {
  url: string;
  blendshapes: any[];
  rotation: Euler | null;
}

const Avatar: React.FC<AvatarProps> = ({ url, blendshapes, rotation }) => {
  const { scene } = useGLTF(url);
  const { nodes } = useGraph(scene);

  const headMesh: any[] = [];

  useEffect(() => {
    if (nodes.Wolf3D_Head) headMesh.push(nodes.Wolf3D_Head);
    if (nodes.Wolf3D_Teeth) headMesh.push(nodes.Wolf3D_Teeth);
    if (nodes.Wolf3D_Beard) headMesh.push(nodes.Wolf3D_Beard);
    if (nodes.Wolf3D_Avatar) headMesh.push(nodes.Wolf3D_Avatar);
    if (nodes.Wolf3D_Head_Custom) headMesh.push(nodes.Wolf3D_Head_Custom);
  }, [nodes]);

  useFrame(() => {
    if (blendshapes.length > 0) {
      blendshapes.forEach((element) => {
        headMesh.forEach((mesh) => {
          let index = mesh.morphTargetDictionary[element.categoryName];
          if (index >= 0) {
            mesh.morphTargetInfluences[index] = element.score;
          }
        });
      });

      if (rotation) {
        nodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
        nodes.Neck.rotation.set(rotation.x / 5 + 0.3, rotation.y / 5, rotation.z / 5);
        nodes.Spine2.rotation.set(rotation.x / 10, rotation.y / 10, rotation.z / 10);
      }
    }
  });

  return <primitive object={scene} position={[0, -1.75, 3]} />;
};

export default Avatar;
