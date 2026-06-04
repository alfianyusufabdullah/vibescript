/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentRole, Provider, CodeAttachment, AgentStep } from '../../shared/types';
import { AgentRuntime } from './agentRuntime';
import type { AgentRuntimeCallbacks } from './agentRuntime';

export interface SubAgentResult {
  text: string;
  steps: AgentStep[];
  role: string;
}

export class AgentOrchestrator {
  private runtimes = new Map<string, AgentRuntime>();

  async runAgent(
    role: AgentRole,
    prompt: string,
    provider: Provider,
    apiKey: string,
    model: string,
    editorContext: any,
    scriptId: string,
    callbacks: AgentRuntimeCallbacks,
    attachments?: CodeAttachment[]
  ): Promise<void> {
    const runtime = new AgentRuntime(role);
    const runtimeId = `${role.id}_${Date.now()}`;
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
    editorContext: any,
    scriptId: string
  ): Promise<SubAgentResult> {
    return new Promise((resolve, reject) => {
      const steps: AgentStep[] = [];
      const runtime = new AgentRuntime(role);
      const runtimeId = `${role.id}_sub_${Date.now()}`;
      this.runtimes.set(runtimeId, runtime);

      runtime
        .run(task, provider, apiKey, model, editorContext, scriptId, {
          onStep: (step) => {
            steps.push(step);
          },
          onDone: (response) => {
            this.runtimes.delete(runtimeId);
            resolve({ text: response, steps, role: role.id });
          },
          onError: (error) => {
            this.runtimes.delete(runtimeId);
            reject(new Error(error));
          },
          onStreamingText: () => {
            // sub-agent streaming text is captured via onDone
          },
        })
        .catch((err) => {
          this.runtimes.delete(runtimeId);
          reject(err);
        });
    });
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

}

export const agentOrchestrator = new AgentOrchestrator();
