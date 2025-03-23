export type KeyServiceOptions = {
  initKeys: boolean;
  publicKeyPath: string;
  privateKeyPath: string;
};

export type SecurityModuleOptions = Partial<KeyServiceOptions>;
