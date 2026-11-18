import type { Metadata } from "next";
import { StudyInicio } from "@/components/study/study-inicio";

export const metadata: Metadata = {
  title: "Snaptie Study",
  description: "Fotografa as páginas do manual e estuda com um explicador, em quatro etapas.",
  robots: { index: false },
};

export default function StudyPage() {
  return <StudyInicio />;
}
