/**
 * Helper to inspect Saudi ZATCA (Fatoora) Tag-Length-Value (TLV) encoded QR payloads.
 *
 * NOTE: As per strict system requirements, this parser is ONLY used for an optional
 * non-destructive visual inspection preview in the modal.
 * The original raw string is NEVER modified, decoded, or truncated during transmission.
 */

export interface ZatcaTag {
  tag: number;
  tagName: string;
  length: number;
  value: string;
  isHex?: boolean;
}

export interface ParsedZatcaPayload {
  isZatcaFormat: boolean;
  tags: ZatcaTag[];
  phase: 'Phase 1' | 'Phase 2' | 'Unknown';
}

const TAG_NAMES: Record<number, string> = {
  1: "Seller's Name (اسم المورد)",
  2: "VAT Registration Number (الرقم الضريبي)",
  3: "Invoice Timestamp (تاريخ ووقت الفاتورة)",
  4: "Invoice Total with VAT (إجمالي الفاتورة مع الضريبة)",
  5: "VAT Total (إجمالي ضريبة القيمة المضافة)",
  6: "XML Invoice Hash (رمز التحقق للفاتورة)",
  7: "ECDSA Signature (التوقيع الرقمي)",
  8: "ECDSA Public Key (المفتاح العام)",
  9: "Cryptographic Stamp Signature (ختم التشفير)",
};

export function inspectZatcaPayload(rawText: string): ParsedZatcaPayload {
  if (!rawText || typeof rawText !== 'string') {
    return { isZatcaFormat: false, tags: [], phase: 'Unknown' };
  }

  try {
    // Check if it's base64 encoded
    const trimmed = rawText.trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed) || trimmed.length < 20) {
      return { isZatcaFormat: false, tags: [], phase: 'Unknown' };
    }

    const binaryString = atob(trimmed);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const tags: ZatcaTag[] = [];
    let offset = 0;
    const textDecoder = new TextDecoder('utf-8');

    while (offset < bytes.length) {
      const tag = bytes[offset];
      if (tag < 1 || tag > 9) {
        break; // Not standard ZATCA tag sequence
      }

      offset += 1;
      if (offset >= bytes.length) break;

      const length = bytes[offset];
      offset += 1;

      if (offset + length > bytes.length) {
        break; // Truncated or invalid length
      }

      const valBytes = bytes.subarray(offset, offset + length);
      let value = '';
      let isHex = false;

      if (tag >= 1 && tag <= 5) {
        value = textDecoder.decode(valBytes);
      } else {
        // Cryptographic fields in Phase 2 (hash, signature, public key)
        isHex = true;
        value = Array.from(valBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      tags.push({
        tag,
        tagName: TAG_NAMES[tag] || `Field ${tag}`,
        length,
        value,
        isHex,
      });

      offset += length;
    }

    // A valid ZATCA QR must have at least tags 1 through 5
    const hasCoreTags = tags.some(t => t.tag === 1) && tags.some(t => t.tag === 2) && tags.some(t => t.tag === 4);
    if (!hasCoreTags) {
      return { isZatcaFormat: false, tags: [], phase: 'Unknown' };
    }

    const hasPhase2Crypto = tags.some(t => t.tag >= 6);

    return {
      isZatcaFormat: true,
      tags,
      phase: hasPhase2Crypto ? 'Phase 2' : 'Phase 1',
    };
  } catch {
    return { isZatcaFormat: false, tags: [], phase: 'Unknown' };
  }
}
