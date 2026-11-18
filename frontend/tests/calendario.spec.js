// Testes iniciais: aba Calendário.
const { test, expect } = require('@playwright/test');
const { mockarApi, entrar } = require('./api-falsa');

const ANO = new Date().getFullYear();
const VACINA = { id: 1, tipo: 'VACINA', data: ANO + '-03-10', hora: null, animal_id: 11, animal_brinco: 'B-011', observacao: 'Aftosa', criado_por: 5, criado_por_nome: 'Profa Ana' };

test('lista as atividades do ano', async function ({ page }) {
  await mockarApi(page, [VACINA]);
  await entrar(page, 'prof@ifpe.test');
  await page.locator('#tab-calendario').click();
  await expect(page.locator('.ag-evento')).toHaveCount(1);
  await expect(page.locator('.ag-evento')).toContainText('Vacina — B-011');
});

test('sem atividades mostra a mensagem de vazio', async function ({ page }) {
  await mockarApi(page, []);
  await entrar(page, 'prof@ifpe.test');
  await page.locator('#tab-calendario').click();
  await expect(page.locator('.ag-vazio')).toContainText('Nenhuma atividade');
});

test('criar uma vacina pelo botão +', async function ({ page }) {
  await mockarApi(page, []);
  await entrar(page, 'prof@ifpe.test');
  await page.locator('#tab-calendario').click();
  await page.locator('.agenda-fab').click();
  await page.selectOption('#atvTipo', 'VACINA');
  await page.fill('#atvData', ANO + '-09-15');
  await page.selectOption('#atvAnimal', '11');
  await page.click('#btnSalvarAtividade');
  await expect(page.locator('#modalAtividade')).toBeHidden();
  await expect(page.locator('.ag-evento')).toContainText('Vacina — B-011');
});
