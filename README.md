# EcoMedianeira — reciclagem e coleta de eletrônicos em Medianeira/PR

App web (PWA) que funciona **offline**, sem servidor e sem dependências: basta abrir o `index.html`.
Os dados ficam no aparelho (`localStorage`) e há uma fila de sincronização para quando a internet volta.

## Como abrir

- **Já está rodando** em http://127.0.0.1:52777 (servido pela sessão).
- Para abrir em outro computador: sirva a pasta com qualquer servidor estático
  (`python -m http.server`, `npx serve`, IIS, Nginx, Netlify, Vercel, GitHub Pages…).
  O service worker (uso offline / instalação) só ativa em `http(s)`, não em `file://`.
- Para publicar de verdade, basta copiar a pasta inteira. Não há build nem instalação.

## Telas

| Rota | O que faz |
|---|---|
| `#/inicio` | resumo, nível verde, próximo dia de coleta do bairro, pontos mais próximos |
| `#/solicitar` | formulário de coleta (10 tipos de equipamento, peso estimado, validações) |
| `#/pontos` | 10 pontos de coleta, "aberto agora", filtros, **mapa de ruas real (OpenStreetMap)** com aba de esquema offline, zoom/arrastar, GPS e rota |
| `#/acompanhar` | lista de solicitações com busca e filtro por status |
| `#/protocolo?id=` | detalhe do protocolo com linha do tempo e cancelamento |
| `#/impacto` | kg reciclados, CO₂, água, cobre, ouro, gráficos por categoria e bairro, meta |
| `#/aprender` | checklist antes de descartar, FAQ, contatos da cidade |
| `#/admin` | painel da equipe: troca de status, CSV, backup JSON (senha de demonstração: `medianeira`) |

## Regras de negócio implementadas

- Coleta em casa até **20 kg**; acima disso, só Ecoponto Municipal ou cooperativa.
- **Linha branca** (geladeira, fogão, máquina de lavar) apenas no Ecoponto Municipal.
- Telefone precisa ter **DDD 45** (Medianeira).
- A data da coleta só aceita os **dias fixos do bairro** (`PICKUP_DAYS` em `js/data.js`) e nunca no passado.
- Protocolo único no formato `MED-AAAA-XXXXXX` (sem caracteres ambíguos).
- Status: pendente → confirmada → coletada → encaminhada → reciclada (ou cancelada), com histórico.

## Estrutura

```
index.html              telas (SPA por hash)
css/style.css           tema claro/escuro, responsivo
js/data.js              dados da cidade: pontos, categorias, pesos, impacto, FAQ
js/app.js               regras + telas + roteamento + armazenamento
js/qr.js                desativado nesta versão (ver nota abaixo)
vendor/leaflet/         biblioteca de mapa embarcada (mapa de ruas real)
sw.js                   service worker (rede primeiro, cache para offline)
manifest.webmanifest    instalação como app
icon.svg / *.png        ícones
tests/                  testes automatizados (Node puro, sem dependências)
```

## Testes

```bash
node tests/logic.test.js    # 21 verificações de regras de negócio
node tests/smoke.js         # 15 verificações: todas as telas + fluxo de solicitação + painel
node tests/render.test.js   #  7 verificações de texto renderizado (pega "NaN", bairro duplicado…)
node tests/install.test.js  #  9 verificações da instalação no celular
node tests/map.test.js      # 13 verificações do mapa (ruas, esquema, zoom, GPS)
node tests/e2e.js           #  9 fluxos completos (solicitar, filtrar, impacto, admin, offline)
node tools/auditoria.js     #  integridade: arquivos, rotas, dados, referências (0 problemas)
```

Total: **74 verificações, todas passando.** A auditoria de integridade também passa sem problemas.

## Notas e pendências

- **QR Code:** o gerador próprio foi retirado porque a informação de formato saía inválida em
  parte dos casos (código ilegível). Nenhuma tela exibe QR. Para ter QR novamente, o caminho
  seguro é usar uma biblioteca validada (`qrcode` ou `qr-creator`) — a tela do protocolo já
  tem o espaço e a função `drawQr()` pronta para receber isso.
- **Dados dos pontos de coleta** (endereços, horários, telefones) são de **demonstração**.
  Substituir em `js/data.js` → `POINTS` com a lista oficial da Secretaria de Meio Ambiente.
- **Painel da equipe** usa senha fixa no cliente (`medianeira`), adequada só para demonstração:
  sem servidor não existe autenticação real. Em produção, o painel deve ficar atrás de um back-end.
- **Sincronização:** hoje a fila marca as solicitações como "enviadas" no próprio aparelho.
  Falta o endpoint do servidor da prefeitura para receber e devolver os status.
