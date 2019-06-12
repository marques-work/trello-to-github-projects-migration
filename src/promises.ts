export type Promiser = () => Promise<any>;

// Taks an array of Promisers, returning a Promiser that will execute promises sequentially
export function sequence(...promisers: Promiser[]): Promiser {
  return (async () => {
    for (const p of promisers) { await p(); } // promises, promises...
  });
}

// Returns a Promiser wrapping the execution of a promise with text and flushes
export function announce(name: string, promiser: Promiser): Promiser {
  return (async () => {
    console.log(`Migrating ${name}...`);
    await promiser();
    console.log(`${name} migrated.`);
  });
}
