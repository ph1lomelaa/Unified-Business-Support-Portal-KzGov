"use client";

import * as React from "react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { Model, surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { editorLocalization } from "survey-creator-core";
import "survey-creator-core/i18n/russian";
import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";
import { Survey } from "survey-react-ui";
import { ConstructorAi } from "./constructor-ai";
import { ConstructorToolkit } from "./constructor-toolkit";
import { installDictionaryBinding } from "@/lib/survey-dictionaries";
import { stage1Pages, stage2Pages, type SurveySchema } from "@/lib/survey-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

surveyLocalization.currentLocale = "ru";
editorLocalization.currentLocale = "ru";

type Json = Record<string, unknown>;

// Visual form constructor (SurveyJS Creator) — the killer differentiator.
// Branching (Logic tab / visibleIf), expression fields, validators, JSON tab.
export function FormConstructor({
  initialSchema,
  onSave,
  serviceId,
}: {
  initialSchema: Json;
  onSave: (json: Json) => Promise<boolean>;
  serviceId: string;
}) {
  const [dirty, setDirty] = React.useState(false);
  const [preview, setPreview] = React.useState<"stage1" | "stage2" | null>(null);
  // Keep the latest onSave without recreating the creator.
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;

  const creator = React.useMemo(() => {
    const c = new SurveyCreator({
      showLogicTab: true,
      showTranslationTab: false,
      // Business analysts work through visual tools; raw JSON is deliberately
      // hidden from the normal constructor workflow.
      showJSONEditorTab: false,
      showThemeTab: false,
      showEmbeddedSurveyTab: false,
      isAutoSave: true,
      questionTypes: [
        "text",
        "comment",
        "number",
        "dropdown",
        "checkbox",
        "radiogroup",
        "boolean",
        "file",
        "expression",
        "html",
        "panel",
      ],
    });
    c.saveSurveyFunc = (
      saveNo: number,
      callback: (no: number, ok: boolean) => void
    ) => {
      void saveRef.current(c.JSON as Json).then((ok) => {
        if (ok) setDirty(false);
        callback(saveNo, ok);
      });
    };
    c.onModified.add(() => setDirty(true));
    // Wire the "Справочник (ЕППБ)" property so choice questions can bind to a
    // dictionary and load their options live — no manual choices, no code.
    installDictionaryBinding(c);
    return c;
  }, []);

  React.useEffect(() => {
    creator.JSON = initialSchema && Object.keys(initialSchema).length
      ? initialSchema
      : { pages: [] };
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator]);

  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreview("stage1")}>Preview: I этап</Button>
          <Button size="sm" variant="outline" onClick={() => setPreview("stage2")}>Preview: II этап</Button>
        </div>
        <span className="text-[12px] text-muted" role="status">
          {dirty ? "Есть несохранённые изменения — автосохранение…" : "Все изменения сохранены"}
        </span>
      </div>
      <ConstructorAi creator={creator} serviceId={serviceId} />
      <ConstructorToolkit creator={creator} />
      <div className="sjs-eppb h-[calc(100vh-290px)] min-h-[560px] overflow-hidden rounded-card border border-border">
        <SurveyCreatorComponent creator={creator} />
      </div>
      {preview && (
        <StagePreview creator={creator} stage={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function StagePreview({ creator, stage, onClose }: { creator: SurveyCreator; stage: "stage1" | "stage2"; onClose: () => void }) {
  const schema = creator.JSON as SurveySchema;
  const pages = stage === "stage1" ? stage1Pages(schema) : stage2Pages(schema);
  const model = React.useMemo(() => {
    const instance = new Model({ ...schema, pages });
    instance.locale = "ru";
    instance.showCompletedPage = false;
    return instance;
  }, [pages, schema]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Предпросмотр: {stage === "stage1" ? "I этап" : "II этап"}</DialogTitle></DialogHeader>
        {pages.length ? <div className="sjs-eppb-form max-h-[70vh] overflow-auto"><Survey model={model} /></div> : <p className="py-10 text-center text-muted">Для этого этапа страниц пока нет.</p>}
      </DialogContent>
    </Dialog>
  );
}
