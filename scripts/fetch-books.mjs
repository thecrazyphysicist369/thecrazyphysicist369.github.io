#!/usr/bin/env node
/**
 * Fetches Goodreads shelf RSS and writes books.json for the static site.
 * Usage: node scripts/fetch-books.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER_ID = "71176505";
const PROFILE = "https://www.goodreads.com/user/show/71176505-soujanya-ray";
const SHELVES = ["currently-reading", "read"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "books.json");

function tag(xml, name) {
  const cdata = xml.match(new RegExp(`<${name}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${name}>`, "i"));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return plain ? plain[1].trim() : "";
}

function upgradeCover(url) {
  if (!url) return "";
  return url.replace(/\._S[XY]\d+(?:_S[XY]\d+)?_\./, ".");
}

function parseItems(xml, shelf) {
  const chunks = xml.split(/<item>/i).slice(1);
  return chunks
    .map((chunk) => {
      const block = chunk.split(/<\/item>/i)[0] || "";
      const id = tag(block, "book_id");
      if (!id) return null;
      const ratingRaw = tag(block, "user_rating");
      const rating = Number.parseInt(ratingRaw, 10);
      return {
        id,
        title: tag(block, "title"),
        author: tag(block, "author_name"),
        cover: upgradeCover(
          tag(block, "book_large_image_url") ||
            tag(block, "book_medium_image_url") ||
            tag(block, "book_image_url")
        ),
        link: `https://www.goodreads.com/book/show/${id}`,
        rating: Number.isFinite(rating) ? rating : 0,
        readAt: tag(block, "user_read_at"),
        pubDate: tag(block, "pubDate"),
        shelf,
      };
    })
    .filter(Boolean);
}

async function fetchShelf(shelf) {
  const url = `https://www.goodreads.com/review/list_rss/${USER_ID}?shelf=${encodeURIComponent(shelf)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "thecrazyphysicist369.github.io-book-sync/1.0" },
  });
  if (!res.ok) throw new Error(`Goodreads ${shelf}: HTTP ${res.status}`);
  const xml = await res.text();
  return parseItems(xml, shelf);
}

async function main() {
  const results = {};
  for (const shelf of SHELVES) {
    results[shelf] = await fetchShelf(shelf);
    console.log(`${shelf}: ${results[shelf].length} books`);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    profile: PROFILE,
    currentlyReading: results["currently-reading"],
    read: results.read,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
