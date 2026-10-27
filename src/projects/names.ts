import { collisionKey, safePath } from '../storage/paths';

/** Converts a display title into a portable human name; identities never enter filenames. */
export function readableName(title: string, maximum = 80): string {
  const name = title.normalize('NFC').replace(/[\\/\x00-\x1f\x7f:*?"<>|]/g, ' – ').replace(/\s+/g, ' ').replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, maximum).replace(/[\uD800-\uDBFF]$/u, '').trim() || 'Ohne Titel';
  try { safePath(name); return name; } catch { return `Notiz ${name}`; }
}
/** Allocates ordinary names with (2), (3), … only for actual portable path collisions. */
export class NameAllocator {
  private readonly occupied = new Set<string>();
  /** Includes parent folders inferred from existing files; never assumes folder ownership. */
  constructor(paths: string[]) {
    for (const path of paths) {
      const segments = path.split('/');
      for (let i = 1; i <= segments.length; i++) this.occupied.add(collisionKey(segments.slice(0, i).join('/')));
    }
  }
  /** Reserves one new file or directory, retaining readable titles and conservative NFC/case matching. */
  allocate(parent: string, label: string, extension = ''): string {
    const base = readableName(label, 90 - extension.length);
    for (let index = 1; ; index++) {
      const path = safePath(`${parent}/${base}${index === 1 ? '' : ` (${index})`}${extension}`);
      if (!this.occupied.has(collisionKey(path))) { this.occupied.add(collisionKey(path)); return path; }
    }
  }
}
