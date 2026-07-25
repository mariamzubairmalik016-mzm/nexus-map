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

const modules = [
  "next/dynamic",
  "next/link",
  "next/navigation",
  "next/server",
  "react-router-dom",
  "cors",
  "next-auth/react",
  "leaflet/dist/images/marker-icon.png",
  "leaflet/dist/images/marker-shadow.png"
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  
  for (const mod of modules) {
    const escapedMod = mod.replace(/\//g, "\\/");
    const regex = new RegExp(`from "\\.\\/${escapedMod}"`, "g");
    content = content.replace(regex, `from "${mod}"`);
  }

  if (content !== fs.readFileSync(file, "utf8")) {
    fs.writeFileSync(file, content);
    console.log("Fixed:", file);
  }
}
