import type { AgentRole, Provider, CodeAttachment, AgentStep, TokenUsage, MonacoEditorContext } from '../../shared/types';
import { AgentRuntime } from './agentRuntime';
import type { AgentRuntimeCallbacks } from './agentRuntime';

export interface SubAgentResult {
  text: string;
  steps: AgentStep[];
  role: string;
  usage?: TokenUsage;
  data?: unknown;
}

export interface SubAgentTask {
  role: AgentRole;
  task: string;
  provider: Provider;
  apiKey: string;
  model: string;
  editorContext: MonacoEditorContext | null;
  scriptId: string;
  outputSchema?: Record<string, unknown>;
}

// Agent Message Bus — for inter-agent communication
export interface AgentBusMessage {
  from: string;
  channel: string;
  payload: unknown;
  timestamp: number;
}

type AgentMessageHandler = (message: AgentBusMessage) => void;

class AgentMessageBus {
  private channels = new Map<string, Set<AgentMessageHandler>>();

  subscribe(channel: string, handler: AgentMessageHandler): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(handler);
    return () => this.channels.get(channel)?.delete(handler);
  }

  publish(from: string, channel: string, payload: unknown): void {
    const handlers = this.channels.get(channel);
    if (!handlers) {
      return;
    }
    const message: AgentBusMessage = { from, channel, payload, timestamp: Date.now() };
    for (const handler of handlers) {
      try {
        handler(message);
      } catch {
        /* ignore handler errors */
      }
    }
  }

  clearChannel(channel: string): void {
    this.channels.delete(channel);
  }

  clear(): void {
    this.channels.clear();
  }
}

export const agentMessageBus = new AgentMessageBus();

export class AgentOrchestrator {
  private runtimes = new Map<string, AgentRuntime>();

  async runAgent(
    role: AgentRole,
    prompt: string,
    provider: Provider,
    apiKey: string,
    model: string,
    editorContext: MonacoEditorContext | null,
    scriptId: string,
    callbacks: AgentRuntimeCallbacks,
    attachments?: CodeAttachment[]
  ): Promise<void> {
    const runtime = new AgentRuntime(role);
    const runtimeId = `${role.id}_${this.generateId()}`;
    this.runtimes.set(runtimeId, runtime);
    try {
      await runtime.run(prompt, provider, apiKey, model, editorContext, scriptId, callbacks, attachments);
    } finally {
      this.runtimes.delete(runtimeId);
    }
  }

  async runSubAgent(
    role: AgentRole,
    task: string,
    provider: Provider,
    apiKey: string,
    model: string,
    editorContext: MonacoEditorContext | null,
    scriptId: string,
    outputSchema?: Record<string, unknown>
  ): Promise<SubAgentResult> {
    return new Promise((resolve, reject) => {
      const steps: AgentStep[] = [];
      const runtime = new AgentRuntime(role);
      const runtimeId = `${role.id}_sub_${this.generateId()}`;
      this.runtimes.set(runtimeId, runtime);

      const finalTask = outputSchema
        ? `${task}\n\nOutput your result as valid JSON matching this schema:\n${JSON.stringify(outputSchema, null, 2)}\nReturn ONLY the JSON, no other text.`
        : task;

      runtime
        .run(finalTask, provider, apiKey, model, editorContext, scriptId, {
          onStep: (step) => {
            steps.push(step);
          },
          onDone: (response, usage) => {
            this.runtimes.delete(runtimeId);
            let data: unknown;
            if (outputSchema) {
              const jsonMatch =
                response.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
              if (jsonMatch) {
                try {
                  data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                } catch {
                  /* ignore parse errors — data stays undefined */
                }
              }
            }
            resolve({ text: response, steps, role: role.id, usage, data });
          },
          onError: (error) => {
            this.runtimes.delete(runtimeId);
            reject(new Error(error));
          },
          // Sub-agent streaming is not surfaced to the caller; text is captured via onDone.
          onStreamingText: () => { /* intentionally empty */ },
        })
        .catch((err) => {
          this.runtimes.delete(runtimeId);
          reject(err);
        });
    });
  }

  async runSubAgentsParallel(tasks: SubAgentTask[]): Promise<Array<SubAgentResult | null>> {
    const settled = await Promise.allSettled(
      tasks.map((t) =>
        this.runSubAgent(t.role, t.task, t.provider, t.apiKey, t.model, t.editorContext, t.scriptId, t.outputSchema)
      )
    );
    return settled.map((r) => (r.status === 'fulfilled' ? r.value : null));
  }

  resolveUserInput(answer: string): void {
    for (const [, runtime] of this.runtimes) {
      runtime.resolveUserInput(answer);
    }
  }

  cancel(roleId?: string): void {
    if (roleId) {
      for (const [id, runtime] of this.runtimes) {
        if (id.startsWith(roleId)) {
          runtime.cancel();
          this.runtimes.delete(id);
        }
      }
    } else {
      for (const [, runtime] of this.runtimes) {
        runtime.cancel();
      }
      this.runtimes.clear();
    }
  }

  private generateId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    return `${timestamp}_${randomSuffix}`;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
