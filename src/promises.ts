export type Promiser = () => Promise<any>;

// Taks an array of Promisers, returning a Promiser that will execute promises sequentially
export function sequence(...promisers: Promiser[]): Promiser {
  return (async () => {
    let result: Promise<any> = Promise.resolve();
    for (const p of promisers) { result = await p(); } // promises, promises...
    return result;
  });
}

// Returns a Promiser wrapping the execution of a promise with text and flushes
export function announce(name: string, promiser: Promiser): Promiser {
  return wrap(promiser, `Migrating ${name}...`, `${name} migrated.`);
}

export function wrap(promiser: Promiser, before: string, after: string): Promiser {
  return (async () => {
    console.log(before);
    await promiser();
    console.log(after);
  });
}
