import { readFile, writeFile } from "node:fs/promises";
const base = new URL("../assets/", import.meta.url);
let css = await readFile(new URL("fonts-source.css", base), "utf8");
const urls = [...new Set(css.match(/https:\/\/[^)\s]+/g))];
for (let i = 0; i < urls.length; i++) {
  const file = "font-" + i + ".ttf";
  const response = await fetch(urls[i]);
  if (!response.ok) throw new Error("Font download failed: " + response.status);
  await writeFile(
    new URL(file, base),
    Buffer.from(await response.arrayBuffer()),
  );
  css = css.replaceAll(urls[i], file);
}
await writeFile(new URL("fonts.css", base), css);
console.log(`Downloaded ${urls.length} font files for offline use.`);
