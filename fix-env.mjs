import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync(path.join(__dirname, 'src'));

let modified = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  // Replace import.meta.env.DEV
  content = content.replace(/import\.meta\.env\.DEV/g, "(process.env.NODE_ENV === 'development')");
  
  // Replace import.meta.env.VITE_* with process.env.NEXT_PUBLIC_*
  content = content.replace(/import\.meta\.env\.VITE_([A-Z0-9_]+)/g, 'process.env.NEXT_PUBLIC_$1');

  // Any remaining import.meta.env
  content = content.replace(/import\.meta\.env(?!\.)/g, 'process.env');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    modified++;
  }
}

console.log(`Finished updating ${modified} files.`);
