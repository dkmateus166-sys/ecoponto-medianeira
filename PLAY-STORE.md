# EcoMedianeira na Play Store — guia completo

O app já é instalável direto do navegador (PWA). Para aparecer na **Play Store**,
é preciso gerar um pacote Android (AAB) e publicar numa conta de desenvolvedor.
Abaixo, o jeito mais simples (sem programar Android) + o que é preciso.

## Resumo rápido

| Etapa | Onde | Custo | Quem faz |
|---|---|---|---|
| 1. Conta de desenvolvedor Google Play | play.google.com/console | **US$ 25 (única vez)** | você (pessoa física ou prefeitura) |
| 2. Gerar o pacote AAB do app | PWABuilder.com (online, grátis) | grátis | eu te acompanho / você clica |
| 3. Chave de assinatura (keystore) | gerada no passo 2 | grátis | guardar com carinho |
| 4. Ficha da loja (textos + imagens) | Play Console | grátis | textos prontos abaixo |
| 5. Revisão do Google (1–7 dias) | automática | — | aguardar |

## Pré-requisitos prontos ✅

- [x] Site HTTPS: https://dkmateus166-sys.github.io/ecoponto-medianeira/
- [x] Manifest com ícones 192 + 512 + maskable
- [x] Service worker com cache versionado (v14)
- [x] Screenshots 1080×1920 e 1280×720 + feature graphic 1024×500
- [x] Política de privacidade: `privacidade.html` (publicada junto)
- [ ] Assetlinks (passo 2 gera; precisa subir no site — eu faço)

## Passo 1 — Conta de desenvolvedor (só você pode fazer)

1. Acesse https://play.google.com/console e entre com a conta Google da prefeitura
   (recomendado: conta institucional, não pessoal).
2. Pague a taxa única de **US$ 25**.
3. Complete a verificação de identidade (documento + D-U-N-S se for organização).

## Passo 2 — Gerar o AAB no PWABuilder (grátis)

1. Acesse https://www.pwabuilder.com
2. Cole a URL: `https://dkmateus166-sys.github.io/ecoponto-medianeira/`
3. Clique em **Start** → aguarde a análise → **Package for Stores** → **Android**.
4. Baixe o pacote (`.aab` + `assetlinks.json`).
5. Me envie o `assetlinks.json` — eu subo para `/.well-known/assetlinks.json` no site
   (isso prova ao Android que o app é seu e tira a barra do navegador).

## Passo 3 — Ficha da loja (textos prontos, PT-BR)

**Nome:** EcoMedianeira — Reciclagem de Eletrônicos
**Descrição curta (80 caracteres):**
Agende a coleta de eletrônicos em Medianeira/PR. Grátis e offline.
**Descrição completa:**
O EcoMedianeira é o programa municipal de reciclagem de eletrônicos de Medianeira/PR.
Agende a coleta em casa, encontre os pontos de coleta no mapa da cidade e acompanhe
cada etapa pelo protocolo — tudo pelo celular, grátis e funcionando até sem internet:
• Solicite a coleta de celulares, notebooks, TVs, pilhas, lâmpadas e mais
• Veja os pontos de coleta no mapa de ruas de Medianeira
• Acompanhe o status pelo código de protocolo
• Calcule seu impacto: kg reciclados, CO₂ evitado, água poupada
• Funciona offline e pode ser usado sem criar conta
**Categoria:** Meio ambiente / Utilidades — **Gratuito, sem anúncios, sem compras.**
**Classificação:** Livre. **Contato:** Secretaria de Meio Ambiente de Medianeira/PR.
**Imagens:** `play-feature-1024x500.png` (capa), `play-shot-telefone.png` (celular),
`play-shot-tablet.png` (tablet), `icon-512.png` (ícone).

## Passo 4 — Publicar

1. Play Console → **Criar app** → nome + idioma PT-BR.
2. Preencha a ficha (textos acima), suba o AAB, as imagens e a política de privacidade
   (URL: `https://dkmateus166-sys.github.io/ecoponto-medianeira/privacidade.html`).
3. Responda o questionário de classificação (livre) e de **segurança de dados**:
   o app **não coleta nem compartilha dados** — tudo fica no aparelho (localStorage);
   localização só é usada no mapa quando o morador toca em "Minha localização".
4. Envie para revisão (normalmente 1–7 dias). Depois: link `play.google.com/store/...`
   para divulgar com QR Code nos postos e escolas.

## Alternativa imediata (enquanto a loja não sai)

O PWA já instalado pelo navegador é o **mesmo app**, sem diferença de função.
Divulgue o link + QR Code: o morador abre, toca em "Baixar app" → "Instalar".
