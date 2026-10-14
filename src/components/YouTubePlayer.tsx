/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Re-export the proprietary NguruVideoPlayer for seamless compatibility.
 */

import React from 'react';
import { NguruVideoPlayer } from './NguruVideoPlayer';

export const YouTubePlayer: React.FC<React.ComponentProps<typeof NguruVideoPlayer>> = (props) => {
  return <NguruVideoPlayer {...props} />;
};

export { NguruVideoPlayer };
