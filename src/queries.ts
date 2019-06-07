import {githubMemberByTrelloName} from "./preloaded_data";

const cardUrlPrefix = "https://trello.com/c/", prefixLen = cardUrlPrefix.length;

function detectCardAttachment(a: any): boolean {
  return !a.isUpload && a.url.startsWith(cardUrlPrefix);
}

function shortLinkFromUrl(url: string): string {
  return url.startsWith(cardUrlPrefix) ? url.slice(prefixLen, prefixLen + 8) : url;
}

export class CardQuery {
  byId = new Map<string, any>();
  byShortLink = new Map<string, any>();
  hasAttachments = new Set<any>();
  hasCardAttachments = new Set<any>();
  attachedToOtherCard = new Set<any>();

  constructor(cards: any[]) {
    for (const c of cards) {
      this.byId.set(c.id, c);
      this.byShortLink.set(c.shortLink, c);
      if (c.attachments.length) { this.hasAttachments.add(c); }
      if (c.attachments.find(detectCardAttachment)) { this.hasCardAttachments.add(c); }
    }

    for (const c of this.hasCardAttachments) {
      for (const a of c.attachments.filter(detectCardAttachment)) {
        const dep = this.byShortLink.get(shortLinkFromUrl(a.url));
        if (dep) { this.attachedToOtherCard.add(dep); }
      }
    }
  }
}

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

  githubIdFor(id: string): number | undefined {
    if (this.hasGithubById(id)) {
      return this.byId.get(id).id;
    }
  }

  hasGithubById(id: string): boolean {
    return this.byId.has(id);
  }

  hasGithubByName(username: string): boolean {
    return this.byUser.has(username);
  }
}
