import test from "node:test";
import assert from "node:assert/strict";
import { parseHost, isValidName, normalizeName } from "../src/names";

const SUFFIXES = [".bdns.link", ".bdns"];

test("parseHost extracts a single-label .bdns name via .bdns.link", () => {
  assert.deepEqual(parseHost("MyWebsite.bdns.Link:8080", SUFFIXES), {
    kind: "domain",
    name: "mywebsite",
    suffix: ".bdns.link",
  });
});

test("parseHost extracts a local .bdns host", () => {
  assert.deepEqual(parseHost("alice.bdns", SUFFIXES), {
    kind: "domain",
    name: "alice",
    suffix: ".bdns",
  });
});

test("parseHost treats apex host as apex", () => {
  assert.equal(parseHost("bdns.link", SUFFIXES).kind, "apex");
  assert.equal(parseHost("bdns", SUFFIXES).kind, "apex");
});

test("parseHost treats any single-label subdomain as a domain name", () => {
  assert.deepEqual(parseHost("www.bdns.link", SUFFIXES), {
    kind: "domain",
    name: "www",
    suffix: ".bdns.link",
  });
});

test("parseHost rejects nested subdomains", () => {
  assert.equal(parseHost("a.b.bdns.link", SUFFIXES).kind, "apex");
});

test("parseHost rejects unsupported hosts", () => {
  assert.equal(parseHost("evil.com", SUFFIXES).kind, "unsupported");
  assert.equal(parseHost("", SUFFIXES).kind, "unsupported");
});

test("parseHost rejects invalid name labels", () => {
  assert.equal(parseHost("under_score.bdns", SUFFIXES).kind, "unsupported");
});

test("isValidName accepts lowercase labels with hyphens", () => {
  assert.equal(isValidName("block-dns"), true);
  assert.equal(isValidName("a"), true);
  assert.equal(isValidName("block"), true);
});

test("isValidName rejects invalid labels", () => {
  assert.equal(isValidName("UPPER"), false);
  assert.equal(isValidName("-lead"), false);
  assert.equal(isValidName("trail-"), false);
  assert.equal(isValidName("has space"), false);
  assert.equal(isValidName("with_underscore"), false);
});

test("normalizeName lowercases and trims", () => {
  assert.equal(normalizeName("  BlockDNS  "), "blockdns");
});