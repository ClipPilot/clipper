# GPU Configuration

## Adding a New GPU

When adding a new GPU to the system, you must update **two places**:

### 1. Add GPU to `gpus.config.json`

```json
{
  "gpus": [
    {
      "id": "gpu-1",
      "name": "RunPod GPU 1",
      "url": "https://your-gpu-endpoint-8188.proxy.runpod.net",
      "cleanupUrl": "https://your-gpu-endpoint-3001.proxy.runpod.net"
    }
  ]
}
```

### 2. Update Terraform Worker Count

In `infra/variables.tf`, update both values to match the number of GPUs:

```hcl
variable "gpu_worker_min_capacity" {
  default = 2  # <-- Set to number of GPUs
}

variable "gpu_worker_max_capacity" {
  default = 2  # <-- Set to number of GPUs
}
```

Then apply the Terraform changes:
```bash
cd infra && terraform apply
```

## Why 1 Worker Per GPU?

Each GPU worker polls the SQS queue and processes one job at a time. Having one worker per GPU ensures:

- When 2 jobs are submitted, both GPUs start processing immediately
- No jobs sit idle in the queue waiting for a busy worker
- Maximum throughput with your available GPU resources

## Current Setup

| GPUs | Workers |
|------|---------|
| 2    | 2       |

Update this table when adding/removing GPUs.
