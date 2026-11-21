# SpatialMusicGallery

A pannable music collection with a radial focus lens, album cards, playback controls, favorites and a queue. Images and optional audio belong to your application; the component does not embed a remote service.

```tsx
import { SpatialMusicGallery, type SpatialMusicTrack } from '@mova-ui/react';

const tracks: SpatialMusicTrack[] = [
  { id: 'coast', title: 'Quiet Coast', artist: 'Northbound', album: 'After Hours', image: '/art/coast.webp', duration: 180, src: '/audio/coast.mp3' },
  { id: 'night', title: 'Night Window', artist: 'Northbound', image: '/art/night.webp', duration: 210 },
];

export function Collection() {
  return <SpatialMusicGallery items={tracks} title="Late evenings" subtitle="A collection for slowing down" height={720} />;
}
```

The source is also available through `mova add spatial-music-gallery`. It has no runtime dependency beyond React.

| Prop | Default | Behavior |
| --- | --- | --- |
| `items` | Required | Tracks with unique `id`, `title`, `artist`, `image`, duration in seconds, optional `album` and `src` |
| `title`, `subtitle` | “In rotation”, “A collection of good company” | Fixed collection heading |
| `cardWidth`, `gap` | `220`, `40` | Base card width and wall spacing |
| `focusScale`, `edgeScale` | `1.35`, `0.55` | Card size at the center and far from it |
| `falloff` | `1` | How quickly the center lens fades |
| `dim` | `0.6` | Maximum opacity reduction away from the center |
| `momentum` | `0.75` | Pan momentum from 0 to 1; 0 stops on release |
| `volume` | `0.65` | Native audio volume from 0 to 1 |
| `height` | `720` | Scene height; minimum 400px |
| `theme` | `dark` | `dark` or `light` |

`initialTrackId`, `defaultPlaying`, `defaultQueue`, `defaultFavorites` and `defaultQueueOpen` configure the initial state. Queue and favorite IDs are deduplicated and limited to supplied tracks. `onTrackChange(track, index)`, `onPlayChange(playing)`, `onQueueChange(ids)` and `onFavoriteChange(ids)` report interactions. `onBack` optionally adds a working back button. `label`, `className` and `style` customize the root.

Drag or use a wheel/trackpad to pan. Click a card to center it and play. The + button toggles its queue membership; the heart toggles its favorite state. Next consumes queued tracks before advancing through the collection. Previous restarts a track after three seconds, otherwise selects the previous track. The locate button returns the current song to the center. Seeking works while playing or paused.

With `src`, the component uses native audio and reports playback errors visibly. Without `src`, it runs a local demonstration clock with the supplied duration and announces that preview mode to assistive technology. Playback begins paused by default.

Keyboard users can focus the collection and pan with the arrow keys, toggle playback with Space or Enter, locate with Home and open the queue with Q. Tab reaches visible card controls and fixed transport controls; Escape closes the queue and restores focus. Reduced motion removes inertial travel and animated centering while preserving all controls.
