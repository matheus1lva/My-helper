import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const openai = new OpenAI();

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return types[ext] || "image/jpeg";
}

export async function analyzeImage(imagePath) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mediaType = getMediaType(imagePath);
  const dataUrl = `data:${mediaType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: `Voce e um especialista em criar anuncios para marketplace (OLX, Mercado Livre, Facebook Marketplace, etc).
Ao receber uma imagem de um produto, voce deve gerar:

1. **Titulo SEO-Friendly**: Um titulo otimizado para buscas, com ate 120 caracteres, incluindo palavras-chave relevantes do produto. O titulo deve ser atrativo e descritivo.

2. **Descricao para Anuncio**: Uma descricao completa e persuasiva do produto contendo:
   - O que e o produto
   - Caracteristicas visiveis (cor, tamanho aproximado, material, estado de conservacao)
   - Pontos positivos e destaques
   - Sugestao de uso ou publico-alvo

Responda SEMPRE no seguinte formato Markdown:

# [Titulo SEO-Friendly aqui]

## Descricao

[Descricao detalhada do produto aqui]

## Caracteristicas

- [Caracteristica 1]
- [Caracteristica 2]
- [Caracteristica 3]
...

## Tags

[lista de tags separadas por virgula para facilitar a busca]`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise esta imagem de produto e gere um titulo SEO-friendly e uma descricao completa para anuncio em marketplace.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}
