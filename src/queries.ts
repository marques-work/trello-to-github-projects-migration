import {createHash} from "crypto";
import {basename, extname} from "path";
import {CommentSpec, IssueSpec} from "./github";
import {githubMemberByTrelloName} from "./preloaded_data";
import Progress from "./progress";
import {Entity, sorted} from "./types";
import {ConfigGH} from "./utils";

export type StringMapper = (input: string) => string;
export type EntityRenderer = (entity: Entity) => string;

function compact(arr: any[]): any[] {
  return arr.reduce((m, el) => {
    if (el) { m.push(el); }
    return m;
  }, []);
}

function mustBeString(maybe: string | undefined, message: string): string {
  if (void 0 === maybe) {
    throw message;
  }
  return maybe;
}

// Negative lookbehind only supported by newer V8 - meaning MODERN chrome and node
// This find number tags that are NOT part of a URL
const CARD_TAG_RE = /(?<!http[s]?:\/\/[\w\/?&%.#+=\-]+)#(\d+)\b/gim;

export class CardQuery {
  byId = new Map<string, Entity>();
  byNumber = new Map<string, Entity>();
  byShortLink = new Map<string, Entity>();
  hasAttachments = new Set<Entity>();

  constructor(cards: Entity[]) {
    for (const c of cards) {
      this.byId.set(c.id, c);
      this.byShortLink.set(c.shortLink, c);
      this.byNumber.set(c.idShort + "", c);
      if (c.attachments.length) { this.hasAttachments.add(c); }
    }
  }

  asIssueSpec(id: string, descRenderer: EntityRenderer, members: MemberQuery): IssueSpec {
    const card = this.byId.get(id)!;
    return {
      title: card.name,
      body: descRenderer(card),
      labels: card.labels.map((l: any) => l.name),
      assignees: compact(card.idMembers.map((mId: string) => members.githubLoginFor(mId)))
    };
  }

  renderer(config: ConfigGH, members: MemberQuery, checklists: ChecklistQuery, uploads: UploadsQuery): EntityRenderer {
    const urlMapper = (url: string) => uploads.remap(url, config.owner, config.repo, config.sha);
    return (card: Entity) => (compact([this.cardHeader(card),
      this.expandTrelloCardNumbersToUrl(
        AttachmentsTransform.applyToDesc(
        members.replaceMentions(
          checklists.applyToDesc(card.desc || "", card.idChecklists)
          ), card.attachments, urlMapper
        )
      ).trim()] as string[]).join("\n\n"));
  }

  urlByNumber(trelloNumber: number | string): string {
    if (!this.byNumber.has(String(trelloNumber))) {
      throw new Error(`Cannot find trello card number #${trelloNumber}`);
    }
    return this.byNumber.get(String(trelloNumber))!.shortUrl;
  }

  // Some folks referred to Trello cards by a number tag (even though that doesn't actually work
  // in Trello) so we should map them back to Trello URLs so that we can map them to proper GitHub
  // numbers in PASS 2.
  //
  // NOTE: either way, we shouldn't ignore these number tags because if we left them here, they
  // would inadvertently reference random GitHub issues, and that's not good.
  expandTrelloCardNumbersToUrl(text: string): string {
    return text.replace(CARD_TAG_RE, (_, trelloNum) => this.urlByNumber(trelloNum));
  }

  private cardHeader(card: any): string {
    return `> Migrated from [Trello Card ${card.idShort}](${this.escapeTrelloUrlFromReplacer(card.shortUrl)})`;
  }

  private escapeTrelloUrlFromReplacer(trelloUrl: string): string {
    // when you want a the original Trello URL that won't be converted to a
    // GitHub issue URL during the URL replacement
    return trelloUrl.replace(/\//g, "&#x002f;");
  }
}

const TRELLO_LINK_RE = /\b(https:\/\/trello\.com\/c\/([a-z0-9]{8})(?:\/[\w/?&%.\-=]*)?)/igm;

export class Link {
  static isGithubObject(url: string): boolean {
    return !!url.match(/\bhttps:\/\/github\.com\/[\w]+\/[\w]+\/(?:pull|issues)\/[\d]+/i);
  }

  static isTrelloCard(url: string): boolean {
    // use string.match(), not regex.test() here because of the `g` flag!
    // See: https://stackoverflow.com/a/1520853
    return !!url.match(TRELLO_LINK_RE);
  }

  static remapToGithub(cards: CardQuery, progress: Progress): StringMapper {
    function resolver(shortLink: string) {
      if (cards.byShortLink.has(shortLink)) {
        const trelloId = cards.byShortLink.get(shortLink)!.id;
        const issueNum = progress.githubId("cards.number", trelloId);
        if (void 0 !== issueNum) {
          return `#${issueNum}`;
        }
        console.error(`Link: ${shortLink} (id: ${trelloId}) was not resolved to a Github Issue`);
      }
    }

    return (text: string) =>
      text.replace(TRELLO_LINK_RE, (_: string, trelloUrl: string, shortId: string) => (resolver(shortId) || trelloUrl));
  }
}

class AttachmentsTransform {
  static applyToDesc(cardDesc: string, attachments: any[], urlMapper: (url: string) => string) {
    if (!attachments.length) { return cardDesc; }

    const related = [], uploads = [];

    for (const a of sorted(attachments)) {
      if (a.isUpload) {
        uploads.push(`* ${AttachmentsTransform.isImg(a.name) ? "!" : ""}[${a.name}](${urlMapper(a.url)})`);
      } else {
        if (Link.isGithubObject(a.url) || Link.isTrelloCard(a.url) || a.name === a.url) {
          // otherwise end up with [#123](#123) after remapping trello -> github,
          // which is wrong (won't link to issue/PR)!
          related.push(`* ${a.url}`);
        } else {
          related.push(`* [${a.name}](${a.url})`);
        }
      }
    }

    const attachedContent = [
      (related.length ? `## Related\n\n${related.join("\n")}` : ""),
      (uploads.length ? `## Attachments\n\n${uploads.join("\n")}` : "")
    ].join("\n\n").trim();

    return cardDesc.trim().length ?
      cardDesc.trim() + "\n\n" + attachedContent :
      attachedContent;
  }

  static isImg(filename: string): boolean {
    switch (extname(filename).toLowerCase()) {
      case ".png":
      case ".jpg":
      case ".jpeg":
      case ".gif":
        return true;
    }
    return false;
  }
}

function sortByDate<T>(arr: T[]): T[] {
  return arr.slice().sort((a: any, b: any) => (new Date(a.date)).getTime() - (new Date(b.date)).getTime());
}

export class CommentsQuery {
  byCard = new Map<string, Entity[]>();

  readonly length: number;

  constructor(comments: Entity[]) {
    this.length = comments.length;

    for (const c of comments) {
      this.byCard.set(c.data.card.id, sortByDate<Entity>((this.byCard.get(c.data.card.id) || []).concat(c)));
    }
  }

  getCommentsFor(card: Entity): Entity[] {
    return this.byCard.get(card.id) || [];
  }

  renderer(linkMapper: StringMapper, cards: CardQuery, members: MemberQuery): EntityRenderer {
    return (comment: Entity) => compact([
      this.authorHeader(comment, members).trim(),
      linkMapper(
        cards.expandTrelloCardNumbersToUrl(
          members.replaceMentions(comment.data.text)
        )
      ).trim()
    ]).join("\n\n");
  }

  authorHeader(comment: Entity, members: MemberQuery): string {
    return [
      `> Migrated comment original author: @${mustBeString(members.githubLoginFor(comment.idMemberCreator), `Failed to resolve member ${comment.idMember}`)}`,
      `> Original date: ${new Date(comment.date).toUTCString()} [(what's this in my time zone?)](https://dencode.com/en/date/ctime?v=${encodeURIComponent(comment.date)})`
    ].join("\n");
  }

  asSpec(comment: any, renderer: EntityRenderer): CommentSpec {
    return { body: renderer(comment) };
  }
}

export class ChecklistQuery {
  byId = new Map<string, any>();

  constructor(checklists: any[]) {
    for (const c of checklists) {
      this.byId.set(c.id, c);
    }
  }

  applyToDesc(cardDesc: string, ids: string[]): string {
    if (!ids.length) { return cardDesc; }

    const desc = cardDesc.trim().length ? cardDesc + "\n\n" : cardDesc.trim();
    ids = ids.slice().sort((a: string, b: string) => this.byId.get(a).pos - this.byId.get(b).pos);

    return desc + "## Checklists\n\n" + ids.map((id: string) => this.asMarkdown(id)).join("\n\n");
  }

  asMarkdown(id: string) {
    if (this.byId.has(id)) {
      const c: any = this.byId.get(id);
      return `### ${c.name}\n\n${sorted(c.checkItems).map(
        (i: any) => `- [${"complete" === i.state ? "x" : " "}] ${i.name}`
      ).join("\n")}`;
    }
  }
}

function sha256(subj: string): string {
  return createHash("sha256").update(subj).digest("hex");
}

interface Upload {
  name: string;
  url: string;
  key: string;
}

export class UploadsQuery {
  byUrl = new Map<string, Upload>();
  attachments: Upload[] = [];

  constructor(cards: any[]) {
    for (const card of cards) {
      for (const a of card.attachments.filter((a: any) => a.isUpload)) {
        const upload = {
          name: a.name,
          url: a.url,
          key: [".github", "trello-attachments", sha256(a.url), basename(a.url)].join("/")
        };
        this.attachments.push(upload);
        this.byUrl.set(a.url, upload);
      }
    }
  }

  remap(url: string, owner: string, repo: string, commit: string): string {
    if (!this.byUrl.has(url)) {
      console.error("Could not map attachment url:", url);
      return url;
    }
    return ["https://raw.githubusercontent.com", owner, repo, commit, this.byUrl.get(url)!.key].join("/");
  }
}

const AT_MENTION_RE = /(^|\W)@([\w_-]+)/gim;

export class MemberQuery {
  byId   = new Map<string, any>();
  byUser = new Map<string, any>();

  constructor(members: any[]) {
    for (const m of members) {
      const ghUser = githubMemberByTrelloName(m.username);

      if (ghUser) {
        this.byId.set(m.id, ghUser);
        this.byUser.set(m.username, ghUser);
      }
    }
  }

  replaceMentions(desc: string): string {
    return desc.replace(AT_MENTION_RE, (_: string, $1: string, username: string) => `${$1}@${(this.remapMention(username) || username)}`);
  }

  remapMention(username: string) {
    if (this.byUser.has(username)) {
      return this.byUser.get(username).login;
    }
  }

  githubLoginFor(id: string): string | undefined {
    if (this.byId.has(id)) {
      return this.byId.get(id).login;
    }
  }
}
