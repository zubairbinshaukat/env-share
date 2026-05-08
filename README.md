PROJECT: EnvShare — a web app to store .env files per project and share them with teammates via simple share codes.

TECH STACK:
- Vite + React + TypeScript
- Tailwind CSS for styling
- shadcn/ui for components
- Lucide React for icons
- Upstash Redis for storage
- Vercel serverless functions for API
- Deployed on Vercel

CORE FEATURES:
1. Create projects manually OR by selecting a local folder (File System Access API)
2. When folder is selected: scan for all .env* files, create a project named after the parent folder, each .env* file becomes an "environment" inside that project
3. Each project gets a unique share code (random, unguessable)
4. Anyone with the share code can view, copy, and download the env files
5. Read-only after import — only changes via manual re-scan
6. No authentication — projects tied to browser via localStorage; share code = recovery

DATA MODEL (Redis):
- Key: `project:{shareCode}` → JSON: { id, name, environments: [{ filename, variables: [{key, value}] }], createdAt, updatedAt }
- Key: `user:{browserUUID}` → JSON: { projectIds: [shareCode1, shareCode2, ...] }

UI VIBE:
- Modern, minimal, dark mode by default with light mode toggle
- Clean typography (Inter font)
- Subtle animations (Framer Motion)
- Generous whitespace
- Monospace font for env values
- Color palette: neutral base (zinc/slate), single accent color (emerald or violet)
- Inspired by Linear, Vercel dashboard, Raycast aesthetic

Acknowledge this context and wait for Phase 1.