export type StorageOptions = {
  heartbeatInterval?: number; // Interval for sending heartbeat signals (optional)
  cleanupTTL?: number; // Time-to-live for service cleanup in milliseconds
  evictionThreshold?: number;
};

export type StorageConfigs = Partial<StorageOptions>;
