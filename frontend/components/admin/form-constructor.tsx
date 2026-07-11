"use client";

import * as React from "react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import { surveyLocalization } from "survey-core";
import "survey-core/i18n/russian";
import { editorLocalization } from "survey-creator-core";
import "survey-creator-core/i18n/russian";
import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";
import { ConstructorAi } from "./constructor-ai";

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
  // Keep the latest onSave without recreating the creator.
  const saveRef = React.useRef(onSave);
  saveRef.current = onSave;

  const creator = React.useMemo(() => {
    const c = new SurveyCreator({
      showLogicTab: true,
      showTranslationTab: false,
      showJSONEditorTab: true,
      showThemeTab: false,
      showEmbeddedSurveyTab: false,
      isAutoSave: false,
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
      void saveRef.current(c.JSON as Json).then((ok) => callback(saveNo, ok));
    };
    return c;
  }, []);

  React.useEffect(() => {
    creator.JSON = initialSchema && Object.keys(initialSchema).length
      ? initialSchema
      : { pages: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator]);

  return (
    <div>
      <ConstructorAi creator={creator} serviceId={serviceId} />
      <div className="sjs-eppb h-[calc(100vh-290px)] min-h-[560px] overflow-hidden rounded-card border border-border">
        <SurveyCreatorComponent creator={creator} />
      </div>
    </div>
  );
}
