import { Screen } from '../Screen.js';
import { el } from '../components/dom.js';

/**
 * MapScreen — the survey: a hand-drawn-feeling top-down of the current
 * level. Only rooms you've entered are drawn (mapSeen flags); shrines and
 * the bell appear once their room is known. The player is the blood arrow.
 *
 * Levels author `map: { rooms: [{id, label, min:[x,z], max:[x,z]}],
 * markers: [{type, position:[x,z]}] }`. Rooms are matched in order, so
 * nested rooms (the garth inside the walks) list first.
 */
export class MapScreen extends Screen {
  #levelName;
  #map;
  #story;
  #levelId;
  #playerObject;
  #events;
  #onClose;

  constructor({ levelName, map, story, levelId, playerObject, events, onClose }) {
    super();
    this.#levelName = levelName;
    this.#map = map;
    this.#story = story;
    this.#levelId = levelId;
    this.#playerObject = playerObject;
    this.#events = events;
    this.#onClose = onClose;
  }

  build() {
    const canvas = el('canvas.map-canvas', { width: 720, height: 500 });
    return el(
      'div.screen.panel-screen',
      {},
      el(
        'div.panel',
        {},
        el(
          'div.panel-header',
          {},
          el('h2', {}, 'Survey'),
          el('div.crumb', {}, this.#levelName.toUpperCase()),
          el('div.crumb', {}, 'M / ESC TO CLOSE')
        ),
        el('div.panel-body.map-body', {}, canvas),
        el('div.panel-footer', {}, 'ONLY WHAT YOU HAVE WALKED IS DRAWN')
      )
    );
  }

  onShow() {
    window.addEventListener('keydown', this.#onKey);
    this.#draw();
  }

  onHide() {
    window.removeEventListener('keydown', this.#onKey);
  }

  #onKey = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyM') {
      e.preventDefault();
      this.#events.emit('audio/sfx', { id: 'uiBack' });
      this.#onClose();
    }
  };

  #seen(roomId) {
    return Boolean(this.#story.get(`mapSeen:${this.#levelId}:${roomId}`));
  }

  #draw() {
    const canvas = this.element.querySelector('.map-canvas');
    const ctx = canvas.getContext('2d');
    const { rooms, markers = [] } = this.#map;

    // Fit all rooms into the canvas with margins.
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const room of rooms) {
      minX = Math.min(minX, room.min[0]);
      minZ = Math.min(minZ, room.min[1]);
      maxX = Math.max(maxX, room.max[0]);
      maxZ = Math.max(maxZ, room.max[1]);
    }
    const margin = 46;
    const scale = Math.min(
      (canvas.width - margin * 2) / (maxX - minX),
      (canvas.height - margin * 2) / (maxZ - minZ)
    );
    const ox = (canvas.width - (maxX - minX) * scale) / 2;
    const oz = (canvas.height - (maxZ - minZ) * scale) / 2;
    const px = (x) => ox + (x - minX) * scale;
    const pz = (z) => oz + (z - minZ) * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anySeen = rooms.some((r) => this.#seen(r.id));
    if (!anySeen) {
      ctx.fillStyle = 'rgba(154, 146, 126, 0.8)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('YOU HAVE WALKED NOWHERE YET', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Rooms: parchment fill + bone strokes, slightly unsteady lines.
    for (const room of rooms) {
      if (!this.#seen(room.id)) continue;
      const x = px(room.min[0]);
      const z = pz(room.min[1]);
      const w = (room.max[0] - room.min[0]) * scale;
      const h = (room.max[1] - room.min[1]) * scale;
      ctx.fillStyle = 'rgba(230, 221, 198, 0.07)';
      ctx.fillRect(x, z, w, h);
      ctx.strokeStyle = 'rgba(230, 221, 198, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, z, w, h);
      ctx.fillStyle = 'rgba(154, 146, 126, 0.9)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '2px';
      ctx.fillText(room.label.toUpperCase(), x + w / 2, z + 14);
    }

    // Markers, only in rooms you know.
    for (const marker of markers) {
      const room = rooms.find(
        (r) =>
          marker.position[0] >= r.min[0] &&
          marker.position[0] <= r.max[0] &&
          marker.position[1] >= r.min[1] &&
          marker.position[1] <= r.max[1]
      );
      if (!room || !this.#seen(room.id)) continue;
      const x = px(marker.position[0]);
      const z = pz(marker.position[1]);
      ctx.strokeStyle = '#d42b2b';
      ctx.lineWidth = 2;
      if (marker.type === 'shrine') {
        ctx.beginPath();
        ctx.moveTo(x, z - 6);
        ctx.lineTo(x, z + 6);
        ctx.moveTo(x - 5, z - 1);
        ctx.lineTo(x + 5, z - 1);
        ctx.stroke();
      } else if (marker.type === 'bell') {
        ctx.beginPath();
        ctx.arc(x, z, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // door / transition: a notch
        ctx.strokeRect(x - 3, z - 3, 6, 6);
      }
    }

    // The player: a blood arrow. rotY 0 faces +z (down-screen).
    const p = this.#playerObject.position;
    const rot = this.#playerObject.rotation.y;
    const cx = px(p.x);
    const cz = pz(p.z);
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(-rot + Math.PI); // world yaw → canvas angle
    ctx.fillStyle = '#d42b2b';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
