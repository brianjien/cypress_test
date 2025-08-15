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
    const cypressIntegrationPath = path.join(projectRoot, 'cypress', 'integration');
    const testFileNewPath = path.join(cypressIntegrationPath, req.file.originalname);
    
    const reportDir = path.join(projectRoot, 'cypress', 'reports');
    const reportFilename = `report.html`; // Simplified name

    try {
        // Create a temporary project structure for Cypress
        await fs.ensureDir(cypressIntegrationPath);
        await fs.move(testFileOriginalPath, testFileNewPath);

        // --- FIX: Create a basic cypress.json config file ---
        const cypressConfig = {
            "integrationFolder": "cypress/integration",
            "videosFolder": "cypress/videos",
            "screenshotsFolder": "cypress/screenshots",
            "supportFile": false
        };
        await fs.writeJson(path.join(projectRoot, 'cypress.json'), cypressConfig);
        // --- End of Fix ---

        console.log(`Running test: ${testFileNewPath}`);
        const results = await cypress.run({
            project: projectRoot, // Run cypress within the temp project
            spec: testFileNewPath,
            config: {
                video: false,
            },
            reporter: 'mochawesome',
            reporterOptions: {
                reportDir: reportDir,
                reportFilename: reportFilename,
                overwrite: false,
                html: true,
                json: false, // No need for separate json
                quiet: true
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
        // Cleanup: remove the temporary project folder
        await fs.remove(projectRoot);
        await fs.remove(testFileOriginalPath).catch(() => {}); // Also remove original upload just in case
    }
});

app.listen(port, () => {
    console.log(`Cypress runner backend listening at http://localhost:${port}`);
});
