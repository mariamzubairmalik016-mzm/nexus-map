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

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  // Replace auth imports
  const newAuthPath = path.relative(path.dirname(file), path.join(srcDir, "app", "api", "auth", "[...nextauth]", "route"));
  content = content.replace(/from\s+['"](?:\.\.\/)+auth\/\[\.\.\.nextauth\]\/route['"]/g, `from "${newAuthPath.replace(/\\/g, "/")}"`);

  // Replace db imports
  const newDbPath = path.relative(path.dirname(file), path.join(srcDir, "db"));
  content = content.replace(/from\s+['"](?:\.\.\/)+db['"]/g, `from "${newDbPath.replace(/\\/g, "/")}"`);

  // Replace db/schema imports
  const newSchemaPath = path.relative(path.dirname(file), path.join(srcDir, "db", "schema"));
  content = content.replace(/from\s+['"](?:\.\.\/)+db\/schema['"]/g, `from "${newSchemaPath.replace(/\\/g, "/")}"`);

  // Replace services/tomtom imports
  const newTomTomPath = path.relative(path.dirname(file), path.join(srcDir, "services", "tomtom.service"));
  content = content.replace(/from\s+['"](?:\.\.\/)+services\/tomtom\.service['"]/g, `from "${newTomTomPath.replace(/\\/g, "/")}"`);

  // Replace tomtom.service.ts broken imports
  if (file.endsWith("tomtom.service.ts")) {
    content = content.replace(/from\s+['"]\.\.\/config\/env\.js['"]/g, `from "../config/env"`);
    content = content.replace(/from\s+['"]\.\.\/utils\/httpError\.js['"]/g, `from "../utils/httpError"`);
  }

  // Ensure relative paths start with ./ if they are in the same dir
  content = content.replace(/from "([^\.]+[^"]*)"/g, (match, p1) => {
    // If it's a node module or absolute, ignore
    if (!p1.includes("/") || p1.startsWith("@")) return match;
    if (!p1.startsWith(".")) return `from "./${p1}"`;
    return match;
  });

  if (content !== fs.readFileSync(file, "utf8")) {
    fs.writeFileSync(file, content);
    console.log("Fixed:", file);
  }
}
