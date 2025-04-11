/**
 * Options for configuring the key service.
 *
 * @property initKeys - Indicates whether to generate or initialize keys.
 * @property publicKeyPath - The file path to the public key.
 * @property privateKeyPath - The file path to the private key.
 */
export type KeyServiceOptions = {
  initKeys: boolean; // Whether to generate/initiate keys
  publicKeyPath: string; // Path to the public key file
  privateKeyPath: string; // Path to the private key file
};

/**
 * Represents the configuration options for the security module.
 * This type is a partial version of `KeyServiceOptions`, allowing
 * for optional customization of its properties.
 */
export type SecurityModuleConfigs = Partial<KeyServiceOptions>;
