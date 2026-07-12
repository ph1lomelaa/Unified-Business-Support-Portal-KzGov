// No-code binding between the SurveyJS form constructor and ЕППБ справочники.
//
// Adds a "Справочник (ЕППБ)" property to every choice-based question (dropdown,
// checkbox, radiogroup, tagbox, ranking). Picking a dictionary sets the
// question's native `choicesByUrl` to the public items endpoint, so the choices
// load live in BOTH the Creator preview and the runtime wizard — the analyst
// never edits choices by hand or touches code. `{questionName}` tokens in the
// URL are supported by SurveyJS, enabling cascading (регион -> район).

import { Serializer } from "survey-core";
import type { ModifiedEvent, SurveyCreatorModel } from "survey-creator-core";

const DICT_LIST_URL = "/bff/api/v1/dictionaries";
const dictItemsUrl = (code: string) => `${DICT_LIST_URL}/${code}/items`;

let propertyRegistered = false;

function registerDictionaryProperty() {
  if (propertyRegistered) return;
  propertyRegistered = true;

  Serializer.addProperty("selectbase", {
    name: "dictionaryCode",
    displayName: "Справочник (ЕППБ)",
    category: "choices",
    visibleIndex: 0,
    // The property-grid dropdown is populated live from the dictionaries API.
    choices: (
      _obj: unknown,
      choicesCallback: (choices: Array<{ value: string; text: string }>) => void
    ) => {
      fetch(DICT_LIST_URL, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: Array<{ code: string; title: string }>) =>
          choicesCallback([
            { value: "", text: "— без справочника —" },
            ...rows.map((d) => ({ value: d.code, text: `${d.title} (${d.code})` })),
          ])
        )
        .catch(() => choicesCallback([{ value: "", text: "— без справочника —" }]));
    },
  });
}

type DictionaryTarget = {
  choices?: unknown[];
  choicesByUrl?: { url: string } | null;
};
export function installDictionaryBinding(creator: SurveyCreatorModel): void {
  registerDictionaryProperty();
  creator.onModified.add((_sender: SurveyCreatorModel, options: ModifiedEvent) => {
    if (options?.type !== "PROPERTY_CHANGED" || options?.name !== "dictionaryCode") return;
    const question = options.target as unknown as DictionaryTarget | undefined;
    const code = String(options.newValue ?? "");
    if (!question) return;
    if (code) {
      question.choices = [];
      question.choicesByUrl = { url: dictItemsUrl(code) };
    } else if (question.choicesByUrl) {
      question.choicesByUrl.url = "";
    }
  });
}
