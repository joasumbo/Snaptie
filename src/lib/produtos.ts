// Catálogo público do Snaptie: o que se pode fazer com um QR, organizado por
// contexto de uso. Vive em código, e não na tabela `templates`, porque hoje é
// conteúdo de marketing que acompanha o design e muda com cada deploy. Quando
// o botão "Criar este Snaptie" passar a gerar mesmo a página, cada produto
// ganha um Template correspondente e esta lista passa a vir da base de dados.

export type Produto = {
  slug: string;
  nome: string;
  descricao: string;
  // Código de um QR real que demonstra o produto. Sem ele, o cartão não mostra
  // o botão "Ver exemplo" — vale mais não prometer uma demonstração do que
  // levar alguém a uma página vazia.
  demo?: string;
};

export type Categoria = {
  slug: string;
  nome: string;
  descricao: string;
  icone: string; // nome de um ícone lucide-react
  cor: string;
  produtos: Produto[];
};

export const CATEGORIAS: Categoria[] = [
  {
    slug: "souvenir",
    nome: "Souvenir",
    descricao: "Transforma qualquer recordação numa experiência digital.",
    icone: "Magnet",
    cor: "#e11d48",
    produtos: [
      {
        slug: "iman",
        demo: "DEMOSOUVEN",
        nome: "Íman",
        descricao:
          "Um íman de frigorífico que abre fotografias, um vídeo ou uma mensagem de quem o ofereceu.",
      },
      {
        slug: "porta-chaves",
        nome: "Porta-chaves",
        descricao:
          "Leva contactos de emergência e dados do dono sempre à mão, sem os expor a olho nu.",
      },
      {
        slug: "pin",
        nome: "Pin",
        descricao:
          "Um alfinete de lapela que apresenta quem o usa: função, equipa e forma de contacto.",
      },
      {
        slug: "marcador",
        nome: "Marcador de livros",
        descricao:
          "Continua a leitura no telemóvel, com notas, playlist ou a ficha do autor.",
      },
      {
        slug: "postal",
        nome: "Postal",
        descricao:
          "Um postal impresso que abre o álbum completo da viagem e uma mensagem em vídeo.",
      },
      {
        slug: "chapa",
        nome: "Chapa",
        descricao:
          "Placa metálica resistente, para recordações que ficam anos ao ar livre.",
      },
    ],
  },
  {
    slug: "evento",
    nome: "Evento",
    descricao: "Eventos, festivais e concertos.",
    icone: "PartyPopper",
    cor: "#7c3aed",
    produtos: [
      {
        slug: "pulseira",
        demo: "DEMOEVENTO",
        nome: "Pulseira",
        descricao:
          "Identifica o participante e dá acesso ao programa, mapa e avisos em tempo real.",
      },
      {
        slug: "credencial",
        nome: "Credencial",
        descricao:
          "Crachá com o perfil de quem o usa, agenda pessoal e contactos da organização.",
      },
      {
        slug: "passe-vip",
        nome: "Passe VIP",
        descricao:
          "Zonas reservadas, horários privados e extras só para quem tem o passe.",
      },
      {
        slug: "mapa-evento",
        nome: "Mapa do evento",
        descricao:
          "Palcos, bares, casas de banho e saídas, sempre atualizados sem reimprimir nada.",
      },
      {
        slug: "backstage",
        nome: "Backstage",
        descricao:
          "Acesso restrito por PIN a informação de bastidores para equipa e artistas.",
      },
      {
        slug: "horarios",
        nome: "Horários",
        descricao:
          "O alinhamento completo, com alterações de última hora refletidas na hora.",
      },
    ],
  },
  {
    slug: "hotel",
    nome: "Hotel",
    descricao: "Para hotéis, alojamento local e casas de férias.",
    icone: "BedDouble",
    cor: "#0891b2",
    produtos: [
      {
        slug: "informacoes-do-quarto",
        demo: "DEMOHOTELX",
        nome: "Informações do quarto",
        descricao:
          "Tudo o que o hóspede precisa de saber, sem a pasta de plástico na mesinha.",
      },
      {
        slug: "pequeno-almoco",
        nome: "Pequeno-almoço",
        descricao: "Horários, local e ementa do dia, em qualquer idioma.",
      },
      {
        slug: "wifi",
        nome: "Wi-Fi",
        descricao:
          "O hóspede liga-se com um toque, sem escrever a palavra-passe à mão.",
      },
      {
        slug: "check-out",
        nome: "Check-out",
        descricao: "Hora, procedimento e pedido de saída tardia, sem ir à receção.",
      },
      {
        slug: "turismo",
        nome: "Turismo",
        descricao:
          "As recomendações de quem vive ali: restaurantes, praias e o que evitar.",
      },
      {
        slug: "emergencia-hotel",
        nome: "Emergência",
        descricao: "Contactos, plano de evacuação e farmácia mais próxima.",
      },
    ],
  },
  {
    slug: "restaurante",
    nome: "Restaurante",
    descricao: "Mesas, balcão e take-away.",
    icone: "UtensilsCrossed",
    cor: "#ea580c",
    produtos: [
      {
        slug: "menu",
        demo: "DEMORESTAU",
        nome: "Menu",
        descricao:
          "A ementa sempre atual, com fotografias e preços que mudas em segundos.",
      },
      {
        slug: "carta-de-vinhos",
        nome: "Carta de vinhos",
        descricao: "Região, casta e notas de prova, com sugestões de harmonização.",
      },
      {
        slug: "alergenios",
        nome: "Alergénios",
        descricao:
          "Informação obrigatória por prato, clara e sem ocupar espaço na ementa.",
      },
      {
        slug: "promocoes",
        nome: "Promoções",
        descricao: "O prato do dia e as campanhas da semana, atualizados ao almoço.",
      },
      {
        slug: "reservas",
        nome: "Reservas",
        descricao: "O cliente reserva pelo telemóvel a partir da mesa ou da montra.",
      },
    ],
  },
  {
    slug: "business",
    nome: "Business",
    descricao: "Empresas, comércio e serviços.",
    icone: "Building2",
    cor: "#2563eb",
    produtos: [
      {
        slug: "cartao-de-visita",
        demo: "DEMOBUSINE",
        nome: "Cartão de visita",
        descricao:
          "Um cartão que nunca fica desatualizado: muda o cargo, o número e o site quando quiseres.",
      },
      {
        slug: "catalogo",
        nome: "Catálogo",
        descricao: "O catálogo completo num código, sem custos de impressão.",
      },
      {
        slug: "manual",
        nome: "Manual",
        descricao:
          "Instruções de montagem e uso coladas ao produto, com vídeo em vez de desenhos.",
      },
      {
        slug: "garantia",
        nome: "Garantia",
        descricao:
          "Condições, prazo e pedido de assistência sem procurar o papel da compra.",
      },
      {
        slug: "contactos",
        nome: "Contactos",
        descricao: "Telefone, email, morada e horário, num só toque.",
      },
    ],
  },
  {
    slug: "emergencia",
    nome: "Emergência",
    descricao: "Informação crítica, disponível quando conta.",
    icone: "Siren",
    cor: "#dc2626",
    produtos: [
      {
        slug: "contactos-emergencia",
        demo: "DEMOEMERGE",
        nome: "Contactos",
        descricao:
          "Quem contactar primeiro, por ordem, com chamada direta a partir da página.",
      },
      {
        slug: "dados-medicos",
        nome: "Dados médicos",
        descricao:
          "Grupo sanguíneo, alergias e medicação — protegido por PIN, visível a quem socorre.",
      },
      {
        slug: "instrucoes",
        nome: "Instruções",
        descricao: "O que fazer nos primeiros minutos, passo a passo.",
      },
      {
        slug: "localizacao",
        nome: "Localização",
        descricao: "O ponto exato no mapa, para o socorro chegar sem hesitar.",
      },
    ],
  },
  {
    slug: "casa",
    nome: "Casa",
    descricao: "A casa, explicada a quem lá entra.",
    icone: "House",
    cor: "#16a34a",
    produtos: [
      {
        slug: "wifi-casa",
        demo: "DEMOCASAXX",
        nome: "Wi-Fi",
        descricao: "As visitas ligam-se sem perguntar a palavra-passe.",
      },
      {
        slug: "manuais",
        nome: "Manuais",
        descricao:
          "Caldeira, máquina de lavar, alarme — cada manual colado ao aparelho.",
      },
      {
        slug: "inventario",
        nome: "Inventário",
        descricao: "O que está em cada caixa, sem abrir nenhuma.",
      },
      {
        slug: "assistencia",
        nome: "Assistência",
        descricao: "Canalizador, eletricista e senhorio, com histórico de intervenções.",
      },
    ],
  },
  {
    slug: "pet",
    nome: "Animal",
    descricao: "Para quem não pode dizer onde mora.",
    icone: "PawPrint",
    cor: "#d97706",
    produtos: [
      {
        slug: "identificacao",
        demo: "DEMOANIMAL",
        nome: "Identificação",
        descricao:
          "Na coleira: nome, morada e contacto de quem o encontra pode ligar já.",
      },
      {
        slug: "vacinas",
        nome: "Vacinas",
        descricao: "Boletim atualizado, à mão no veterinário ou no hotel canino.",
      },
      {
        slug: "contactos-pet",
        nome: "Contactos",
        descricao: "Dono, veterinário e quem cuida dele quando não estás.",
      },
    ],
  },
  {
    slug: "familia",
    nome: "Família",
    descricao: "Momentos que merecem mais do que uma fotografia.",
    icone: "Users",
    cor: "#db2777",
    produtos: [
      {
        slug: "album",
        nome: "Álbum",
        descricao: "O álbum partilhado, que cresce à medida que chegam fotografias.",
      },
      {
        slug: "casamento",
        demo: "DEMOFAMILI",
        nome: "Casamento",
        descricao:
          "Programa, mapa, lista de presentes e o álbum de todos os convidados.",
      },
      {
        slug: "batizado",
        nome: "Batizado",
        descricao: "Cerimónia, padrinhos e as fotografias do dia num só sítio.",
      },
      {
        slug: "memorial",
        nome: "Memorial",
        descricao:
          "Uma placa que abre a história de uma vida, com fotografias e testemunhos.",
      },
    ],
  },
  {
    slug: "industrial",
    nome: "Industrial",
    descricao: "Chão de fábrica, armazém e manutenção.",
    icone: "Factory",
    cor: "#475569",
    produtos: [
      {
        slug: "maquina",
        demo: "DEMOFABRIC",
        nome: "Máquina",
        descricao:
          "Ficha técnica, parâmetros e responsável, colados à própria máquina.",
      },
      {
        slug: "manutencao",
        nome: "Manutenção",
        descricao: "Histórico de intervenções e próxima revisão, sem consultar o sistema.",
      },
      {
        slug: "inventario-industrial",
        nome: "Inventário",
        descricao: "Conteúdo, lote e validade de cada palete ou contentor.",
      },
      {
        slug: "formacao",
        nome: "Formação",
        descricao:
          "O vídeo de operação segura no posto de trabalho, disponível a quem chega novo.",
      },
    ],
  },
];

export const TOTAL_PRODUTOS = CATEGORIAS.reduce(
  (n, c) => n + c.produtos.length,
  0,
);

export function findCategoria(slug: string): Categoria | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}
