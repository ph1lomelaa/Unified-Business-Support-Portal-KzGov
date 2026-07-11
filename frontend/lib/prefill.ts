import type { Company } from "./types";

export function companyPrefill(company: Company): Record<string, string> {
  return {
    bin: company.bin,
    company_name: company.name,
    director: company.director,
    region: company.region,
    address: company.address,
    oked: company.oked,
    oked_name: company.okedName,
    company_form: company.form,
  };
}

export function mergePrefill<T extends Record<string, unknown>>(
  answers: T,
  company: Company
): T & Record<string, string> {
  return { ...answers, ...companyPrefill(company) };
}
