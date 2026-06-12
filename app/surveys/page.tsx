import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getStrings } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import Link from "next/link";
import { ArrowRightIcon, ClipboardListIcon } from "lucide-react";

export default async function SurveysPage() {
  const locale = await getLocale();
  const t = getStrings(locale);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRightIcon className="size-4" />
              {t.patient.backToDashboard}
            </Link>
            <h1 className="font-sans text-3xl font-bold tracking-tight">
              {t.survey.surveysPageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle — hidden, English is default */}
            {/* <LanguageToggle /> */}
            <ThemeToggle />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardListIcon className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {t.survey.autoScoredInfo}
            </p>
            <Link
              href="/dashboard"
              className="mt-4 text-sm text-primary hover:underline"
            >
              {t.patient.backToDashboard}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
