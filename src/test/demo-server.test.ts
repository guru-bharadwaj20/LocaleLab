import { test } from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fixtureDir, serveDirectory } from "../demo.js";

test("the fixture ships with the package", async () => {
  const dir = fixtureDir();
  for (const file of ["index.html", "styles.css", "i18n.js"]) {
    await access(path.join(dir, file));
  }
});

test("static server serves the fixture and refuses to leave its root", async () => {
  const server = await serveDirectory(fixtureDir());
  try {
    const index = await fetch(server.url);
    assert.equal(index.status, 200);
    assert.match(index.headers.get("content-type") ?? "", /text\/html/);
    const html = await index.text();
    assert.match(html, /data-localelab-id="checkout-cta"/);

    const css = await fetch(new URL("styles.css", server.url));
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") ?? "", /text\/css/);

    const missing = await fetch(new URL("nope.html", server.url));
    assert.equal(missing.status, 404);

    const escape = await fetch(`${server.url}..%2F..%2Fpackage.json`);
    assert.equal(escape.status, 404);
    const dotted = await fetch(`${server.url}../../package.json`);
    assert.equal(dotted.status, 404);
  } finally {
    await server.close();
  }
});
