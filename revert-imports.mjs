import fs from "fs";
import path from "path";

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        results.push(file);
      }
    }
  });
  return results;
};

const srcDir = path.join(process.cwd(), "src");
const files = walk(srcDir);

const packages = [
  "react",
  "react-dom",
  "next",
  "clsx",
  "zustand",
  "axios",
  "leaflet",
  "maplibre-gl",
  "lucide-react",
  "framer-motion",
  "drizzle-orm",
  "pg",
  "three",
  "next-auth",
  "zod"
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  for (const pkg of packages) {
    const regex = new RegExp(`from "\\.\\/${pkg}"`, "g");
    content = content.replace(regex, `from "${pkg}"`);
  }

  // Also next/navigation, next/server, etc which might have been missed if I didn't mess them up.
  // Wait, my script explicitly skipped things with `/`. So `next/navigation` wasn't touched.

  if (content !== fs.readFileSync(file, "utf8")) {
    fs.writeFileSync(file, content);
    console.log("Reverted fake relative imports in:", file);
  }
}
