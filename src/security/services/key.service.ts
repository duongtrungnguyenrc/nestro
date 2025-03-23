import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { generateKeyPairSync, sign, verify, constants } from "crypto";
import { Injectable } from "@nestjs/common";
import { dirname } from "path";

import { debugLog, normalizeJson } from "../../utils";
import type { KeyServiceOptions } from "../types";

@Injectable()
export class KeyService {
  constructor(private readonly options: KeyServiceOptions) {
    if (options.initKeys) this.ensureKeyPair();
  }

  ensureKeyPair() {
    const keyDir = dirname(this.options.privateKeyPath);

    if (!existsSync(keyDir)) {
      debugLog(KeyService.name, "📂 Creating key directory:", keyDir);
      mkdirSync(keyDir, { recursive: true });
    }

    if (existsSync(this.options.privateKeyPath) && existsSync(this.options.publicKeyPath)) {
      debugLog(KeyService.name, "Key Pair already exists at:", this.options.privateKeyPath);
      return;
    }

    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    writeFileSync(this.options.privateKeyPath, privateKey);
    writeFileSync(this.options.publicKeyPath, publicKey);

    debugLog(KeyService.name, "Key Pair generated successfully!");
  }

  getPrivateKey(): string {
    return readFileSync(this.options.privateKeyPath, "utf-8");
  }

  getPublicKey(): string {
    return readFileSync(this.options.publicKeyPath, "utf-8");
  }

  signData(data: object): string {
    const privateKey = this.getPrivateKey();

    const signObj = sign("sha256", Buffer.from(normalizeJson(data)), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
    });

    return signObj.toString("base64");
  }

  verifyData(data: object, signature: string, publicKey: string): boolean {
    return verify(
      "sha256",
      Buffer.from(normalizeJson(data)),
      {
        key: publicKey,
        padding: require("crypto").constants.RSA_PKCS1_PSS_PADDING,
      },
      Buffer.from(signature, "base64")
    );
  }
}
