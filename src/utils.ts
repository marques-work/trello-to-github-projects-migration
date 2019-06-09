import fs from "fs";

export function die(...args: any[]) {
  console.error(...args);
  process.exit(1);
}

export function loadDataFromFile(filename: string): any {
  // could possibly use `require(path)` here
  return JSON.parse(fs.readFileSync(filename, "utf-8").trim());
}

export function writeDataToFile(filename: string, data: any) { // consider write-file-atomic package?
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

export function isRegularFile(path: string): boolean {
  try {
    return fs.lstatSync(path).isFile();
  } catch (e) {
    return false; // does not exist
  }
}

export function loadConfig(file: string): Config {
  if (void 0 === file) { die("You must specify a config file with --config"); }
  if (!isRegularFile(file)) { die(`Config file "${file}" does not exist or is not readable`); }

  const config = loadDataFromFile(file);

  if (!isValidConfig(config)) { die(`Config file "${file}" is not a valid config`); }

  return config;
}

export function filenameFromArgs(...args: string[]): string {
  if (!args.length) {
    die("Please specify a json dump");
  }

  const filename = args[0];

  if (!isRegularFile(filename)) { die(`File [${filename}] does not exist or is not readable`); }

  return filename;
}

function isValidConfig(c: Config | any): c is Config {
  let ok = true;

  function fail(msg: string) {
    ok = false;
    console.error(msg);
  }

  if (!c || "object" !== typeof c || c instanceof Array) {
    fail(`config must deserialize to an object`);
    return false;
  }

  const keys: Array<keyof Config> = ["projId", "progress", "owner", "repo"];

  for (const k of keys) {
    switch (k) {
      case "projId":
        if ("number" !== typeof c[k] || c[k] <= 0 || 0 !== c[k] % 1) { fail(`config key "${k}" must be a positive integer`); }
        break;
      case "progress":
      case "owner":
      case "repo":
        if ("string" !== typeof c[k] || "" === c[k].trim()) { fail(`config key "${k}" must be non-blank string`); }
        break;
    }
  }
  return ok;
}

export function env(name: string): string {
  if (!process.env[name]) {
    throw new Error(`You must set the environment variable $${name}!`);
  }
  return process.env[name]!;
}

interface Config {
  progress: string;
  projId:   number;
  owner:    string;
  repo:     string;
}
