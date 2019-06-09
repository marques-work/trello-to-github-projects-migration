import {ApiResponse} from "./api_base";
import {isEntity} from "./types";
import {isRegularFile, loadDataFromFile, writeDataToFile} from "./utils";

interface Mapping {
  [key: string]: IdMap;
}

// prefer instead of ES6 Map<string, number> because of de/serialization
interface IdMap { [key: string]: number; }

function assertsObject(obj: any, label: string) {
  if (!obj || "object" !== typeof obj) {
    throw new TypeError(`Expected ${label} to be an object: => ${JSON.stringify(obj)}`);
  }
}

function assertsNotArrayLike(obj: any, label: string) {
  if (obj instanceof Array || ("string" !== typeof obj && obj[Symbol.iterator])) {
    throw new TypeError(`${label} should not be an array or other iterable: => ${JSON.stringify(obj)}`);
  }
}

function assertNumber(obj: any, label: string) {
  if ("number" !== typeof obj) {
    throw new TypeError(`Expected ${label} be a number: => ${JSON.stringify(obj)}`);
  }

  if (obj <= 0) {
    throw new Error(`Expected ${label} to be a postive number: ${obj}`);
  }
}

function validate(maybeMapping: Mapping) {
  assertsObject(maybeMapping, "top-level");

  for (const key of Object.keys(maybeMapping)) {
    const subtree = maybeMapping[key];

    assertsObject(subtree, `${key} (want: IdMap)`);
    assertsNotArrayLike(subtree, `${key} (want: IdMap)`);

    for (const id of Object.keys(subtree)) {
      assertNumber(subtree[id], `mapping ${key}.${id}`);
    }
  }
}

export default class Progress {
  flush: () => void;
  markDone: (path: string, id: string, ghId: number) => void;
  isDone: (path: string, id: string) => boolean;
  githubId: (path: string, id: string) => number | undefined;

  constructor(outfile: string, paranoid: boolean = false) {
    let contents: Mapping = {}; // form a closure to make this truly private

    if (isRegularFile(outfile)) {
      contents = loadDataFromFile(outfile);
      validate(contents);
    } else {
      flush();
    }

    function markDone(path: string, id: string, ghId: number) {
      const subtree: IdMap = contents[path] = (contents[path] || {});

      if (isDone(path, id)) {
        throw new Error(`Attempted to mark ${path}.${id} but was already marked! existing: ${JSON.stringify(subtree[id])}; new: ${JSON.stringify(ghId)}`);
      }

      assertNumber(ghId, `new github id for markDone(${path}, ${id}, <github id>)`);

      subtree[id] = ghId;
      if (paranoid) { flush(); } // I/O heavy, but should make it safe enough for concurrent markDone() calls
    }

    function isDone(path: string, id: string) {
      const subtree = contents[path];
      return (subtree && "number" === typeof subtree[id] && subtree[id] > 0/* reasonable assumption */);
    }

    function githubId(path: string, id: string): number | undefined {
      return isDone(path, id) ? contents[path][id] : undefined;
    }

    function flush() {
      console.log("flushing");
      writeDataToFile(outfile, contents);
    }

    this.flush = flush;
    this.markDone = markDone;
    this.isDone = isDone;
    this.githubId = githubId;
  }

  track(path: string, id: string, create: () => Promise<ApiResponse>) {
    const progress = this;
    return (async () => {
      if (!progress.isDone(path, id)) {
        try {
          console.log(`  Trying ${path}.${id}...`);
          const {body, status} = await create();

          if (status < 200 || status > 299) {
            throw new Error(`status should be 2XX, but was ${status}`);
          }

          if (!isEntity(body)) {
            throw new TypeError(`Expected body.id to be a number! body: ${JSON.stringify(body)}`);
          }

          progress.markDone(path, id, body.id);
        } catch (e) {
          console.error(`  Failed to create ${path} item ${id} in GitHub`);
          throw e;
        }
      } else {
        console.debug(`  Nothing to do for: ${path}.${id}`);
      }
    })();
  }
}
