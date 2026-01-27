# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Vercel Deployment

- Build: `npm run build` generates a static web export in `dist`.
- Auto-deploy on commit (recommended): connect the GitHub repo to Vercel, set the Production Branch (e.g., `main`), and add your custom domain in the Vercel project settings. Vercel will automatically alias your domain to the latest production deployment after each push.
- Optional GitHub Actions: see `.github/workflows/vercel-deploy.yml` for CI-driven deploys. Set GitHub repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
- Custom Domain: add your domain in Vercel → Project → Domains. For branch subdomains, configure a wildcard DNS `*.yourdomain.com` pointing to Vercel.

### Use `dist` for preview and production (#4)

- CI Preview (PRs): workflow runs `npm run build` then `npx vercel` (after `vercel pull`) to deploy using the project root; Vercel runs the build and serves `dist` per `vercel.json`.
- CI Production (main/master): workflow runs `npm run build` then `npx vercel --prod --confirm` (after `vercel pull`) to alias the latest build to production.
- Local production deploy (manual):

```bash
npm run build
npx vercel --prod --confirm
# If deploying with a token & project ID (CI-style), omit scope:
# npx vercel --prod --confirm --token "YOUR_VERCEL_TOKEN" --project "YOUR_PROJECT_ID"
```

### One-command deploys (local)

- Preview: `npm run deploy:preview`
- Production: `npm run deploy:prod`

These scripts load `VERCEL_TOKEN` from `.env.local` using `dotenv-cli` and run Vercel from the project root. Ensure you’ve run `vercel login` at least once to link the project, or keep `.vercel/project.json` checked in.

### Commit-based deploys (recommended)

- Push to `main`: GitHub Actions runs and deploys to production automatically.
- PRs to `main`: a preview deployment is created.
- Required setup once:
  - Add repository secret `VERCEL_TOKEN`.
  - Ensure `.vercel/project.json` is in the repo (we now keep `.vercel` tracked) so the workflow is linked to the correct Vercel project.

Make sure your Vercel project is linked to this repo/project and that the GitHub secrets are set. `vercel.json` already tells Vercel to use `npm run build` and serve `dist`.
