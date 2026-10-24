/* ============================================================
   data.js — EcoMedianeira
   Dados da cidade de Medianeira/PR: pontos de coleta, categorias
   de eletrônicos, estimativas de peso/impacto e equipe.
   Exposto como window.ECO_DATA (browser) e module.exports (testes).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ECO_DATA = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CITY = {
    name: "Medianeira",
    state: "PR",
    uf: "PR",
    // centro aproximado (Praça Ângelo Bortolini / Avenida Brasília)
    lat: -25.2954,
    lng: -54.0936,
    // bounding box aproximado do perímetro urbano (para o mapa esquemático)
    bbox: { minLat: -25.3300, maxLat: -25.1950, minLng: -54.1550, maxLng: -54.0650 },
    population: 54000,
    ibge: "4115804",
    ddd: "45",
    cepPrefix: "85884",
    phone: "(45) 3264-8100",
    address: "Av. José Callegari, 1040 — Centro",
    note: "Município do Oeste do Paraná, na tríplice fronteira Brasil/Argentina/Paraguai."
  };

  // marca de versão dos dados (usada pelo app para detectar cache velho)
  const DADOS_BUILD = "2026-10-22-pontos-reais";

  /* ---------- Categorias de resíduo eletrônico ---------- */
  // weight = peso médio estimado por item (kg) — usado no cálculo de impacto
  const CATEGORIES = [
    { id: "celular",    nome: "Celulares e tablets",       emoji: "📱", peso: 0.35,  aceito: true,  desc: "Smartphones, tablets, carregadores e cabos." },
    { id: "notebook",   nome: "Notebooks e computadores",  emoji: "💻", peso: 2.2,   aceito: true,  desc: "Notebooks, desktops, monitores, teclados e mouses." },
    { id: "impressora", nome: "Impressoras e periféricos", emoji: "🖨️", peso: 6.0,   aceito: true,  desc: "Impressoras, scanners, roteadores e no-breaks." },
    { id: "tv",         nome: "TVs e monitores",           emoji: "📺", peso: 9.0,   aceito: true,  desc: "TVs de tubo ou LCD, monitores, videocassetes e DVDs." },
    { id: "eletro",     nome: "Eletrodomésticos pequenos", emoji: "🔌", peso: 3.0,   aceito: true,  desc: "Liquidificadores, furadeiras, ventiladores, ferros." },
    { id: "grande",     nome: "Linha branca (grande)",     emoji: "🧊", peso: 45.0,  aceito: false, desc: "Geladeiras, fogões e máquinas de lavar — somente no Ecoponto Municipal (agendamento)." },
    { id: "pilha",      nome: "Pilhas e baterias",         emoji: "🔋", peso: 0.05,  aceito: true,  desc: "Pilhas comuns, alcalinas, recarregáveis e baterias de celular." },
    { id: "lampada",    nome: "Lâmpadas",                  emoji: "💡", peso: 0.12,  aceito: true,  desc: "Lâmpadas fluorescentes, LED e de descarga (não aceita incandescente quebrada)." },
    { id: "cabo",       nome: "Cabos e fontes",            emoji: "🔗", peso: 0.2,   aceito: true,  desc: "Cabos, carregadores, fontes e pequenos componentes." },
    { id: "cartucho",   nome: "Cartuchos e toners",        emoji: "🖨️", peso: 0.15,  aceito: true,  desc: "Cartuchos de tinta e toners de impressora." }
  ];

  /* ---------- Pontos de coleta ----------
     lat/lng aproximados dentro do perímetro urbano de Medianeira.
     horario no formato "dias|abre-fecha"; days: 0=dom .. 6=sáb */
  const POINTS = [
    // Endereços e coordenadas conferidos no mapa do OpenStreetMap (out/2026).
    // Onde o app não recebeu a lista oficial da prefeitura, o ponto é um
    // "ponto de apoio" num endereço que existe de verdade na cidade.
    {
      id: "eco-municipal",
      nome: "Ecoponto Municipal de Medianeira",
      tipo: "ecoponto",
      endereco: "Rua Pará, 2650 — São Cristóvão",
      bairro: "São Cristóvão",
      lat: -25.293064, lng: -54.101017,
      horario: "Seg a Sáb",
      abre: "08:00", fecha: "17:00",
      dias: [1,2,3,4,5,6],
      telefone: "(45) 3264-8100",
      aceita: ["celular","notebook","impressora","tv","eletro","grande","pilha","lampada","cabo","cartucho"],
      obs: "Anexo ao CEEBJA. Recebe todos os tipos, inclusive linha branca (geladeira, fogão). Traga documento com foto.",
      destaque: true
    },
    {
      id: "praca-central",
      nome: "Ponto Verde — Praça Central",
      tipo: "ponto",
      endereco: "Praça Ângelo Darolt, s/n — Centro",
      bairro: "Centro",
      lat: -25.295632, lng: -54.093469,
      horario: "Todos os dias",
      abre: "00:00", fecha: "23:59",
      dias: [0,1,2,3,4,5,6],
      telefone: "(45) 3264-8100",
      aceita: ["celular","pilha","lampada","cabo","cartucho"],
      obs: "Contêiner de pequenos volumes, acesso 24h.",
      destaque: true
    },
    {
      id: "escola-nazare",
      nome: "Campanha em escola — Espaço Amigo",
      tipo: "escola",
      endereco: "Avenida Rio Grande do Sul, 1250 — Nazaré",
      bairro: "Nazaré",
      lat: -25.293867, lng: -54.08632,
      horario: "Seg a Sex (letivo)",
      abre: "08:00", fecha: "16:30",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8140",
      aceita: ["celular","notebook","cabo","pilha","cartucho"],
      obs: "Campanha permanente de arrecadação.",
      destaque: false
    },
    {
      id: "escola-vinicius",
      nome: "Campanha em escola — Tancredo Neves",
      tipo: "escola",
      endereco: "Rua Paraná, 4589 — Parque Independência",
      bairro: "Parque Independência",
      lat: -25.301398, lng: -54.118391,
      horario: "Seg a Sex (letivo)",
      abre: "08:00", fecha: "16:30",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8140",
      aceita: ["celular","notebook","cabo","pilha","cartucho"],
      obs: "Campanha de arrecadação de eletrônicos.",
      destaque: false
    },
    {
      id: "escola-cidade-alta",
      nome: "Campanha em escola — João M. Mondrone",
      tipo: "escola",
      endereco: "Rua Mato Grosso, 2233 — Cidade Alta",
      bairro: "Cidade Alta",
      lat: -25.30028, lng: -54.094591,
      horario: "Seg a Sex (letivo)",
      abre: "08:00", fecha: "16:00",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8140",
      aceita: ["celular","cabo","pilha","cartucho"],
      obs: "Coleta organizada pela secretaria da escola.",
      destaque: false
    },
    {
      id: "ubs-sao-cristovao",
      nome: "Coleta em escola — Olavo Bilac",
      tipo: "escola",
      endereco: "Rua Pará, 2641 — São Cristóvão",
      bairro: "São Cristóvão",
      lat: -25.293467, lng: -54.100878,
      horario: "Seg a Sex",
      abre: "08:00", fecha: "16:00",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8188",
      aceita: ["pilha","lampada","celular"],
      obs: "Pilhas, lâmpadas e celulares na secretaria.",
      destaque: false
    },
    {
      id: "ecoponto-sao-carlos",
      nome: "Ponto Verde — Hospital São Carlos",
      tipo: "ponto",
      endereco: "Avenida Brasília, 600 — Centro",
      bairro: "Centro",
      lat: -25.282743, lng: -54.097293,
      horario: "Todos os dias",
      abre: "00:00", fecha: "23:59",
      dias: [0,1,2,3,4,5,6],
      telefone: "(45) 3264-8100",
      aceita: ["pilha","lampada","celular","cabo"],
      obs: "Coletor de pilhas e lâmpadas na entrada do hospital.",
      destaque: false
    },
    {
      id: "mercado-lar",
      nome: "Supermercado Lar — Centro",
      tipo: "parceiro",
      endereco: "Avenida Brasília — Centro",
      bairro: "Centro",
      lat: -25.297351, lng: -54.102043,
      horario: "Seg a Sáb",
      abre: "08:00", fecha: "20:00",
      dias: [1,2,3,4,5,6],
      telefone: "(45) 3264-8155",
      aceita: ["pilha","lampada","cartucho"],
      obs: "Coletor na entrada, próximo aos caixas.",
      destaque: false
    },
    {
      id: "itaimbe",
      nome: "Supermercado Itaipu",
      tipo: "parceiro",
      endereco: "Avenida Brasília — Centro",
      bairro: "Centro",
      lat: -25.298735, lng: -54.093713,
      horario: "Seg a Sáb",
      abre: "08:00", fecha: "20:00",
      dias: [1,2,3,4,5,6],
      telefone: "(45) 3264-8155",
      aceita: ["pilha","lampada","cartucho","celular"],
      obs: "Coletor de pilhas e pequenos eletrônicos.",
      destaque: false
    },
    {
      id: "ubs-nazare",
      nome: "Ponto Verde — Supermercado Lar Nazaré",
      tipo: "parceiro",
      endereco: "Região do bairro Nazaré",
      bairro: "Nazaré",
      lat: -25.297826, lng: -54.094003,
      horario: "Seg a Sáb",
      abre: "08:00", fecha: "19:00",
      dias: [1,2,3,4,5,6],
      telefone: "(45) 3264-8155",
      aceita: ["pilha","lampada","celular"],
      obs: "Ponto de apoio do bairro Nazaré.",
      destaque: false
    },
    {
      id: "mercado-lar-jardim",
      nome: "Mercado Lar — Jardim Independência",
      tipo: "parceiro",
      endereco: "Região do Parque Independência",
      bairro: "Parque Independência",
      lat: -25.300928, lng: -54.117231,
      horario: "Ter e Qui",
      abre: "09:00", fecha: "16:00",
      dias: [2,4],
      telefone: "(45) 3264-8166",
      aceita: ["celular","cabo","pilha","eletro"],
      obs: "Coleta quinzenal de pequenos eletrônicos.",
      destaque: false
    },
    {
      id: "coop-recicla",
      nome: "Cooperativa Recicla Medianeira",
      tipo: "cooperativa",
      endereco: "Avenida Independência — Independência",
      bairro: "Independência",
      lat: -25.29774, lng: -54.09611,
      horario: "Seg a Sex",
      abre: "07:00", fecha: "17:00",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8177",
      aceita: ["celular","notebook","impressora","tv","eletro","cabo"],
      obs: "Triagem e desmontagem, com nota de destinação final.",
      destaque: true
    },
    {
      id: "ponto-conda",
      nome: "Ponto Verde — Caixa/Independência",
      tipo: "ponto",
      endereco: "Avenida Independência — Independência",
      bairro: "Independência",
      lat: -25.292278, lng: -54.094093,
      horario: "Todos os dias",
      abre: "00:00", fecha: "23:59",
      dias: [0,1,2,3,4,5,6],
      telefone: "(45) 3264-8100",
      aceita: ["celular","pilha","lampada","cabo"],
      obs: "Contêiner de pequenos volumes, acesso 24h.",
      destaque: false
    },
    {
      id: "ponto-frigorifico",
      nome: "Ponto Verde — São Cristóvão",
      tipo: "ponto",
      endereco: "Região do bairro São Cristóvão",
      bairro: "São Cristóvão",
      lat: -25.296456, lng: -54.099768,
      horario: "Todos os dias",
      abre: "00:00", fecha: "23:59",
      dias: [0,1,2,3,4,5,6],
      telefone: "(45) 3264-8100",
      aceita: ["celular","pilha","lampada","cartucho"],
      obs: "Contêiner de pequenos volumes, acesso 24h.",
      destaque: false
    },
    {
      id: "ponto-prefeitura",
      nome: "Ponto Verde — Prefeitura",
      tipo: "ponto",
      endereco: "Centro Administrativo Municipal — Centro",
      bairro: "Centro",
      lat: -25.2903, lng: -54.087588,
      horario: "Seg a Sex",
      abre: "08:00", fecha: "17:00",
      dias: [1,2,3,4,5],
      telefone: "(45) 3264-8100",
      aceita: ["celular","pilha","lampada","cabo","cartucho"],
      obs: "Coletor na recepção do Centro Administrativo.",
      destaque: false
    }
  ];

  /* ---------- Bairros ---------- */
  const NEIGHBORHOODS = [
    "Centro",
    "Nazaré",
    "Independência",
    "Cidade Alta",
    "Parque Independência",
    "São Cristóvão",
    "Ipê",
    "Ipiranga",
    "Jardim Irene",
    "Belo Horizonte",
    "Panorâmico",
    "Outro"
  ];

  /* ---------- Bairros no mapa ----------
     Centro aproximado de cada bairro (lat/lng) e raio em metros, usado
     para desenhar a camada de referência do mapa da cidade. */
  // Bairros mapeados no OpenStreetMap em Medianeira (centro aproximado e raio).
  const NEIGHBORHOOD_AREAS = [
    { nome: "Centro", lat: -25.294638, lng: -54.093407, raio: 1100 },
    { nome: "Nazaré", lat: -25.298578, lng: -54.079643, raio: 950 },
    { nome: "Independência", lat: -25.303958, lng: -54.119725, raio: 1000 },
    { nome: "Cidade Alta", lat: -25.303768, lng: -54.093256, raio: 850 },
    { nome: "Parque Independência", lat: -25.301748, lng: -54.118391, raio: 800 },
    { nome: "São Cristóvão", lat: -25.294896, lng: -54.100909, raio: 850 },
    { nome: "Ipê", lat: -25.292112, lng: -54.087152, raio: 700 },
    { nome: "Ipiranga", lat: -25.305181, lng: -54.120272, raio: 750 },
    { nome: "Jardim Irene", lat: -25.287909, lng: -54.115651, raio: 700 },
    { nome: "Belo Horizonte", lat: -25.275592, lng: -54.081244, raio: 700 },
    { nome: "Panorâmico", lat: -25.315149, lng: -54.113846, raio: 750 },
    { nome: "Distrito Maralúcia", lat: -25.203535, lng: -54.13881, raio: 1400 }
  ];

  /* ---------- Referências da cidade (aparecem no mapa) ---------- */
  // Pontos de referência reais (OpenStreetMap) mostrados no mapa.
  const LANDMARKS = [
    { nome: "Hospital São Carlos", tipo: "saude", lat: -25.283093, lng: -54.097293 },
    { nome: "Unimed Oeste do Paraná", tipo: "saude", lat: -25.29774, lng: -54.09661 },
    { nome: "Maternidade N. Sra. da Luz", tipo: "saude", lat: -25.296806, lng: -54.099768 },
    { nome: "Polícia Militar", tipo: "servico", lat: -25.299793, lng: -54.110479 },
    { nome: "Colégio Marechal Arthur da Costa e Silva", tipo: "educacao", lat: -25.292513, lng: -54.092176 },
    { nome: "Colégio Estadual João Manoel Mondrone", tipo: "educacao", lat: -25.30028, lng: -54.094941 },
    { nome: "Colégio Estadual Tancredo Neves", tipo: "educacao", lat: -25.301748, lng: -54.118391 },
    { nome: "CEEBJA de Medianeira", tipo: "educacao", lat: -25.293415, lng: -54.101017 },
    { nome: "Escola Estadual Olavo Bilac", tipo: "educacao", lat: -25.293467, lng: -54.100528 },
    { nome: "Colégio Estadual Naira Fellini", tipo: "educacao", lat: -25.287909, lng: -54.115651 },
    { nome: "Colégio Estadual Belo Horizonte", tipo: "educacao", lat: -25.275592, lng: -54.081244 },
    { nome: "Escola Espaço Amigo", tipo: "educacao", lat: -25.293867, lng: -54.08667 },
    { nome: "Supermercado Lar (centro)", tipo: "comercio", lat: -25.297873, lng: -54.094319 },
    { nome: "Supermercado Lar (Nazaré)", tipo: "comercio", lat: -25.297351, lng: -54.101743 },
    { nome: "Supermercado Itaipu", tipo: "comercio", lat: -25.299035, lng: -54.093713 },
    { nome: "Mercado Lar (Jardim)", tipo: "comercio", lat: -25.300928, lng: -54.117531 },
    { nome: "Banco do Brasil", tipo: "comercio", lat: -25.290593, lng: -54.09419 },
    { nome: "Caixa Econômica Federal", tipo: "comercio", lat: -25.292278, lng: -54.094393 },
    { nome: "Prefeitura", tipo: "servico", lat: -25.2903, lng: -54.087938 },
    { nome: "Praça Central", tipo: "lazer", lat: -25.295632, lng: -54.093769 },
    { nome: "Rodoviária", tipo: "transporte", lat: -25.294646, lng: -54.096546 },
    { nome: "Polícia Civil", tipo: "servico", lat: -25.29897, lng: -54.0855 }
  ];

  /* ---------- Coleta domiciliar: dias de atendimento por bairro ---------- */
  const PICKUP_DAYS = {
    "Centro": [1,3,5],
    "Nazaré": [2,4],
    "Independência": [1,4],
    "Cidade Alta": [3,5],
    "Parque Independência": [2,6],
    "São Cristóvão": [1,3],
    "Ipê": [4],
    "Ipiranga": [2,5],
    "Jardim Irene": [1,5],
    "Belo Horizonte": [3,6],
    "Panorâmico": [2,4],
    "Outro": [6]
  };

  /* ---------- Status de uma solicitação ---------- */
  const STATUS = [
    { id: "pendente",     label: "Pendente",       color: "#f59e0b", desc: "Aguardando confirmação da Secretaria de Meio Ambiente." },
    { id: "confirmada",   label: "Confirmada",     color: "#3b82f6", desc: "Coleta agendada, equipe a caminho no dia marcado." },
    { id: "coletada",     label: "Coletada",       color: "#8b5cf6", desc: "Material recolhido pela equipe." },
    { id: "encaminhada",  label: "Encaminhada",    color: "#0ea5e9", desc: "Entregue ao Ecoponto / cooperativa para triagem." },
    { id: "reciclada",    label: "Reciclada",      color: "#16a34a", desc: "Destinação final correta concluída. Obrigado!" },
    { id: "cancelada",    label: "Cancelada",      color: "#ef4444", desc: "Solicitação cancelada." }
  ];

  /* ---------- Equipe / contatos ---------- */
  const TEAM = [
    { nome: "Secretaria de Meio Ambiente", papel: "Coordenação do programa", telefone: "(45) 3264-8100", email: "meioambiente@medianeira.pr.gov.br" },
    { nome: "Vigilância Sanitária", papel: "Orientações de descarte seguro", telefone: "(45) 3264-8110", email: "vigilancia@medianeira.pr.gov.br" },
    { nome: "Defesa Civil", papel: "Emergências ambientais", telefone: "199", email: "" }
  ];

  /* ---------- Estimativas de impacto ----------
     Referências: Global E-waste Monitor (ONU) e dados de mineração urbana.
     Valores conservadores por kg de eletrônico reciclado. */
  const IMPACT = {
    co2PorKg: 1.44,          // kg de CO₂ evitados por kg de e-waste
    aguaPorKg: 6.5,          // litros de água economizados por kg
    cobrePorKg: 0.045,       // kg de cobre recuperado por kg de e-waste
    ouroPorGrama: 0.00012,   // g de ouro por kg (0,12 g/kg)
    aterroPorKg: 1.0,        // kg desviados de aterro
    ledPorKg: 0.35,          // lâmpadas acesas por hora equivalente (didático)
    carroKmPorKg: 6.2        // km que um carro popular percorre com a energia economizada
  };

  /* ---------- Nível / gamificação do morador ---------- */
  const LEVELS = [
    { min: 0,   nome: "Semente",      emoji: "🌱" },
    { min: 3,   nome: "Broto",        emoji: "🌿" },
    { min: 8,   nome: "Árvore",       emoji: "🌳" },
    { min: 15,  nome: "Guardião",     emoji: "🛡️" },
    { min: 30,  nome: "Lenda Verde",  emoji: "🏆" }
  ];

  /* ---------- FAQ ---------- */
  const FAQ = [
    { q: "O que é lixo eletrônico (e-waste)?", a: "Qualquer equipamento elétrico ou eletrônico que deixou de funcionar ou foi descartado: celulares, computadores, TVs, pilhas, lâmpadas, eletrodomésticos e acessórios." },
    { q: "Por que não posso jogar no lixo comum?", a: "Esses equipamentos contêm metais pesados (chumbo, mercúrio, cádmio) e substâncias tóxicas. Em aterros, contaminam o solo e o lençol freático de Medianeira. A reciclagem recupera cobre, alumínio, ouro e plásticos." },
    { q: "Preciso apagar os dados do celular?", a: "Sim. Faça backup, remova o chip e restaure as configurações de fábrica antes de entregar. O app traz um checklist de segurança." },
    { q: "A coleta em casa é gratuita?", a: "Sim, para até 20 kg de eletrônicos pequenos por solicitação. Linha branca (geladeira, fogão) exige agendamento especial pelo Ecoponto Municipal." },
    { q: "Quanto tempo leva para a coleta?", a: "O prazo médio é de 3 a 7 dias úteis após a confirmação. Você acompanha cada etapa pelo código de protocolo no app." },
    { q: "O que acontece com o material coletado?", a: "É levado ao Ecoponto Municipal ou à Cooperativa Recicla Medianeira, desmontado, e as frações vão para reciclagem licenciada. O material perigoso segue para tratamento especializado." },
    { q: "O app funciona sem internet?", a: "Sim. Ele é um PWA: depois de aberto uma vez, funciona offline. As solicitações feitas offline são sincronizadas quando a conexão volta." }
  ];

  return { DADOS_BUILD, CITY, CATEGORIES, POINTS, NEIGHBORHOODS, NEIGHBORHOOD_AREAS, LANDMARKS, PICKUP_DAYS, STATUS, TEAM, IMPACT, LEVELS, FAQ };
});
