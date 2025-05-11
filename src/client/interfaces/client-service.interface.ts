export interface IClientService {
  register(): Promise<void>;
  sendHeartbeat(): Promise<void>;
  deregister(): Promise<void>;
}
