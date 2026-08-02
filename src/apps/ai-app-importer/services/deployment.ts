export interface DeployHookConfig {
  webhookUrl?: string;
  vercelProjectId?: string;
  vercelToken?: string;
}

/**
 * Triggers a deployment if the person has supplied optional deploy
 * configuration. Nothing here is required — if no webhook or Vercel
 * credentials are provided, this simply reports that no remote deploy
 * step was configured instead of failing.
 */
export async function triggerDeployment(config: DeployHookConfig): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    if (config.webhookUrl) {
      const res = await fetch(config.webhookUrl, { method: 'POST' });
      if (!res.ok) throw new Error(`Deploy hook failed: ${res.statusText}`);
      return { success: true, previewUrl: 'https://vercel.com/dashboard' };
    }

    if (config.vercelProjectId && config.vercelToken) {
      const res = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: config.vercelProjectId
        })
      });
      if (!res.ok) throw new Error(`Vercel deployment request failed: ${res.statusText}`);
      const data = await res.json();
      return { success: true, previewUrl: data.url ? `https://${data.url}` : undefined };
    }

    return { success: true, previewUrl: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deployment trigger failed';
    return { success: false, error: message };
  }
}
