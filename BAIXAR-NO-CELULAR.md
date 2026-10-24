# Baixar o EcoMedianeira no celular

O app é um **PWA** (aplicativo web instalável). Ele **não é baixado de loja** (Play Store /
App Store) e **não é um arquivo .apk**: quem instala é o próprio navegador, criando um ícone
na tela inicial que abre em tela cheia e funciona **sem internet**.

## O que é preciso (escolha uma opção)

| Situação | O que fazer |
|---|---|
| **Celular na mesma rede Wi-Fi do computador** | abrir `http://192.168.1.53:52777` no navegador do celular (o IP do computador pode mudar; veja em `ipconfig`) |
| **Publicar para toda a cidade (recomendado)** | subir a pasta em uma hospedagem com HTTPS — Netlify Drop, Vercel, GitHub Pages, Cloudflare Pages (grátis) ou o servidor da prefeitura |
| **Já publicado** | abrir o endereço no celular e seguir o passo a passo abaixo |

> ⚠️ Duas limitações técnicas que **não dá para contornar**:
> - A instalação (ícone na tela) **só funciona em `https://` ou na rede local** (`http://` + IP privado).
>   Em `http://` de um domínio público o navegador não oferece a instalação.
> - No **iPhone** a Apple não permite instalar por botão: só por **Compartilhar → Adicionar à Tela de Início**.
>   O app mostra esse passo a passo automaticamente quando detecta iPhone.

## Android (Chrome, Edge, Samsung Internet) — 3 toques

1. Abra o endereço do app no celular.
2. Toque no botão **Baixar app** (faixa no topo) ou no ícone ⬇ do cabeçalho.
3. Toque em **Instalar** na janela que aparece.

Se o botão não aparecer: menu **⋮** → **Instalar aplicativo** / **Adicionar à tela inicial**.
Não funciona em navegadores internos do Instagram, Facebook ou WhatsApp → menu ⋮ → **Abrir no navegador**.

## iPhone / iPad (Safari)

1. Abra o endereço **no Safari**.
2. Toque em **Compartilhar** (quadrado com a seta para cima).
3. Escolha **Adicionar à Tela de Início** → **Adicionar**.

## Desktop (Chrome / Edge)

Ícone de instalação na barra de endereço, ou menu **⋮** → **Instalar EcoMedianeira**.

## O que muda depois de instalado

- Abre em tela cheia, com ícone próprio, como qualquer app.
- Funciona **offline** (service worker guarda os arquivos).
- As solicitações e o histórico ficam salvos no aparelho (`localStorage`).
- Atalhos de toque longo no ícone: *Solicitar coleta*, *Pontos de coleta*, *Acompanhar*.
- Dá para **compartilhar** um texto/link do celular direto para o EcoMedianeira (menu Compartilhar → EcoMedianeira).

## Dicas de publicação (HTTPS grátis)

1. Crie uma conta gratuita no Netlify ou Cloudflare Pages.
2. Arraste a pasta `ecoponto-medianeira` inteira.
3. O endereço `https://….netlify.app` já está pronto para instalar — manda no grupo do bairro.

Todas as rotas funcionam sem configuração de servidor porque o app é uma SPA por `#/rota`
(o servidor só precisa entregar `index.html` na raiz).
