// types.ts — control instance types derived from drei's components, so
// the town needs no direct dependency on three-stdlib.

import type { ComponentRef } from 'react';
import type { OrbitControls, PointerLockControls } from '@react-three/drei';

export type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
export type PointerLockImpl = ComponentRef<typeof PointerLockControls>;
