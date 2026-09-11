# Testes de ponta a ponta — Synergy

Camada de testes que exercita o produto montado: API Go + front React + PostgreSQL,
todos rodando de verdade. Fica fora de `apps/api` e `apps/web` de propósito — ela não
pertence a nenhum dos dois, e sim à integração entre eles.

```bash
npm install     # só na primeira vez
npm test        # suíte padrão: API + interface
```

Se a API e o front não estiverem no ar, o Playwright os sobe sozinho (e reaproveita se já
estiverem). O banco precisa estar rodando.

---

## Os três projetos

| Projeto | Comando | O que faz | Toca o banco? |
| :--- | :--- | :--- | :--- |
| `api` | `npm run test:api` | contrato, RBAC e invariantes do Radar, direto na API, sem navegador | só leitura |
| `web` | `npm run test:web` | fluxos de interface no Chrome | só leitura |
| `web-com-residuo` | `npm run test:residuo` | ciclo de vida de time (criar, membros, arquivar) | **cria registros** |

`npm test` roda os dois primeiros. **Os dois primeiros não alteram nada** — dá para rodar a
qualquer momento, inclusive com o app aberto na tela, sem estragar dado de demonstração.

### Por que o terceiro é opt-in

A API não tem `DELETE` de time — o mais perto disso é arquivar, e o time continua na
listagem como "Arquivado". Um teste que cria não consegue desfazer. Como o banco de
desenvolvimento é o mesmo que aparece na tela, deixar isso no `npm test` encheria a
listagem de lixo a cada execução.

Os times criados levam o prefixo `E2E` e a data. Para limpar depois de rodar:

```sql
DELETE FROM teams WHERE name LIKE 'E2E %';
```

(`team_members` sai junto, por `ON DELETE CASCADE`.)

---

## Decisões que valem conhecer antes de mexer

**Cenário é preparado pela API, não pela tela.** Um teste de Radar que precisasse criar
time pelo formulário quebraria quando o formulário mudasse — por um motivo que não tem
nada a ver com o Radar. `src/api.ts` faz esse trabalho.

**Login é injetado, menos onde o login é o assunto.** `entrarComo` pega o token pela API e
grava no `localStorage`. O formulário de login é exercitado de verdade em `login.spec.ts`;
repeti-lo em todo teste só deixaria a suíte lenta e faria tudo quebrar junto.

**Nada de nome de time ou de membro fixo no código.** Os testes descobrem pela API quem
gere o quê e quem respondeu os motivadores. As únicas constantes são as contas do seed
(`src/dados.ts`), que são infraestrutura de desenvolvimento.

**Um worker só.** Os três projetos compartilham um banco; paralelizar faria um teste
enxergar o que outro está criando.

**Chrome instalado, não o Chromium do Playwright.** O download do CDN dele não completa na
rede da DB1 (timeout no ZIP), então `playwright.config.ts` usa `channel: 'chrome'`. Onde a
rede permitir, `npx playwright install chromium` e remover o `channel` volta ao padrão —
que é o recomendado, por ser a versão que o Playwright homologou.

---

## Quando algo falha

```bash
npm run report          # abre o relatório HTML da última execução
npm run test:headed     # roda vendo o navegador
npm run test:ui         # modo interativo, com viagem no tempo
```

Toda falha guarda screenshot e trace em `test-results/`. Para abrir um trace:

```bash
npx playwright show-trace test-results/<pasta-do-teste>/trace.zip
```

Dois enganos que já custaram tempo aqui:

- **Ícone entra no texto.** Os itens de menu usam Material Symbols, cujo `<span>` tem como
  texto o nome da ligadura. O `innerText` de "Times" vem como `"groups\nTimes"`, mesmo com
  `aria-hidden`. Use `itensDoMenu()` de `src/telas.ts`.
- **`window.confirm` é dispensado sozinho.** Remover membro e arquivar time passam por
  `confirm()`, e o Playwright cancela por padrão — a ação nunca acontece e o erro não
  explica isso. Registre `page.on('dialog', d => d.accept())`.
