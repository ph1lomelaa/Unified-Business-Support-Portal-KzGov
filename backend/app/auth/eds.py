"""Parse the signer certificate out of an NCALayer CMS signature (M5).

NCALayer (kz.gov.pki.knca.commonUtils.createCMSSignatureFromBase64) returns a
base64 CMS/PKCS7 SignedData. We parse the embedded certificate's subject to
read ИИН/БИН/ФИО — the same fields a real gov service reads. Kazakh certs put
the IIN in `serialNumber` (prefixed "IIN"), the BIN in `organizationIdentifier`
or an OU (prefixed "BIN"), and the name in CN / surname+givenName.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass


@dataclass
class EdsIdentity:
    iin: str | None
    bin: str | None
    fio: str
    org: str | None


def _clean(value: str | None, prefix: str) -> str | None:
    if not value:
        return None
    v = str(value).strip()
    if v.upper().startswith(prefix):
        v = v[len(prefix):]
    return v or None


def parse_cms_subject(cms_b64: str) -> EdsIdentity:
    from asn1crypto import cms

    der = base64.b64decode(cms_b64)
    info = cms.ContentInfo.load(der)
    signed = info["content"]
    certs = signed["certificates"]
    if not certs or len(certs) == 0:
        raise ValueError("В подписи нет сертификата")

    # take the first end-entity certificate
    cert = certs[0].chosen
    subject = cert.subject.native  # OrderedDict of human-named RDNs

    serial = subject.get("serial_number")
    common_name = subject.get("common_name")
    surname = subject.get("surname")
    given = subject.get("given_name")
    org = subject.get("organization_name")
    # organizationIdentifier (2.5.4.97) and OU may carry the BIN
    org_id = subject.get("organization_identifier") or subject.get("2.5.4.97")
    ou = subject.get("organizational_unit_name")
    if isinstance(ou, list):
        ou = next((x for x in ou if "BIN" in str(x).upper()), None)

    iin = _clean(serial, "IIN")
    bin_ = _clean(org_id, "BIN") or _clean(ou, "BIN")

    fio = common_name or " ".join(x for x in (surname, given) if x) or "Владелец ЭЦП"
    return EdsIdentity(iin=iin, bin=bin_, fio=str(fio), org=str(org) if org else None)
