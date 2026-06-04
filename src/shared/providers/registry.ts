import type { Provider, ProviderConfig } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';

type ProviderFactory = (config: ProviderConfig) => Provider;

export class ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();
  private instances = new Map<string, Provider>();

  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  get(name: string, config: ProviderConfig): Provider {
    const key = `${name}:${config.baseUrl || 'default'}`;
    let instance = this.instances.get(key);
    if (!instance) {
      const factory = this.factories.get(name);
      if (!factory) {
        throw new Error(`Unknown provider: ${name}. Available: ${Array.from(this.factories.keys()).join(', ')}`);
      }
      instance = factory(config);
      this.instances.set(key, instance);
    }
    return instance;
  }

  listProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  clearInstances(): void {
    this.instances.clear();
  }
}

export const providerRegistry = new ProviderRegistry();

providerRegistry.register('openai', (_config) => new OpenAIProvider(_config));
providerRegistry.register('deepseek', (_config) => new OpenAIProvider({ ..._config, baseUrl: _config.baseUrl || 'https://api.deepseek.com' }));
providerRegistry.register('anthropic', (_config) => new AnthropicProvider(_config));
providerRegistry.register('gemini', (_config) => new GeminiProvider(_config));
