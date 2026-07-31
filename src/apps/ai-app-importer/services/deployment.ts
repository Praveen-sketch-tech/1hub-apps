export interface DeployHookConfig {
  webhookUrl?: string;
  vercelProjectId?: string;
  vercelToken?: string;
}

export async function triggerDeployment(config: DeployHookConfig): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  try {
    if (config.webhookUrl) {
      const res = await fetch(config.webhookUrl, { method: 'POST' });
      if (!res.ok) throw new Error(`Deploy hook failed: ${res.statusText}`);
      return { success: true, previewUrl: '[https://vercel.com/dashboard](https://vercel.com/dashboard)' };
    }

    if (config.vercelProjectId && config.vercelToken) {
      const res = await fetch(`[https://api.vercel.com/v13/deployments](https://api.vercel.com/v13/deployments)`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.vercelToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: config.vercelProjectId
        })
      });
      const data = await res.json();
      return { success: true, previewUrl: data.url ? `https://${data.url}` : undefined };
    }

    return { success: true, previewUrl: '[https://vercel.com](https://vercel.com)' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Deployment trigger failed' };
  }
}
