# TestSprite integration

This repository is wired for TestSprite frontend UI testing against the Vite app.

## One-time setup

1. Install the CLI if it is not already available:

   ```bash
   npm install -g @testsprite/testsprite-cli
   ```

2. Configure your API key without putting it in the repository. On PowerShell:

   ```powershell
   $env:TESTSPRITE_API_KEY = "<your TestSprite API key>"
   testsprite setup --from-env --yes --agent codex --dir .
   ```

3. Create a local TestSprite frontend project for the running Vite app:

   ```powershell
   testsprite project create --type frontend --name "NomNom Agar.sol" --local 5173
   ```

   Save the returned project ID as `TESTSPRITE_PROJECT_ID` in your shell. It is intentionally not committed.

## Run the seeded suite locally

Start the app in another terminal first:

```powershell
cd app
npm run dev
```

Then, from the repository root:

```powershell
$env:TESTSPRITE_PROJECT_ID = "<project id>"
npm --prefix app run testsprite:local
```

The first run creates the plans in `plans/` and stores the returned TestSprite test IDs in the ignored `.testsprite/config.json`. Later runs reuse those saved tests instead of creating duplicates. Each run starts them through TestSprite's automatic tunnel and waits for the results. Run artifacts are ignored by git.

The seeded tests cover:

- guest launch and in-game HUD
- skin selection and nickname editing
- private room creation and invite state

TestSprite supports Node.js 20.19+, 22.13+, or 24+; the repository's current Node 26 runtime is within the documented support range.
