# Marketplace Image Description Generator

Aplicacao que monitora uma pasta de imagens e gera automaticamente descricoes otimizadas para anuncios em marketplaces (OLX, Mercado Livre, Facebook Marketplace, etc) usando OpenAI Vision.

## Como funciona

```
watched-images/
  celular/
    foto1.jpg          <-- imagem do produto
    foto1.md           <-- descricao gerada automaticamente
  notebook/
    frente.png         <-- imagem do produto
    frente.md          <-- descricao gerada automaticamente
```

1. Voce coloca imagens de produtos dentro de pastas em `watched-images/`
2. A aplicacao detecta as novas imagens automaticamente
3. Cada imagem e analisada pela OpenAI Vision (GPT-4o)
4. Um arquivo `.md` e criado ao lado da imagem com:
   - Titulo SEO-friendly para marketplace
   - Descricao completa do produto
   - Caracteristicas identificadas
   - Tags para busca

## Instalacao

```bash
npm install
```

## Configuracao

Crie um arquivo `.env` na raiz do projeto:

```
OPENAI_API_KEY=sk-your-api-key-here
WATCH_DIR=./watched-images
```

## Uso

### Modo batch (processa imagens existentes e encerra)

```bash
npm start
```

### Modo watch (monitora continuamente por novas imagens)

```bash
npm run watch
```

## Formatos suportados

- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`

## Estrutura do projeto

```
src/
  index.js       - Ponto de entrada e CLI
  watcher.js     - Monitoramento de pastas com chokidar
  vision.js      - Integracao com OpenAI Vision API
  generator.js   - Processamento de imagens e geracao de .md
  queue.js       - Fila de processamento com controle de concorrencia
```
