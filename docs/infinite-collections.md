# Infinite collections

`InfiniteMenu` rotates image tiles around a sphere. `InfiniteCardGrid` pans an endless two-dimensional gallery and opens a selected card in a detail view. Supply your own images and content; neither component embeds a remote demo or fetches a component implementation.

```tsx
import { InfiniteMenu, InfiniteCardGrid } from '@mova-ui/react';

const items = [
  { image: '/photos/coast.jpg', title: 'Coast', description: 'A quiet afternoon by the sea.', link: '/work/coast' },
  { image: '/photos/mountains.jpg', title: 'Mountains', description: 'Above the clouds.', link: '/work/mountains' },
];

export function Galleries() {
  return (
    <>
      <InfiniteMenu items={items} height={560} autoplay={3} />
      <InfiniteCardGrid items={items} height={560} theme="light" />
    </>
  );
}
```

Copy their standalone TypeScript sources with `mova add infinite-menu` and `mova add infinite-card-grid`. The menu has no dependencies beyond React; the grid uses Framer Motion.

## InfiniteMenu

| Prop | Default | Behavior |
| --- | --- | --- |
| `count` | `160` | Number of sphere tiles, clamped to 6–400 |
| `tileSize` | `0.63` | Tile size relative to sphere spacing |
| `roundness` | `0.2` | Corner rounding from 0 to 1 |
| `zoom` | `1.65` | Front tile magnification |
| `pullBack` | `1` | Camera retreat during a drag or toss |
| `stretch` | `0.6` | Tile stretch during motion |
| `inertia` | `0.6` | Release momentum from 0 to 1 |
| `autoplay` | `3` | Seconds between automatic selections; 0 disables it |
| `grayscale` | `true` | Desaturate tiles away from the front |
| `dim` | `0.5` | Dim tiles away from the front |
| `intro` | `true` | Initial rotation |
| `showInfo` | `true` | Show the current title, description and action |

`theme`, `accentColor`, `backgroundColor`, `height`, `style`, `className` and `label` configure presentation. `renderInfo(item, index, moving)` replaces the default information area. `onActiveChange(item, index)` reports a settled selection. `onItemClick(item, index)` handles activation; otherwise an item's safe link opens normally. Keep `items.length` at or below `count` to give every item a tile.

Drag to rotate, or focus the gallery and use the arrow keys to select a neighboring tile. Home selects the first tile; End selects the last supplied item represented on the sphere; Enter or Space activates the selected item. Autoplay pauses while hovered or focused. Reduced motion removes initial motion, autoplay and inertia and makes keyboard selection immediate.

## InfiniteCardGrid

`items` accepts `{ id?, image, title, description?, link? }`. `cardWidth=260`, `cardHeight=180`, `gap=28` and `momentum=0.35` configure the grid. `momentum=0` stops on release. Presentation props are `height`, `theme`, `style`, `className` and `label`. `onItemClick(item, index)` reports opening a card.

Drag in any direction. Arrow keys pan a focused grid; Tab reaches visible cards and pans partially visible cards into view. Enter opens a card; Escape or Close returns it to the grid and restores focus. Long details remain scrollable on touch devices. Reduced motion removes release inertia and card travel. Tile recycling keeps all items reachable when the data set exceeds the number of rendered cells.
