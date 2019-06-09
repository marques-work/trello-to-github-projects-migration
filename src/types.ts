export interface Orderable { pos: number; }
export interface Typed { type: string; }
export interface Entity { id: number; }

export function sorted(arr: Orderable[]) {
  return arr.sort((a: Orderable, b: Orderable) => a.pos - b.pos);
}

export function isEntity(a: Entity | any): a is Entity {
  return "number" === typeof (a as Entity).id;
}
