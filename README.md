# Marketplace Image Description Generator

Aplicacao que monitora uma pasta de imagens e gera automaticamente descricoes otimizadas para anuncios em marketplaces (OLX, Mercado Livre, Facebook Marketplace, etc) usando OpenAI Vision. Inclui gravador de cliques com Playwright para automatizar a publicacao dos anuncios.

## Como funciona

```
watched-images/
  celular/
    foto1.jpg          <-- imagem do produto
    foto1.md           <-- descricao gerada automaticamente
  notebook/
    frente.png         <-- imagem do produto
    frente.md          <-- descricao gerada automaticamente

recordings/
  recording-2026-02-09.json  <-- fluxo de cliques gravado
```

### Fluxo completo

1. Voce coloca imagens de produtos dentro de pastas em `watched-images/`
2. A aplicacao detecta as novas imagens automaticamente
3. Cada imagem e analisada pela OpenAI Vision (GPT-4o)
4. Um arquivo `.md` e criado ao lado da imagem com titulo SEO, descricao, caracteristicas e tags
5. **(Opcional)** Voce grava um fluxo de cliques no marketplace uma vez
6. **(Opcional)** O `automate` repete esse fluxo para cada produto, preenchendo titulo/descricao automaticamente

## Instalacao

```bash
npm install
npx playwright install chromium
```

## Configuracao

Crie um arquivo `.env` na raiz do projeto:

```
OPENAI_API_KEY=sk-your-api-key-here
WATCH_DIR=./watched-images
```

## Uso

### Gerar descricoes

```bash
# Modo batch: processa todas as imagens e encerra
npm start

# Modo watch: monitora continuamente por novas imagens
npm run watch
```

### Gravar cliques (Playwright Recorder)

Abre o browser e grava todos os seus cliques, digitacoes e navegacao:

```bash
# Abre em pagina vazia
npm run record

# Abre direto no marketplace
npm run record -- https://olx.com.br
```

Um badge vermelho "REC" aparece no canto do browser. Quando terminar, feche o browser e o JSON sera salvo em `recordings/`.

**Dica**: Nos campos de titulo e descricao, digite `{{title}}` e `{{description}}` como placeholders. Eles serao substituidos automaticamente no replay/automate.

### Replay (repetir fluxo gravado)

```bash
# Replay simples
npm run replay -- recordings/recording-2026-02-09.json

# Com variaveis injetadas
npm run replay -- recordings/recording-2026-02-09.json --var title="iPhone 12 Pro" --var description="Excelente estado"

# Headless (sem abrir janela)
npm run replay -- recordings/recording-2026-02-09.json --headless
```

### Automate (descricoes + publicacao automatica)

Combina a geracao de descricoes AI com o replay do fluxo gravado para cada pasta de produto:

```bash
npm run automate -- recordings/olx-flow.json watched-images/
```

Para cada pasta de produto:
1. Gera a descricao com AI (se ainda nao existir)
2. Extrai titulo, descricao e tags do .md
3. Abre o browser e executa o fluxo gravado, preenchendo os campos com os dados do produto

## Variaveis disponiveis no replay

| Variavel          | Conteudo                        |
|-------------------|---------------------------------|
| `{{title}}`       | Titulo SEO gerado pela AI       |
| `{{description}}` | Descricao do produto            |
| `{{tags}}`        | Tags separadas por virgula      |
| `{{folder}}`      | Nome da pasta do produto        |
| `{{imagePath}}`   | Caminho completo da imagem      |

## Formatos de imagem suportados

- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`

## Estrutura do projeto

```
src/
  index.js       - Ponto de entrada e CLI (batch/watch/record/replay/automate)
  watcher.js     - Monitoramento de pastas com chokidar
  vision.js      - Integracao com OpenAI Vision API
  generator.js   - Processamento de imagens e geracao de .md
  queue.js       - Fila de processamento com controle de concorrencia
  recorder.js    - Playwright: grava cliques do usuario no browser
  replayer.js    - Playwright: executa fluxo gravado com injecao de variaveis
  automate.js    - Ponte entre AI descriptions + Playwright replay
```
