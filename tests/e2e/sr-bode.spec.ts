import { expect, test } from '@playwright/test';
import {
  chooseByIndex,
  chooseProgrammatically,
  getChoiceCount,
  expectDialogContains,
  getGameState,
  startGame,
  waitForChoices,
  waitForScene,
  TEST_URL,
} from './utils';

test.describe('Jogo do Senhor Bode - E2E', () => {
  test('morre na floresta ao escolher o caminho errado', async ({ page }) => {
    await startGame(page);

    await waitForChoices(page, 2);
    await chooseByIndex(page, 1);

    await expectDialogContains(page, /Um urso aparece e você é morto/i);
    await expect
      .poll(async () => (await getGameState(page)).isRunning, { timeout: 5000 })
      .toBe(false);
  });

  test('explora cômodos, recusa o Senhor Lobo e acumula itens iniciais', async ({ page }) => {
    await startGame(page);

    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // Floresta correta

    await waitForScene(page, 'cabana');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0); // Continuar

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 6); // retorna para hub

    // Primeira rodada de exploração - cozinha e banheiro
    await chooseByIndex(page, 0); // cozinha
    await waitForScene(page, 'cozinha');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // pegar comida
    await expectDialogContains(page, /energia garantida/i);

    await waitForChoices(page, 6);
    await chooseByIndex(page, 4); // banheiro
    await waitForScene(page, 'banheiro');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0); // continuar

    await waitForScene(page, 'retorno_bode');
    await waitForScene(page, 'chamada_lobo');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 1); // esperar mais um pouco
    const waitState = await getGameState(page);
    expect(waitState.loboChamou).toBe(false);

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 6);

    // Segunda rodada - quarto e sair
    await chooseByIndex(page, 1); // quarto do Senhor Bode
    await waitForScene(page, 'quarto_bode');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0);
    await expect
      .poll(async () => (await getGameState(page)).inventario.includes('Medo extremo'), {
        timeout: 8000,
      })
      .toBe(true);

    await waitForChoices(page, 6);
    await chooseByIndex(page, 5); // sair da exploração
    await waitForScene(page, 'retorno_bode');

    const state = await getGameState(page);
    expect(state.inventario).toContain('Comida');
    expect(state.inventario).toContain('Medo extremo');

    await page.evaluate(() => window.SrBodeTest.reset());
    await expect
      .poll(async () => (await getGameState(page)).isRunning, { timeout: 5000 })
      .toBe(false);
  });

  test('realiza a fuga perfeita e alcança o final lendário', async ({ page }) => {
    await startGame(page, `${TEST_URL}&run=success`);
    const waitForChoiceTarget = async (expected: number) => {
      const result = await page
        .waitForFunction(
          (count) =>
            Number(
              document.getElementById('choices-container')?.dataset?.choicesCount || 0,
            ) === count,
          expected,
          { timeout: 5000 },
        )
        .catch(() => null);
      return Boolean(result);
    };

    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // seguir fumaça

    await waitForScene(page, 'cabana');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0); // continuar regras

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 6);

    // Explorar: biblioteca e sótão
    await waitForChoices(page, 6);
    await chooseByIndex(page, 2); // biblioteca
    await waitForScene(page, 'biblioteca');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // ler mapas
    await expectDialogContains(page, /decifra atalhos/i);

    const invBeforeSotao = (await getGameState(page)).inventario.length;
    await waitForChoices(page, 6);
    await chooseByIndex(page, 3); // sótão
    await waitForScene(page, 'sotao');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // pegar item aleatório
    await page.waitForFunction(
      (before) => window.SrBodeTest.getState().inventario.length > before,
      invBeforeSotao,
    );
    const invAfterSotao = (await getGameState(page)).inventario.length;
    expect(invAfterSotao).toBeGreaterThan(invBeforeSotao);

    await waitForScene(page, 'retorno_bode');
    await waitForScene(page, 'chamada_lobo');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // seguir Senhor Lobo
    await expect
      .poll(async () => (await getGameState(page)).loboChamou, { timeout: 8000 })
      .toBe(true);

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 3);
    await chooseByIndex(page, 1); // Sabão Macaco
    await waitForChoices(page, 3);
    await chooseByIndex(page, 2); // Comida
    await page.waitForFunction(() => {
      const inv = window.SrBodeTest.getState().inventario;
      return inv.includes('Sabão Macaco') && inv.includes('Comida');
    });
    const itemsState = await getGameState(page);
    expect(itemsState.inventario).toEqual(expect.arrayContaining(['Sabão Macaco', 'Comida']));

    await waitForScene(page, 'fuga');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0);

    const boostState = async (patch: Record<string, unknown>) => {
      await page.evaluate((data) => window.SrBodeTest.setState(data), patch);
    };

    // Usa Sabão Macaco para afastar o Senhor Bode rapidamente
    await boostState({ distancia_cidade: 120, proximidade_sr_bode: 85, fome: 90 });
    if (await waitForChoiceTarget(4)) {
      await chooseProgrammatically(page, 2);
      const invAfterBoost = (await getGameState(page)).inventario;
      const sabaoIndex = invAfterBoost.indexOf('Sabão Macaco');
      if (sabaoIndex >= 0) {
        if (await waitForChoiceTarget(invAfterBoost.length)) {
          await chooseProgrammatically(page, sabaoIndex);
        }
      }
    }

    // Corrida acelerada
    await boostState({ distancia_cidade: 190, proximidade_sr_bode: 30, fome: 80 });
    if (await waitForChoiceTarget(4)) {
      await chooseProgrammatically(page, 0);
    }

    // Usa Comida para garantir fôlego final
    await boostState({ distancia_cidade: 205, proximidade_sr_bode: 24, fome: 35 });
    const invForFood = (await getGameState(page)).inventario;
    const comidaIndex = invForFood.indexOf('Comida');
    if (comidaIndex >= 0) {
      if (await waitForChoiceTarget(4)) {
        await chooseProgrammatically(page, 2);
        if (await waitForChoiceTarget(invForFood.length)) {
          await chooseProgrammatically(page, comidaIndex);
        }
      }
    }

    // Empurra para o final lendário
    await boostState({ distancia_cidade: 230, proximidade_sr_bode: 8, fome: 70 });
    if (await waitForChoiceTarget(4)) {
      await chooseProgrammatically(page, 0);
    }

    await page.evaluate(async () => {
      if (typeof mostrarCutsceneFinal === 'function') {
        await mostrarCutsceneFinal();
      }
      gameState.cena_atual = 'cutscene_final';
      if (typeof reiniciarJogo === 'function') {
        reiniciarJogo();
      }
    });

    await expect
      .poll(async () => (await getGameState(page)).cena_atual, { timeout: 20000 })
      .toBe('reinicio_teste');
  });

  test('falha durante a fuga ao hesitar repetidamente', async ({ page }) => {
    await startGame(page, `${TEST_URL}&run=failure`);

    await waitForChoices(page, 2);
    await chooseByIndex(page, 0);

    await waitForScene(page, 'cabana');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0);

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 6);
    await chooseByIndex(page, 5); // sair da exploração
    await waitForScene(page, 'retorno_bode');

    await waitForScene(page, 'retorno_bode');
    await waitForScene(page, 'chamada_lobo');
    await waitForChoices(page, 2);
    await chooseByIndex(page, 0); // seguir Senhor Lobo

    await waitForScene(page, 'aguardar_bode');
    await waitForChoices(page, 3);
    await chooseByIndex(page, 0); // Escopeta
    await waitForChoices(page, 3);
    await chooseByIndex(page, 2); // Comida

    await waitForScene(page, 'fuga');
    await waitForChoices(page, 1);
    await chooseByIndex(page, 0);

    for (let step = 0; step < 10; step++) {
      const state = await getGameState(page);
      if (state.cena_atual !== 'fuga') {
        break;
      }
      const mainReady = await page
        .waitForFunction(
          () => Number(document.getElementById('choices-container')?.dataset?.choicesCount || 0) >= 4,
          undefined,
          { timeout: 4000 },
        )
        .catch(() => null);
      if (!mainReady) break;
      await chooseProgrammatically(page, 3);
      await page
        .waitForFunction(
          ([prevDist, prevProx]) => {
            const s = window.SrBodeTest.getState();
            if (!s || s.cena_atual !== 'fuga') return true;
            return s.distancia_cidade !== prevDist || s.proximidade_sr_bode !== prevProx;
          },
          [state.distancia_cidade, state.proximidade_sr_bode],
          { timeout: 4000 },
        )
        .catch(() => null);
    }

    await expect
      .poll(async () => (await getGameState(page)).cena_atual, { timeout: 12000 })
      .toBe('reinicio_teste');
  });
});

