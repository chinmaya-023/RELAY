export class ProviderAdapter {
  unsupported(capability) { return { supported: false, capability, reason: `The configured provider does not support ${capability} in Relay.` }; }
  async getServiceInfo() { return this.unsupported('service information'); }
  async getServiceStatus() { return this.unsupported('service status'); }
  async getUsage() { return this.unsupported('usage monitoring'); }
  async getLimits() { return this.unsupported('limit monitoring'); }
}

export class CustomProviderAdapter extends ProviderAdapter {}

export const providerAdapterFor = (provider) => {
  if (provider === 'custom') return new CustomProviderAdapter();
  return new ProviderAdapter();
};
