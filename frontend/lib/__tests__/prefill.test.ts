import { describe, expect, it } from "vitest";
import { companyPrefill, mergePrefill } from "../prefill";

const company = {
  bin: "123456789012",
  name: "ТОО «AgroDala»",
  form: "TOO",
  oked: "01.42",
  okedName: "Разведение КРС",
  address: "Костанай",
  region: "Костанайская область",
  director: "Асхат Нурланов",
  category: "small",
};

describe("prefill", () => {
  it("maps eGov company data to wizard field names", () => {
    expect(companyPrefill(company)).toMatchObject({
      bin: "123456789012",
      company_name: "ТОО «AgroDala»",
      director: "Асхат Нурланов",
      region: "Костанайская область",
    });
  });

  it("preserves existing answers while applying authoritative company fields", () => {
    expect(mergePrefill({ loan_amount: 1000 }, company)).toMatchObject({
      loan_amount: 1000,
      company_form: "TOO",
    });
  });
});
