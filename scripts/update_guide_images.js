import { spawn } from 'child_process';
import waitOn from 'wait-on';

async function updateScreenshots() {
    console.log('Starting Vite server...');
    const vite = spawn('npx', ['vite', '--port', '8080'], {
        shell: true,
        stdio: 'inherit'
    });

    try {
        console.log('Waiting for Vite server to be ready...');
        await waitOn({
            resources: ['http://localhost:8080/src/app.html'],
            timeout: 30000
        });

        console.log('Running screenshot generation script...');
        const generator = spawn('node', ['scripts/generate_guide_screenshots.js'], {
            shell: true,
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            generator.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Generator exited with code ${code}`));
            });
        });

    } catch (err) {
        console.error('Failed to update screenshots:', err);
        process.exit(1);
    } finally {
        console.log('Stopping Vite server...');
        vite.kill();
    }
}

updateScreenshots();
