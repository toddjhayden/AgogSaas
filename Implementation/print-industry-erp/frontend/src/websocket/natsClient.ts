import { connect, NatsConnection, StringCodec } from 'nats.ws';

export class NATSClient {
  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(url: string = 'ws://localhost:4222') {
    try {
      this.nc = await connect({
        servers: url,
        name: 'AgogSaaS Frontend',
      });

      console.log('Connected to NATS');
      this.reconnectAttempts = 0;

      // Handle connection closed
      (async () => {
        if (this.nc) {
          for await (const status of this.nc.status()) {
            console.log('NATS Status:', status);
            if (status.type === 'disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
              setTimeout(() => this.connect(url), 2000);
            }
          }
        }
      })();
    } catch (error) {
      console.error('Failed to connect to NATS:', error);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(url), 2000);
      }
    }
  }

  async subscribe(
    subject: string,
    callback: (data: any) => void
  ): Promise<void> {
    if (!this.nc) {
      console.warn('Not connected to NATS. Attempting to connect...');
      await this.connect();
    }

    if (this.nc) {
      const sub = this.nc.subscribe(subject);
      (async () => {
        for await (const msg of sub) {
          try {
            const data = JSON.parse(this.sc.decode(msg.data));
            callback(data);
          } catch (error) {
            console.error('Error parsing NATS message:', error);
          }
        }
      })();
    }
  }

  async publish(subject: string, data: any): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    this.nc.publish(subject, this.sc.encode(JSON.stringify(data)));
  }

  async disconnect(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
      this.nc = null;
    }
  }
}

// Singleton instance
export const natsClient = new NATSClient();

// Subscribe to KPI updates
export const subscribeToKPIUpdates = (callback: (data: any) => void) => {
  natsClient.subscribe('kpi.updates.*', callback);
};

// Subscribe to production events
export const subscribeToProductionEvents = (callback: (data: any) => void) => {
  natsClient.subscribe('production.events.*', callback);
};

// Subscribe to alerts
export const subscribeToAlerts = (callback: (data: any) => void) => {
  natsClient.subscribe('alerts.*', callback);
};
