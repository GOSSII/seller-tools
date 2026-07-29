// Vercel serverless function — proves the api/ directory works from the
// web/ project root. Visit /api/health and you should get {"ok":true}.
// If it 404s, see the note in the Phase 2 PR: Vercel → Project → Settings →
// Build & Deployment → Root Directory must be "web" (not the repo root),
// so this file is deployed as /api/health.
module.exports = (req, res) => {
  res.status(200).json({ ok: true });
};
