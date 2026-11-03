# SPHEREx SkyViewer

Explore the sky using object names or coordinates, browse SPHEREx archive observations, view sky images, and compare observations.

## Download the project

After this project is uploaded to GitHub, you can get a copy in either of these ways.

### Option 1: Download a ZIP (easiest)

1. Open the project's GitHub page.
2. Click the green **Code** button, then choose **Download ZIP**.
3. When it finishes downloading, right-click the ZIP file and choose **Extract All**.
4. Open the extracted `Dagmagdolla-copy` folder. It should contain `package.json` and this README.

ZIP downloads are snapshots. To get later updates, download a fresh ZIP or use the clone method below.

### Option 2: Clone with Git (easy to update)

Install [Git for Windows](https://git-scm.com/download/win), then open PowerShell in the folder where you want the project saved and run:

```powershell
git clone https://github.com/I-WILL-SEND-YOU-TO-JESUS/NASA-SPHEREX.git
cd NASA-SPHEREX
```

For a private repository, sign in to GitHub when Git asks. To download later changes, open PowerShell in the project folder and run `git pull`.

## Start the website on Windows

1. Install **Node.js 20.9 or newer** from [nodejs.org](https://nodejs.org/). The installer includes npm.
2. Open PowerShell in the project folder (the folder containing `package.json`). Tip: in File Explorer, open that folder, click the address bar, type `powershell`, and press Enter.
3. Download and install the project's packages:

   ```powershell
   npm install
   ```

4. Start the website:

   ```powershell
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser. Leave PowerShell open while using the website. Press **Ctrl+C** in PowerShell when you want to stop it.

Run `npm run dev` again the next time you want to open the site. You normally only need to run `npm install` again after package changes.

## Data and keys

Archive searches and sky data need an internet connection and depend on NASA/IPAC IRSA services. The current core features do not require private API keys. Never paste API keys into source code, this README, or your PowerShell profile. If a future feature needs a key, store it in a local `.env.local` file; local `.env` files are excluded from Git by default.

IRSA may return no observations for some positions or may be temporarily unavailable. Any sample/demo imagery is generated and is not telescope data.

## More commands

Run these from the project folder:

```powershell
npm run dev     # Start the development website
npm run build   # Prepare a production build
npm start       # Run the production build locally
npm run lint    # Check the code for common issues
```