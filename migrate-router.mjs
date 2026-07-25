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

  // Replace imports
  content = content.replace(/import\s+{\s*Link\s*(?:,\s*useNavigate)?\s*}\s*from\s+["']react-router-dom["'];/g, 'import Link from "next/link";\nimport { useRouter } from "next/navigation";');
  content = content.replace(/import\s+{\s*Link\s*}\s*from\s+["']react-router-dom["'];/g, 'import Link from "next/link";');
  content = content.replace(/import\s+{\s*useNavigate\s*}\s*from\s+["']react-router-dom["'];/g, 'import { useRouter } from "next/navigation";');
  content = content.replace(/import\s+{\s*useLocation\s*}\s*from\s+["']react-router-dom["'];/g, 'import { usePathname } from "next/navigation";');
  content = content.replace(/import\s+{\s*Link\s*,\s*useLocation\s*,\s*useNavigate\s*}\s*from\s+["']react-router-dom["'];/g, 'import Link from "next/link";\nimport { useRouter, usePathname } from "next/navigation";');
  content = content.replace(/import\s+{\s*useSearchParams\s*}\s*from\s+["']react-router-dom["'];/g, 'import { useSearchParams } from "next/navigation";');

  // Replace hooks
  content = content.replace(/useNavigate\(\)/g, 'useRouter()');
  content = content.replace(/useLocation\(\)/g, 'usePathname()');
  
  // Link component to attribute changes (Next.js Link uses href, RR uses to)
  content = content.replace(/<Link([^>]*)\bto=/g, '<Link$1 href=');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
    modified++;
  }
}

console.log(`Finished updating ${modified} files.`);
