import {IncomingHttpHeaders} from "http";

export interface ApiResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: any;
}

export interface Orderable { pos: number; }
export interface Typed { type: string; }
export interface Entity { id: number; }

export function isEntity(a: Entity | any): a is Entity {
  return "number" === typeof (a as Entity).id;
}
