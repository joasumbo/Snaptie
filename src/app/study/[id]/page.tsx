import type { Metadata } from "next";
import { StudyEstudo } from "@/components/study/study-estudo";

export const metadata: Metadata = { title: "Snaptie Study", robots: { index: false } };

export default async function EstudoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyEstudo id={id} />;
}
