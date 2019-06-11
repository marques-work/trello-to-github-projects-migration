import fs from "fs";
import https from "https";
import minimist from "minimist";
import {basename, dirname, join} from "path";
import {UploadsQuery} from "../queries";
import {filenameFromArgs, isRegularFile, loadDataFromFile} from "../utils";

const opts = minimist(process.argv.slice(2));
const tree = loadDataFromFile(filenameFromArgs(...opts._));

const uploads = new UploadsQuery(tree.cards);

(async () => {
  for (const f of uploads.attachments.slice()) {
    await download(f.url, dirname(f.key), basename(f.key));
  }
  console.log("done.");
})();

function download(url: string, dirname: string, filename: string) {
  return new Promise<void>((resolve, reject) => {
    fs.mkdirSync(dirname, {recursive: true});
    filename = join(dirname, filename);

    if (isRegularFile(filename)) {
      console.log("Already downloaded", url);
      return resolve();
    }

    const file = fs.createWriteStream(filename);
    console.log("fetching", url);

    https.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      console.error("[ERROR] failed to save " + url + " to " + filename, err);
      fs.unlinkSync(filename);
      reject(err);
    });
  });
}
