// Testes de interface do frontend (Playwright). Rodar: npm test
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 900 }
  },
  // Sobe um servidor simples servindo a pasta src/ (o que o Nginx faz em produção)
  webServer: {
    command: 'node tests/servidor.js',
    url: 'http://localhost:4173',
    reuseExistingServer: true
  }
});
