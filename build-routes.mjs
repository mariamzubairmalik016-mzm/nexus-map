import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src', 'Pages');
const appDir = path.join(__dirname, 'src', 'app');

const pages = fs.readdirSync(pagesDir).filter(f => fs.statSync(path.join(pagesDir, f)).isDirectory());

const routeMapping = {
  'Home': 'page.tsx', // special case, already handled
  'Map': 'map/page.tsx',
  'Dashboard': 'dashboard/page.tsx',
  'AIPlanner': 'ai-planner/page.tsx',
  'Explore': 'explore/page.tsx',
  'Favorites': 'favorites/page.tsx',
  'History': 'history/page.tsx',
  'Notifications': 'notifications/page.tsx',
  'OfflineMaps': 'offline-maps/page.tsx',
  'Profile': 'profile/page.tsx',
  'Settings': 'settings/page.tsx',
  'Admin': 'admin/page.tsx',
  'Community': 'community/page.tsx',
  'RoadAlerts': 'road-alerts/page.tsx',
  'NotFound': 'not-found.tsx',
};

// Auth pages
const authMapping = {
  'Login': 'login/page.tsx',
  'Signup': 'signup/page.tsx',
  'ForgotPassword': 'forgot-password/page.tsx',
};

for (const [page, route] of Object.entries(routeMapping)) {
  if (page === 'Home') continue;
  
  const destFile = path.join(appDir, route);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  
  if (page === 'NotFound') {
    fs.writeFileSync(destFile, `"use client";\nimport NotFound from "../Pages/NotFound/NotFound";\nexport default function NotFoundPage() { return <NotFound />; }`);
  } else {
    fs.writeFileSync(destFile, `"use client";\nimport ${page} from "../../Pages/${page}/${page}";\nexport default function ${page}Page() { return <${page} />; }`);
  }
  console.log(`Created route for ${page} at ${route}`);
}

// Special case for auth folder
for (const [page, route] of Object.entries(authMapping)) {
  const destFile = path.join(appDir, route);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, `"use client";\nimport ${page} from "../../Pages/Auth/${page}";\nexport default function ${page}Page() { return <${page} />; }`);
  console.log(`Created route for Auth/${page} at ${route}`);
}
