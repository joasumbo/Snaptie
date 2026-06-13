import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("A semear a base de dados...");

  // 1. Administrador da Snaptie (sem empresa associada)
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@snaptie.pt" },
    update: {},
    create: {
      nome: "Administrador Snaptie",
      email: "admin@snaptie.pt",
      password: adminPassword,
      role: "ADMIN",
      status: "ATIVO",
    },
  });
  console.log(`  Admin criado: ${admin.email}`);

  // 2. Empresa cliente de demonstração
  const empresa = await prisma.company.upsert({
    where: { slug: "hotel-demo" },
    update: {},
    create: {
      nome: "Hotel Demo",
      slug: "hotel-demo",
      email: "geral@hoteldemo.pt",
      telefone: "+351 210 000 000",
      website: "https://hoteldemo.pt",
      corPrimaria: "#0F4C81",
      corSecundaria: "#F2C14E",
      estado: "ATIVA",
      plano: "STARTER",
    },
  });
  console.log(`  Empresa criada: ${empresa.nome}`);

  // 3. Gestor da empresa
  const gestorPassword = await bcrypt.hash("gestor123", 10);
  const gestor = await prisma.user.upsert({
    where: { email: "gestor@hoteldemo.pt" },
    update: {},
    create: {
      nome: "Maria Gestora",
      email: "gestor@hoteldemo.pt",
      password: gestorPassword,
      role: "GESTOR_EMPRESA",
      status: "ATIVO",
      companyId: empresa.id,
    },
  });
  console.log(`  Gestor criado: ${gestor.email}`);

  // 4. Template reutilizável para o setor hoteleiro
  const template = await prisma.template.upsert({
    where: { id: "tpl-hotel-demo" },
    update: {},
    create: {
      id: "tpl-hotel-demo",
      nome: "Hotel",
      categoria: "Turismo",
      icone: "hotel",
      ativo: true,
      estruturaJson: {
        blocks: [
          { tipo: "LINK", titulo: "Wi-Fi" },
          { tipo: "PDF", titulo: "Manual do quarto" },
          { tipo: "LINK", titulo: "Website" },
        ],
      },
    },
  });
  console.log(`  Template criado: ${template.nome}`);

  // 5. QR Code da empresa (com template) + botões
  const qr = await prisma.qrCode.upsert({
    where: { slug: "hotel-demo-rececao" },
    update: {},
    create: {
      nome: "QR da Receção",
      descricao: "QR principal apresentado na receção do hotel.",
      slug: "hotel-demo-rececao",
      companyId: empresa.id,
      templateId: template.id,
      corPrimaria: "#0F4C81",
      corSecundaria: "#F2C14E",
      estado: "ativo",
      publicado: true,
      blocks: {
        create: [
          {
            tipo: "LINK",
            titulo: "Wi-Fi do Hotel",
            icone: "wifi",
            ordem: 1,
            conteudo: { rede: "HotelDemo", password: "bemvindo2026" },
          },
          {
            tipo: "PDF",
            titulo: "Manual do Quarto",
            icone: "file-text",
            ordem: 2,
            conteudo: { url: "https://hoteldemo.pt/manual.pdf" },
          },
          {
            tipo: "LINK",
            titulo: "Website",
            icone: "globe",
            ordem: 3,
            conteudo: { url: "https://hoteldemo.pt" },
          },
        ],
      },
    },
  });
  console.log(`  QR criado: ${qr.nome}`);

  console.log("Seed concluido com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
