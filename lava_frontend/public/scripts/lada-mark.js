/* The L-ADA mark, as a 15x15 pixel grid. '#' is an opaque pixel. */
export const LADA_PIXELS = [
  '.........#...#.',
  '.....#.##..####',
  '....#####.####.',
  '..###########..',
  '.#############.',
  '.#############.',
  '###....####....',
  '##......#####..',
  '##.......###...',
  '#........####..',
  '#........###...',
  '##.......##....',
  '.#......##.....',
  '..##...##......',
  '...#####.......',
];

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Fills a <g> with the mark, merging runs of adjacent pixels so there are no seams. */
export function buildLadaMark(hostId = 'ladaMark') {
  const group = document.getElementById(hostId);
  if (!group || group.childElementCount) return group;

  LADA_PIXELS.forEach((row, y) => {
    let run = 0;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] === '#') { run++; continue; }
      if (run) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', x - run);
        rect.setAttribute('y', y);
        rect.setAttribute('width', run);
        rect.setAttribute('height', 1);
        rect.setAttribute('shape-rendering', 'crispEdges');
        group.appendChild(rect);
      }
      run = 0;
    }
  });
  return group;
}

/* A <use> of the mark, centred on the origin. scaleY defaults to scaleX. */
export function ladaMark(color, scaleX, scaleY = scaleX, hostId = 'ladaMark') {
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${hostId}`);
  use.setAttribute('fill', color);
  use.setAttribute(
    'transform',
    `translate(${-7.5 * scaleX} ${-7.5 * scaleY}) scale(${scaleX} ${scaleY})`,
  );
  return use;
}
