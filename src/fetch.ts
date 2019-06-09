import minimist from "minimist";
import trello from "./trello";
import {filenameFromArgs, loadDataFromFile, writeDataToFile} from "./utils";

const opts = minimist(process.argv.slice(2));
const tree = loadDataFromFile(filenameFromArgs(...opts._));

function retrieveAllTrelloComments(board: string) {
  return (async () => {
    const {body} = await trello.comments.all(board);
    const result = body.reduce((m: any[], c: any) => m.concat(c.actions), []);

    console.log(result.length, "comments retrieved");
    writeDataToFile("comments.json", result);
  })();
}

retrieveAllTrelloComments(tree.id).finally(() => process.exit(0));
