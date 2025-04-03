/**
 * Options for key management in security.
 */
export type KeyServiceOptions = {
  initKeys: boolean; // Whether to generate/initiate keys
  publicKeyPath: string; // Path to the public key file
  privateKeyPath: string; // Path to the private key file
};

/**
 * Security module configuration, allowing partial key service options.
 */
export type SecurityModuleOptions = Partial<KeyServiceOptions>;
