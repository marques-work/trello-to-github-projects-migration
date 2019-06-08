import fs from "fs";

export function die(...args: any[]) {
  console.error(...args);
  process.exit(1);
}

export function loadDataFromFile(filename: string): any {
  // could possibly use `require(path)` here
  return JSON.parse(fs.readFileSync(filename, "utf-8").trim());
}

export function writeDataToFile(filename: string, data: any) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

export function isRegularFile(path: string): boolean {
  try {
    return fs.lstatSync(path).isFile();
  } catch (e) {
    return false; // does not exist
  }
}

export function filenameFromArgs(): string {
  if (process.argv.length < 3) {
    die("Please specify a json dump");
  }

  const filename = process.argv[2];

  if (!isRegularFile(filename)) { die(`File [${filename}] does not exist or is not readable`); }

  return filename;
}
