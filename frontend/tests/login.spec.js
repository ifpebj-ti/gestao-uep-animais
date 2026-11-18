// Testes iniciais: login e abas por perfil.
const { test, expect } = require('@playwright/test');
const { mockarApi, entrar } = require('./api-falsa');

test('login com e-mail inválido mostra o erro', async function ({ page }) {
  await mockarApi(page);
  await entrar(page, 'naoexiste@ifpe.test');
  await expect(page.locator('#loginError')).toBeVisible();
});

test('aluno entra e vê a aba Calendário, mas não a aba Minha Equipe', async function ({ page }) {
  await mockarApi(page);
  await entrar(page, 'aluno@ifpe.test');
  await expect(page.locator('#tab-calendario')).toBeVisible();
  await expect(page.locator('#tab-equipe')).toBeHidden();
});

test('professor vê a aba Minha Equipe', async function ({ page }) {
  await mockarApi(page);
  await entrar(page, 'prof@ifpe.test');
  await expect(page.locator('#tab-equipe')).toBeVisible();
});
