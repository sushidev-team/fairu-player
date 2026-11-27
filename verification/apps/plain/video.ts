import React from 'react';
import { createRoot } from 'react-dom/client';
import { VideoPlayer } from '@fairu/player';
import '@fairu/player/styles.css';

createRoot(document.querySelector('#host')!).render(React.createElement(VideoPlayer, {
  config: {
    track: {
      id: 'touch-test', src: '/test-video.mp4', title: 'Mobile controls test',
      subtitles: [{ id: 'en', label: 'English', language: 'en', src: '/captions.vtt' }],
      qualities: [{ label: 'Low', src: '/test-video.mp4' }, { label: 'High', src: '/test-video.mp4?high' }],
    },
    controlsHideDelay: 500,
    features: { pictureInPicture: true, cast: true },
  },
}));
