const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8532',
  },
  webServer: {
    command: 'python3 -m http.server 8532',
    cwd: '..',
    port: 8532,
    reuseExistingServer: true,
  },
});
