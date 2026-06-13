"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-violet-500/25 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 60, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 left-1/3 h-[24rem] w-[24rem] rounded-full bg-cyan-400/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_75%)]" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <Aurora />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        <motion.div
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur"
        >
          <QrCode className="size-4" />
          Plataforma de QR codes interativos
        </motion.div>

        <motion.h1
          variants={item}
          className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl"
        >
          QR codes interativos para empresas
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
        >
          Transforme um único scan em menus, guias, links e muito mais — e
          atualize o conteúdo a qualquer momento, sem reimprimir nada.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex justify-center">
          <Button
            size="lg"
            className="group h-11 px-6 text-base"
            render={<Link href="/login" />}
          >
            Iniciar sessão
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
}
