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

    const testFilePath = req.file.path;
    const reportDir = path.join(__dirname, 'cypress', 'reports');
    const reportFilename = `report-${Date.now()}.html`;
    const reportJsonFilename = `report-${Date.now()}.json`;

    try {
        // Ensure reports directory exists
        await fs.ensureDir(reportDir);

        console.log(`Running test: ${testFilePath}`);
        const results = await cypress.run({
            spec: testFilePath,
            config: {
                video: false,
            },
            reporter: 'mochawesome',
            reporterOptions: {
                reportDir: reportDir,
                reportFilename: reportFilename,
                jsonFile: reportJsonFilename,
                overwrite: false,
                html: true,
                json: true,
                quiet: true
            },
        });

        const reportPath = path.join(reportDir, reportFilename);

        if (fs.existsSync(reportPath)) {
            const reportHtml = await fs.readFile(reportPath, 'utf-8');
            res.send(reportHtml);
        } else {
            // Check if there was a run error and send that back
            if(results.status === 'failed'){
                 res.status(500).send(`<h1>Test Run Failed</h1><pre>${results.message}</pre>`);
            } else {
                 res.status(500).send('<h1>Error</h1><p>Cypress test ran, but the report file was not generated.</p>');
            }
        }

    } catch (err) {
        console.error('Error during Cypress run:', err);
        res.status(500).send(`<h1>Server Error</h1><p>Failed to run Cypress test.</p><pre>${err.message}</pre>`);
    } finally {
        // Cleanup: remove the uploaded file and the generated report
        await fs.remove(testFilePath);
        // Note: You might want to keep reports for a while, but for this example, we clean them up.
        // await fs.remove(reportDir); 
    }
});

app.listen(port, () => {
    console.log(`Cypress runner backend listening at http://localhost:${port}`);
});
