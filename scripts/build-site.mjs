import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public");
const excluded = new Set([
  ".git", ".github", ".vercel", "node_modules", "public", "scripts", "api",
  "package-lock.json", "package.json", "vercel.json", "README.md"
]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function copyEntry(name) {
  if (excluded.has(name)) return;
  const source = path.join(root, name);
  const target = path.join(output, name);
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.cp(source, target, { recursive: true, force: true });
  } else if (stat.isFile()) {
    await fs.copyFile(source, target);
  }
}

async function main() {
  console.log("[Mina Build] Generating SEO files...");
  await run(process.execPath, [path.join(root, "scripts", "generate-sitemap.mjs")]);

  console.log("[Mina Build] Creating clean public output...");
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });

  const entries = await fs.readdir(root);
  for (const name of entries) await copyEntry(name);

  const required = ["index.html", "admin.html", "blog.html", "js", "css", "images"];
  for (const name of required) {
    try { await fs.access(path.join(output, name)); }
    catch { throw new Error(`[Mina Build] Missing required output: public/${name}`); }
  }

  console.log("[Mina Build] Stable output ready at public/.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
