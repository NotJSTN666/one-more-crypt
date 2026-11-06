import { defineConfig } from 'vite';

// Public address of the site, used for the link-preview tags in index.html.
// In GitHub Actions it follows the repo name (https://<owner>.github.io/<repo>/), so
// renaming the repo needs no code change. SITE_URL overrides it, e.g. for a custom domain.
function siteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/?$/, '/');
  const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
  if (repo) {
    const [owner, name] = repo.split('/');
    const host = `${owner.toLowerCase()}.github.io`;
    return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
  }
  return 'http://localhost:5173/';
}

// Relative base so the build works at any path (/<repo>/ on GitHub Pages, or a domain root).
export default defineConfig(({ mode }) => ({
  base: './',
  // The CrazyGames build is flat (no folders), since their portal takes loose files only.
  build: { target: 'es2020', ...(mode === 'crazygames' ? { assetsDir: '' } : {}) },
  plugins: [
    {
      name: 'site-url',
      transformIndexHtml: (html: string) => {
        let out = html.replaceAll('__SITE_URL__', siteUrl());
        // The CrazyGames build: their SDK first, and no app manifest (it isn't installable there).
        if (mode === 'crazygames') {
          out = out.replace(/<link rel="manifest"[^>]*>\s*/g, '');
          out = out.replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '');
          out = out.replace(/<meta (property|name)="(og|twitter):[^>]*>\s*/g, '');
          out = out.replace('</head>', '    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  </head>');
        }
        return out;
      },
    },
  ],
}));
