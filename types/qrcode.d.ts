// Minimal ambient types for the parts of `qrcode` we use (drawing the
// downloadable invite card). Avoids pulling in @types/qrcode for one call.
declare module "qrcode" {
  interface QRCodeBitMatrix {
    size: number;
    data: Uint8Array;
  }

  interface QRCode {
    modules: QRCodeBitMatrix;
  }

  interface QRCodeCreateOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H" | "low" | "medium" | "quartile" | "high";
    version?: number;
    maskPattern?: number;
  }

  export function create(text: string, options?: QRCodeCreateOptions): QRCode;

  const qrcode: {
    create: typeof create;
  };

  export default qrcode;
}
