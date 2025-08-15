// server.js
const express = require('express');
const cypress = require('cypress');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// CORS a middleware to allow requests from your frontend
app.use(cors());

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// API endpoint to run a single Cypress test file
app.post('/run-test', upload.single('testFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No test file uploaded.');
    }

    const testFileOriginalPath = req.file.path;
    const projectRoot = path.join(__dirname, `run-${Date.now()}`);
    const cypressIntegrationPath = path.join(projectRoot, 'cypress', 'e2e');
    const testFileNewPath = path.join(cypressIntegrationPath, req.file.originalname);
    
    const reportDir = path.join(projectRoot, 'cypress', 'reports');
    const reportFilename = `report.html`;

    try {
        // Create a temporary project structure for Cypress
        await fs.ensureDir(cypressIntegrationPath);
        await fs.move(testFileOriginalPath, testFileNewPath);

        // --- FINAL FIX: Create a symbolic link to the node_modules directory ---
        // This allows Cypress, running inside projectRoot, to find the globally installed modules.
        const nodeModulesPath = path.join(__dirname, 'node_modules');
        const symlinkPath = path.join(projectRoot, 'node_modules');
        await fs.symlink(nodeModulesPath, symlinkPath, 'dir');
        // --- End of Fix ---

        // Create a modern cypress.config.js file for Cypress v10+
        const cypressConfigFileContent = `
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: false,
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-dev-shm-usage');
        }
        return launchOptions;
      });
    },
  },
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: '${reportDir.replace(/\\/g, '\\\\')}',
    reportFilename: '${reportFilename}',
    overwrite: false,
    html: true,
    json: false,
    quiet: true
  }
});
`;
        await fs.writeFile(path.join(projectRoot, 'cypress.config.js'), cypressConfigFileContent);

        console.log(`Running test: ${testFileNewPath}`);
        const results = await cypress.run({
            project: projectRoot,
            spec: testFileNewPath,
            browser: 'electron',
            headed: false,
            config: {
                video: false,
                // --- ADDITION: Increase command timeout ---
                // This gives commands more time to complete, which is useful on slower CI environments.
                commandTimeout: 60000 // 60 seconds
            },
        });

        const reportPath = path.join(reportDir, reportFilename);

        if (fs.existsSync(reportPath)) {
            const reportHtml = await fs.readFile(reportPath, 'utf-8');
            res.send(reportHtml);
        } else {
            if(results && results.message){
                 res.status(500).send(`<h1>Test Run Failed</h1><p>The test runner failed to complete.</p><pre>${results.message}</pre>`);
            } else {
                 res.status(500).send('<h1>Error</h1><p>Cypress test ran, but the report file was not generated.</p>');
            }
        }

    } catch (err) {
        console.error('Error during Cypress run:', err);
        res.status(500).send(`<h1>Server Error</h1><p>Failed to run Cypress test.</p><pre>${err.message}</pre>`);
    } finally {
        await fs.remove(projectRoot);
        await fs.remove(testFileOriginalPath).catch(() => {});
    }
});

app.listen(port, () => {
    console.log(`Cypress runner backend listening at http://localhost:${port}`);
});
