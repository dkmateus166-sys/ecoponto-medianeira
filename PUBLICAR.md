# Publicar o EcoMedianeira — passo a passo

Para **qualquer morador de Medianeira** abrir o app em **qualquer Wi-Fi** (4G, 5G, Wi-Fi de casa,
do trabalho, da escola) e **instalar no celular**, o app precisa estar num endereço **público com HTTPS**.

> Por que HTTPS? O navegador só permite instalar o app (ícone na tela) e usar GPS em `https://`.
> Além disso, o link por IP (`192.168.1.53:8080`) só funciona dentro da sua casa.

---

## Opção 1 — Netlify Drop (grátis, 2 minutos, sem conta) ⭐ mais fácil

1. No computador, abra **https://app.netlify.com/drop**
2. **Arraste a pasta inteira** `ecoponto-medianeira` para a área "Drop here".
   ⚠️ Arraste a **pasta**, não arquivos soltos. Ela já está preparada
   (`netlify.toml`, `_headers`, `404.html` incluídos).
3. Espere ~30 segundos. O Netlify mostra um endereço assim:
   **`https://algum-nome-aleatorio.netlify.app`**
4. Abra esse endereço no celular → toque em **Baixar app** → **Instalar**.
5. (Opcional, para ficar bonito) No painel do Netlify: *Site settings → Change site name*
   e use algo como **`ecomedianeira`** → vira `https://ecomedianeira.netlify.app`.

Para atualizar depois: arraste a pasta novamente no mesmo site.

---

## Opção 2 — GitHub Pages (grátis, endereço fixo, fácil de atualizar)

Precisa de conta no GitHub (grátis). O endereço fica
`https://SEU-USUARIO.github.io/ecoponto-medianeira/`.

1. Crie um repositório **público** chamado `ecoponto-medianeira`.
2. Envie os arquivos (pelo site do GitHub: "Add file → Upload files", arrastando o conteúdo
   da pasta; ou com Git no computador):
   ```bash
   cd ecoponto-medianeira
   git init && git add . && git commit -m "EcoMedianeira"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/ecoponto-medianeira.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. Em 1–2 minutos o link fica no ar. Funciona em qualquer Wi-Fi, no celular e no computador.

---

## Opção 3 — Vercel ou Cloudflare Pages

Também grátis e com HTTPS. Nos dois casos: criar projeto → conectar o repositório do GitHub
(ou arrastar a pasta) → publicar. Os arquivos `vercel.json` e `_headers` já estão prontos.

---

## Opção 4 — Servidor da prefeitura (endereço oficial)

Se a prefeitura hospedar, o ideal é um subdomínio, por exemplo
**`https://eco.medianeira.pr.gov.br`**. Basta copiar **todo o conteúdo** da pasta para a raiz do
site (ou subpasta) e garantir que:

- o servidor entrega `index.html` na raiz;
- existe **HTTPS** (certificado válido — Let's Encrypt é grátis);
- arquivos `.webmanifest` são servidos como `application/manifest+json`;
- `sw.js` é servido da raiz do site (não de subpasta diferente do app).

Todas as rotas do app usam `#/` (ex.: `#/solicitar`), então **não precisa configurar rotas**
no servidor.

---

## Depois de publicado — como o morador instala

| Aparelho | Passo a passo |
|---|---|
| **Android** (Chrome, Edge, Samsung Internet) | abre o link → toque em **Baixar app** (ou menu ⋮ → *Instalar aplicativo*) → **Instalar** |
| **iPhone / iPad** (Safari) | abre o link **no Safari** → **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar** |
| **Computador** (Chrome/Edge) | ícone de instalação na barra de endereço, ou menu ⋮ → *Instalar EcoMedianeira* |

Depois de instalado: ícone na tela inicial, abre em tela cheia e **funciona sem internet**
(as solicitações ficam salvas no aparelho e são enviadas quando a conexão volta).

---

## Divulgar para a cidade

- QR Code do link impresso nos postos de saúde, escolas e no Ecoponto (posso gerar).
- Link no site e nas redes da Prefeitura e da Secretaria de Meio Ambiente.
- Cartaz nas escolas: "Baixe o EcoMedianeira e agende a coleta do seu eletrônico".

---

## O que **não** dá para fazer (limite técnico, não é falta de vontade)

- **Instalar remotamente** nos celulares das pessoas: nenhum sistema (Android/iOS) permite
  que um site instale app em aparelho de outra pessoa sem a confirmação dela. A instalação é
  sempre um toque do morador — por isso o app mostra o botão "Baixar app" e o passo a passo.
- **Publicar sozinho** num serviço de hospedagem: depende de uma conta sua (Netlify, GitHub,
  Vercel) ou do servidor da prefeitura. Assim que você escolher uma opção e me passar o acesso
  (ou arrastar a pasta), o link fica no ar e eu testo do começo ao fim.
